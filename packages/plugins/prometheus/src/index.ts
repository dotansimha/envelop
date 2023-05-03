/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { TypeInfo } from 'graphql';
import { Counter, register as defaultRegistry, Histogram, Summary } from 'prom-client';
import {
  isAsyncIterable,
  isIntrospectionOperationString,
  OnContextBuildingHook,
  OnExecuteHook,
  OnExecuteHookResult,
  OnParseHook,
  OnValidateHook,
  Plugin,
} from '@envelop/core';
import { useOnResolve } from '@envelop/on-resolve';
import { PrometheusTracingPluginConfig } from './config.js';
import {
  createCounter,
  createHistogram,
  createInternalContext,
  createSummary,
  extractDeprecatedFields,
  FillLabelsFnParams,
  getHistogramFromConfig,
  shouldTraceFieldResolver,
} from './utils.js';

export {
  PrometheusTracingPluginConfig,
  createCounter,
  createHistogram,
  createSummary,
  FillLabelsFnParams,
};

const promPluginContext = Symbol('promPluginContext');
const promPluginExecutionStartTimeSymbol = Symbol('promPluginExecutionStartTimeSymbol');

type PluginInternalContext = {
  [promPluginContext]: FillLabelsFnParams;
  [promPluginExecutionStartTimeSymbol]: number;
};

export const usePrometheus = (
  config: PrometheusTracingPluginConfig = {},
): Plugin<PluginInternalContext> => {
  let typeInfo: TypeInfo | null = null;

  const parseHistogram = getHistogramFromConfig(
    config,
    'parse',
    'graphql_envelop_phase_parse',
    'Time spent on running GraphQL "parse" function',
  );
  const validateHistogram = getHistogramFromConfig(
    config,
    'validate',
    'graphql_envelop_phase_validate',
    'Time spent on running GraphQL "validate" function',
  );
  const contextBuildingHistogram = getHistogramFromConfig(
    config,
    'contextBuilding',
    'graphql_envelop_phase_context',
    'Time spent on building the GraphQL context',
  );
  const executeHistogram = getHistogramFromConfig(
    config,
    'execute',
    'graphql_envelop_phase_execute',
    'Time spent on running the GraphQL "execute" function',
  );

  const resolversHistogram =
    typeof config.resolvers === 'object'
      ? config.resolvers
      : config.resolvers === true
      ? createHistogram({
          histogram: new Histogram({
            name: 'graphql_envelop_execute_resolver',
            help: 'Time spent on running the GraphQL resolvers',
            labelNames: [
              'operationType',
              'operationName',
              'fieldName',
              'typeName',
              'returnType',
            ] as const,
            registers: [config.registry || defaultRegistry],
          }),
          fillLabelsFn: params => ({
            operationName: params.operationName!,
            operationType: params.operationType!,
            fieldName: params.info?.fieldName!,
            typeName: params.info?.parentType.name!,
            returnType: params.info?.returnType.toString()!,
          }),
        })
      : undefined;

  const requestTotalHistogram =
    typeof config.requestTotalDuration === 'object'
      ? config.requestTotalDuration
      : config.requestTotalDuration === true
      ? createHistogram({
          histogram: new Histogram({
            name: 'graphql_envelop_request_duration',
            help: 'Time spent on running the GraphQL operation from parse to execute',
            labelNames: ['operationType', 'operationName'] as const,
            registers: [config.registry || defaultRegistry],
          }),
          fillLabelsFn: params => ({
            operationName: params.operationName!,
            operationType: params.operationType!,
          }),
        })
      : undefined;

  const requestSummary =
    typeof config.requestSummary === 'object'
      ? config.requestSummary
      : config.requestSummary === true
      ? createSummary({
          summary: new Summary({
            name: 'graphql_envelop_request_time_summary',
            help: 'Summary to measure the time to complete GraphQL operations',
            labelNames: ['operationType', 'operationName'] as const,
            registers: [config.registry || defaultRegistry],
          }),
          fillLabelsFn: params => ({
            operationName: params.operationName!,
            operationType: params.operationType!,
          }),
        })
      : undefined;

  const errorsCounter =
    typeof config.errors === 'object'
      ? config.errors
      : config.errors === true
      ? createCounter({
          counter: new Counter({
            name: 'graphql_envelop_error_result',
            help: 'Counts the amount of errors reported from all phases',
            labelNames: ['operationType', 'operationName', 'path', 'phase'] as const,
            registers: [config.registry || defaultRegistry],
          }),
          fillLabelsFn: params => ({
            operationName: params.operationName!,
            operationType: params.operationType!,
            path: params.error?.path?.join('.')!,
            phase: params.errorPhase!,
          }),
        })
      : undefined;

  const reqCounter =
    typeof config.requestCount === 'object'
      ? config.requestCount
      : config.requestCount === true
      ? createCounter({
          counter: new Counter({
            name: 'graphql_envelop_request',
            help: 'Counts the amount of GraphQL requests executed through Envelop',
            labelNames: ['operationType', 'operationName'] as const,
            registers: [config.registry || defaultRegistry],
          }),
          fillLabelsFn: params => ({
            operationName: params.operationName!,
            operationType: params.operationType!,
          }),
        })
      : undefined;

  const deprecationCounter =
    typeof config.deprecatedFields === 'object'
      ? config.deprecatedFields
      : config.deprecatedFields === true
      ? createCounter({
          counter: new Counter({
            name: 'graphql_envelop_deprecated_field',
            help: 'Counts the amount of deprecated fields used in selection sets',
            labelNames: ['operationType', 'operationName', 'fieldName', 'typeName'] as const,
            registers: [config.registry || defaultRegistry],
          }),
          fillLabelsFn: params => ({
            operationName: params.operationName!,
            operationType: params.operationType!,
            fieldName: params.deprecationInfo?.fieldName!,
            typeName: params.deprecationInfo?.typeName!,
          }),
        })
      : undefined;

  const onParse: OnParseHook<PluginInternalContext> = ({ context, extendContext, params }) => {
    if (config.skipIntrospection && isIntrospectionOperationString(params.source)) {
      return;
    }

    const startTime = Date.now();

    return params => {
      const totalTime = (Date.now() - startTime) / 1000;
      const internalContext = createInternalContext(params.result);

      if (internalContext) {
        extendContext({
          [promPluginContext]: internalContext,
        });

        parseHistogram?.histogram.observe(
          parseHistogram.fillLabelsFn(internalContext, context),
          totalTime,
        );

        if (deprecationCounter && typeInfo) {
          const deprecatedFields = extractDeprecatedFields(internalContext.document!, typeInfo);

          if (deprecatedFields.length > 0) {
            for (const depField of deprecatedFields) {
              deprecationCounter.counter
                .labels(
                  deprecationCounter.fillLabelsFn(
                    {
                      ...internalContext,
                      deprecationInfo: depField,
                    },
                    context,
                  ),
                )
                .inc();
            }
          }
        }
      } else {
        // means that we got a parse error, report it
        errorsCounter?.counter
          .labels({
            phase: 'parse',
          })
          .inc();
      }
    };
  };

  const onValidate: OnValidateHook<PluginInternalContext> | undefined = validateHistogram
    ? ({ context }) => {
        if (!context[promPluginContext]) {
          return undefined;
        }

        const startTime = Date.now();

        return ({ valid }) => {
          const totalTime = (Date.now() - startTime) / 1000;
          const labels = validateHistogram.fillLabelsFn(context[promPluginContext], context);
          validateHistogram.histogram.observe(labels, totalTime);

          if (!valid) {
            errorsCounter?.counter
              .labels({
                ...labels,
                phase: 'validate',
              })
              .inc();
          }
        };
      }
    : undefined;

  const onContextBuilding: OnContextBuildingHook<PluginInternalContext> | undefined =
    contextBuildingHistogram
      ? ({ context }) => {
          if (!context[promPluginContext]) {
            return undefined;
          }

          const startTime = Date.now();

          return () => {
            const totalTime = (Date.now() - startTime) / 1000;
            contextBuildingHistogram.histogram.observe(
              contextBuildingHistogram.fillLabelsFn(context[promPluginContext], context),
              totalTime,
            );
          };
        }
      : undefined;

  const onExecute: OnExecuteHook<PluginInternalContext> | undefined = executeHistogram
    ? ({ args }) => {
        if (!args.contextValue[promPluginContext]) {
          return undefined;
        }

        const startTime = Date.now();
        reqCounter?.counter
          .labels(reqCounter.fillLabelsFn(args.contextValue[promPluginContext], args.contextValue))
          .inc();

        const result: OnExecuteHookResult<PluginInternalContext> = {
          onExecuteDone: ({ result }) => {
            const totalTime = (Date.now() - startTime) / 1000;
            executeHistogram.histogram.observe(
              executeHistogram.fillLabelsFn(
                args.contextValue[promPluginContext],
                args.contextValue,
              ),
              totalTime,
            );

            requestTotalHistogram?.histogram.observe(
              requestTotalHistogram.fillLabelsFn(
                args.contextValue[promPluginContext],
                args.contextValue,
              ),
              totalTime,
            );

            if (requestSummary && args.contextValue[promPluginExecutionStartTimeSymbol]) {
              const summaryTime =
                (Date.now() - args.contextValue[promPluginExecutionStartTimeSymbol]) / 1000;

              requestSummary.summary.observe(
                requestSummary.fillLabelsFn(
                  args.contextValue[promPluginContext],
                  args.contextValue,
                ),
                summaryTime,
              );
            }

            if (
              errorsCounter &&
              !isAsyncIterable(result) &&
              result.errors &&
              result.errors.length > 0
            ) {
              for (const error of result.errors) {
                errorsCounter.counter
                  .labels(
                    errorsCounter.fillLabelsFn(
                      {
                        ...args.contextValue[promPluginContext],
                        errorPhase: 'execute',
                        error,
                      },
                      args.contextValue,
                    ),
                  )
                  .inc();
              }
            }
          },
        };

        return result;
      }
    : undefined;

  return {
    onEnveloped({ extendContext }) {
      extendContext({
        [promPluginExecutionStartTimeSymbol]: Date.now(),
      });
    },
    onPluginInit({ addPlugin }) {
      if (resolversHistogram) {
        addPlugin(
          useOnResolve(({ info, context }) => {
            const shouldTrace = shouldTraceFieldResolver(info, config.resolversWhitelist);

            if (!shouldTrace) {
              return undefined;
            }

            const startTime = Date.now();

            return () => {
              const totalTime = (Date.now() - startTime) / 1000;
              const paramsCtx = {
                ...context[promPluginContext],
                info,
              };
              resolversHistogram.histogram.observe(
                resolversHistogram.fillLabelsFn(paramsCtx, context),
                totalTime,
              );
            };
          }),
        );
      }
    },
    onSchemaChange({ schema }) {
      typeInfo = new TypeInfo(schema);
    },
    onParse,
    onValidate,
    onContextBuilding,
    onExecute,
  };
};
