/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-console */
/* eslint-disable dot-notation */
import { Plugin, OnExecuteHookResult, OnResolverCalledHook } from '@envelop/types';
import * as Sentry from '@sentry/node';
import { Span } from '@sentry/types';
import { ExecutionArgs, Kind, OperationDefinitionNode, print, responsePathAsArray } from 'graphql';

export type SentryPluginOptions = {
  startTransaction?: boolean;
  renameTransaction?: boolean;
  trackResolvers?: boolean;
  includeRawResult?: boolean;
  includeResolverArgs?: boolean;
  includeExecuteVariables?: boolean;
  appendTags?: (args: ExecutionArgs) => Record<string, unknown>;
  transactionName?: (args: ExecutionArgs) => string;
  operationName?: (args: ExecutionArgs) => string;
};

export const useSentry = (options: SentryPluginOptions = {}): Plugin => {
  function pick<K extends keyof SentryPluginOptions>(key: K, defaultValue?: SentryPluginOptions[K]): SentryPluginOptions[K] {
    return prioritize(options[key], defaultValue);
  }

  const startTransaction = pick('startTransaction', true);
  const trackResolvers = pick('trackResolvers', true);
  const includeResolverArgs = pick('includeResolverArgs', false);
  const includeRawResult = pick('includeRawResult', false);
  const includeExecuteVariables = pick('includeExecuteVariables', false);
  const renameTransaction = pick('renameTransaction', false);

  return {
    onExecute({ args }) {
      const rootOperation = args.document.definitions.find(o => o.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode;
      const operationType = rootOperation.operation;
      const document = print(args.document);
      const opName = args.operationName || rootOperation.name?.value || 'Anonymous Operation';
      const addedTags: Record<string, any> = (options.appendTags && options.appendTags(args)) || {};

      const transactionName = options.transactionName ? options.transactionName(args) : opName;
      const op = options.operationName ? options.operationName(args) : 'execute';
      const tags = {
        operationName: opName,
        operation: operationType,
        ...(addedTags || {}),
      };

      let rootSpan: Span;

      if (startTransaction) {
        rootSpan = Sentry.startTransaction({
          name: transactionName,
          op,
          tags,
        });
      } else {
        const scope = Sentry.getCurrentHub().getScope();
        const parentSpan = scope?.getSpan();
        const span = parentSpan?.startChild({
          description: transactionName,
          op,
          tags,
        });

        if (!span) {
          console.warn(
            [
              `Flag "startTransaction" is enabled but Sentry failed to find a transaction.`,
              `Try to create a transaction before GraphQL execution phase is started.`,
            ].join('\n')
          );
          return {};
        }

        rootSpan = span;

        if (renameTransaction) {
          scope!.setTransactionName(transactionName);
        }
      }

      rootSpan.setData('document', document);

      const onResolverCalled: OnResolverCalledHook | undefined = trackResolvers
        ? ({ args: resolversArgs, info }) => {
            if (rootSpan) {
              const { fieldName, returnType, parentType } = info;
              const parent = rootSpan;
              const tags: Record<string, string> = {
                fieldName,
                parentType: parentType.toString(),
                returnType: returnType.toString(),
              };

              if (includeResolverArgs) {
                tags.args = JSON.stringify(resolversArgs || {});
              }

              const childSpan = parent.startChild({
                op: `${parentType.name}.${fieldName}`,
                tags,
              });

              return ({ result }) => {
                if (includeRawResult) {
                  childSpan.setData('result', result);
                }

                if (result instanceof Error) {
                  const errorPath = responsePathAsArray(info.path).join(' > ');

                  Sentry.captureException(result, {
                    fingerprint: ['graphql', errorPath, opName, operationType],
                  });
                }

                childSpan.finish();
              };
            }

            return () => {};
          }
        : undefined;

      return {
        onResolverCalled,
        onExecuteDone({ result }) {
          if (includeRawResult) {
            rootSpan.setData('result', result);
          }

          if (result.errors && result.errors.length > 0) {
            for (const err of result.errors) {
              Sentry.withScope(scope => {
                scope.setTransactionName(opName);
                scope.setTag('operation', operationType);
                scope.setTag('operationName', opName);
                scope.setExtra('document', document);

                scope.setTags(addedTags || {});

                if (includeRawResult) {
                  scope.setExtra('result', result);
                }

                if (includeExecuteVariables) {
                  scope.setExtra('variables', args.variableValues);
                }

                const errorPath = (err.path || []).join(' > ');

                if (errorPath) {
                  scope.addBreadcrumb({
                    category: 'execution-path',
                    message: errorPath,
                    level: Sentry.Severity.Debug,
                  });
                }

                Sentry.captureException(err, {
                  fingerprint: ['graphql', errorPath, opName, operationType],
                  contexts: {
                    GraphQL: {
                      operationName: opName,
                      operationType: operationType,
                      variables: args.variableValues,
                    },
                  },
                });
              });
            }
          }

          rootSpan.finish();
        },
      };
    },
  };
};

/**
 * Sets a priority for provided values from left (highest) to right (lowest)
 */
function prioritize<T>(...values: T[]): T {
  const picked = values.find(val => typeof val !== 'undefined');

  if (typeof picked === 'undefined') {
    return values[values.length - 1];
  }

  return picked;
}
