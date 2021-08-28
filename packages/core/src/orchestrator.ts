import {
  AfterParseHook,
  AfterValidateHook,
  ArbitraryObject,
  EnvelopContextFnWrapper,
  GetEnvelopedFn,
  OnContextBuildingHook,
  OnEnvelopedHook,
  OnExecuteDoneHook,
  OnExecuteHook,
  OnParseHook,
  OnResolverCalledHook,
  OnSubscribeHook,
  OnValidateHook,
  Plugin,
  SubscribeResultHook,
  TypedSubscriptionArgs,
  TypedExecutionArgs,
  SubscribeFunction,
  OnSubscribeResultResultOnNextHook,
  OnSubscribeResultResultOnEndHook,
  OnExecuteDoneHookResultOnNextHook,
  OnExecuteDoneHookResultOnEndHook,
  ExecuteFunction,
  AsyncIterableIteratorOrValue,
  isAsyncIterable,
  OnContextErrorHandler,
  SubscribeErrorHook,
} from '@envelop/types';
import {
  DocumentNode,
  execute,
  ExecutionResult,
  GraphQLError,
  GraphQLSchema,
  parse,
  specifiedRules,
  subscribe,
  validate,
  ValidationRule,
} from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { prepareTracedSchema, resolversHooksSymbol } from './traced-schema';
import { errorAsyncIterator, finalAsyncIterator, makeExecute, makeSubscribe, mapAsyncIterator } from './utils';

export type EnvelopOrchestrator<
  InitialContext extends ArbitraryObject = ArbitraryObject,
  PluginsContext extends ArbitraryObject = ArbitraryObject
> = {
  init: (initialContext?: Maybe<InitialContext>) => void;
  parse: EnvelopContextFnWrapper<ReturnType<GetEnvelopedFn<PluginsContext>>['parse'], InitialContext>;
  validate: EnvelopContextFnWrapper<ReturnType<GetEnvelopedFn<PluginsContext>>['validate'], InitialContext>;
  execute: ReturnType<GetEnvelopedFn<PluginsContext>>['execute'];
  subscribe: ReturnType<GetEnvelopedFn<PluginsContext>>['subscribe'];
  contextFactory: EnvelopContextFnWrapper<ReturnType<GetEnvelopedFn<PluginsContext>>['contextFactory'], PluginsContext>;
  getCurrentSchema: () => Maybe<GraphQLSchema>;
};

export function createEnvelopOrchestrator<PluginsContext = any>(plugins: Plugin[]): EnvelopOrchestrator<any, PluginsContext> {
  let schema: GraphQLSchema | undefined | null = null;
  let initDone = false;

  // Define the initial method for replacing the GraphQL schema, this is needed in order
  // to allow setting the schema from the onPluginInit callback. We also need to make sure
  // here not to call the same plugin that initiated the schema switch.
  const replaceSchema = (newSchema: GraphQLSchema, ignorePluginIndex = -1) => {
    prepareTracedSchema(newSchema);
    schema = newSchema;

    if (initDone) {
      for (const [i, plugin] of plugins.entries()) {
        if (i !== ignorePluginIndex) {
          plugin.onSchemaChange &&
            plugin.onSchemaChange({
              schema,
              replaceSchema: schemaToSet => {
                replaceSchema(schemaToSet, i);
              },
            });
        }
      }
    }
  };

  const contextErrorHandlers: Array<OnContextErrorHandler> = [];

  // Iterate all plugins and trigger onPluginInit
  for (const [i, plugin] of plugins.entries()) {
    plugin.onPluginInit &&
      plugin.onPluginInit({
        plugins,
        addPlugin: newPlugin => {
          plugins.push(newPlugin);
        },
        setSchema: modifiedSchema => replaceSchema(modifiedSchema, i),
        registerContextErrorHandler: handler => contextErrorHandlers.push(handler),
      });
  }

  // A set of before callbacks defined here in order to allow it to be used later
  const beforeCallbacks = {
    init: [] as OnEnvelopedHook<any>[],
    parse: [] as OnParseHook<any>[],
    validate: [] as OnValidateHook<any>[],
    subscribe: [] as OnSubscribeHook<any>[],
    execute: [] as OnExecuteHook<any>[],
    context: [] as OnContextBuildingHook<any>[],
  };

  for (const { onContextBuilding, onExecute, onParse, onSubscribe, onValidate, onEnveloped } of plugins) {
    onEnveloped && beforeCallbacks.init.push(onEnveloped);
    onContextBuilding && beforeCallbacks.context.push(onContextBuilding);
    onExecute && beforeCallbacks.execute.push(onExecute);
    onParse && beforeCallbacks.parse.push(onParse);
    onSubscribe && beforeCallbacks.subscribe.push(onSubscribe);
    onValidate && beforeCallbacks.validate.push(onValidate);
  }

  const init: EnvelopOrchestrator['init'] = initialContext => {
    for (const [i, onEnveloped] of beforeCallbacks.init.entries()) {
      onEnveloped({
        context: initialContext,
        extendContext: extension => {
          if (!initialContext) {
            return;
          }

          Object.assign(initialContext, extension);
        },
        setSchema: modifiedSchema => replaceSchema(modifiedSchema, i),
      });
    }
  };

  const customParse: EnvelopContextFnWrapper<typeof parse, any> = beforeCallbacks.parse.length
    ? initialContext => (source, parseOptions) => {
        let result: DocumentNode | Error | null = null;
        let parseFn: typeof parse = parse;
        const context = initialContext;
        const afterCalls: AfterParseHook<any>[] = [];

        for (const onParse of beforeCallbacks.parse) {
          const afterFn = onParse({
            context,
            extendContext: extension => {
              Object.assign(context, extension);
            },
            params: { source, options: parseOptions },
            parseFn,
            setParseFn: newFn => {
              parseFn = newFn;
            },
            setParsedDocument: newDoc => {
              result = newDoc;
            },
          });

          afterFn && afterCalls.push(afterFn);
        }

        if (result === null) {
          try {
            result = parseFn(source, parseOptions);
          } catch (e) {
            result = e as Error;
          }
        }

        for (const afterCb of afterCalls) {
          afterCb({
            context,
            extendContext: extension => {
              Object.assign(context, extension);
            },
            replaceParseResult: newResult => {
              result = newResult;
            },
            result,
          });
        }

        if (result === null) {
          throw new Error(`Failed to parse document.`);
        }

        if (result instanceof Error) {
          throw result;
        }

        return result;
      }
    : () => parse;

  const customValidate: EnvelopContextFnWrapper<typeof validate, any> = beforeCallbacks.validate.length
    ? initialContext => (schema, documentAST, rules, typeInfo, validationOptions) => {
        let actualRules: undefined | ValidationRule[] = rules ? [...rules] : undefined;
        let validateFn = validate;
        let result: null | readonly GraphQLError[] = null;
        const context = initialContext;

        const afterCalls: AfterValidateHook<any>[] = [];

        for (const onValidate of beforeCallbacks.validate) {
          const afterFn = onValidate({
            context,
            extendContext: extension => {
              Object.assign(context, extension);
            },
            params: {
              schema,
              documentAST,
              rules: actualRules,
              typeInfo,
              options: validationOptions,
            },
            validateFn,
            addValidationRule: rule => {
              if (!actualRules) {
                actualRules = [...specifiedRules];
              }

              actualRules.push(rule);
            },
            setValidationFn: newFn => {
              validateFn = newFn;
            },
            setResult: newResults => {
              result = newResults;
            },
          });

          afterFn && afterCalls.push(afterFn);
        }

        if (!result) {
          result = validateFn(schema, documentAST, actualRules, typeInfo, validationOptions);
        }

        const valid = result.length === 0;

        for (const afterCb of afterCalls) {
          afterCb({
            valid,
            result,
            context,
            extendContext: extension => {
              Object.assign(context, extension);
            },
          });
        }

        return result;
      }
    : () => validate;

  const customContextFactory: EnvelopContextFnWrapper<(orchestratorCtx?: any) => any, any> = beforeCallbacks.context.length
    ? initialContext => async orchestratorCtx => {
        const afterCalls: OnContextBuildingHook<any>[] = [];

        try {
          let context = orchestratorCtx ? { ...initialContext, ...orchestratorCtx } : initialContext;

          for (const onContext of beforeCallbacks.context) {
            const afterHookResult = await onContext({
              context,
              extendContext: extension => {
                context = { ...context, ...extension };
              },
            });

            if (typeof afterHookResult === 'function') {
              afterCalls.push(afterHookResult);
            }
          }

          for (const afterCb of afterCalls) {
            afterCb({
              context,
              extendContext: extension => {
                context = { ...context, ...extension };
              },
            });
          }
          return context;
        } catch (err) {
          let error: unknown = err;
          for (const errorCb of contextErrorHandlers) {
            errorCb({
              error,
              setError: err => {
                error = err;
              },
            });
          }
          throw error;
        }
      }
    : initialContext => orchestratorCtx => orchestratorCtx ? { ...initialContext, ...orchestratorCtx } : initialContext;

  const customSubscribe = makeSubscribe(async args => {
    const onResolversHandlers: OnResolverCalledHook[] = [];
    let subscribeFn = subscribe as SubscribeFunction;

    const afterCalls: SubscribeResultHook[] = [];
    const subscribeErrorHandlers: SubscribeErrorHook[] = [];

    let context = args.contextValue || {};

    for (const onSubscribe of beforeCallbacks.subscribe) {
      const after = await onSubscribe({
        subscribeFn,
        setSubscribeFn: newSubscribeFn => {
          subscribeFn = newSubscribeFn;
        },
        extendContext: extension => {
          context = { ...context, ...extension };
        },
        args: args as TypedSubscriptionArgs<PluginsContext>,
      });

      if (after) {
        if (after.onSubscribeResult) {
          afterCalls.push(after.onSubscribeResult);
        }
        if (after.onSubscribeError) {
          subscribeErrorHandlers.push(after.onSubscribeError);
        }
        if (after.onResolverCalled) {
          onResolversHandlers.push(after.onResolverCalled);
        }
      }
    }

    if (onResolversHandlers.length) {
      context[resolversHooksSymbol] = onResolversHandlers;
    }

    let result = await subscribeFn({
      ...args,
      contextValue: context,
    });

    const onNextHandler: OnSubscribeResultResultOnNextHook[] = [];
    const onEndHandler: OnSubscribeResultResultOnEndHook[] = [];

    for (const afterCb of afterCalls) {
      const hookResult = afterCb({
        result,
        setResult: newResult => {
          result = newResult;
        },
      });
      if (hookResult) {
        if (hookResult.onNext) {
          onNextHandler.push(hookResult.onNext);
        }
        if (hookResult.onEnd) {
          onEndHandler.push(hookResult.onEnd);
        }
      }
    }

    if (onNextHandler.length && isAsyncIterable(result)) {
      result = mapAsyncIterator(result, async result => {
        for (const onNext of onNextHandler) {
          await onNext({ result, setResult: newResult => (result = newResult) });
        }
        return result;
      });
    }
    if (onEndHandler.length && isAsyncIterable(result)) {
      result = finalAsyncIterator(result, () => {
        for (const onEnd of onEndHandler) {
          onEnd();
        }
      });
    }

    if (subscribeErrorHandlers.length && isAsyncIterable(result)) {
      result = errorAsyncIterator(result, err => {
        let error = err;
        for (const handler of subscribeErrorHandlers) {
          handler({
            error,
            setError: err => {
              error = err;
            },
          });
        }
        throw error;
      });
    }

    return result;
  });

  const customExecute = beforeCallbacks.execute.length
    ? makeExecute(async args => {
        const onResolversHandlers: OnResolverCalledHook[] = [];
        let executeFn = execute as ExecuteFunction;
        let result: AsyncIterableIteratorOrValue<ExecutionResult>;

        const afterCalls: OnExecuteDoneHook[] = [];
        let context = args.contextValue || {};

        for (const onExecute of beforeCallbacks.execute) {
          let stopCalled = false;

          const after = await onExecute({
            executeFn,
            setExecuteFn: newExecuteFn => {
              executeFn = newExecuteFn;
            },
            setResultAndStopExecution: stopResult => {
              stopCalled = true;
              result = stopResult;
            },
            extendContext: extension => {
              if (typeof extension === 'object') {
                context = {
                  ...(context || {}),
                  ...extension,
                };
              } else {
                throw new Error(
                  `Invalid context extension provided! Expected "object", got: "${JSON.stringify(
                    extension
                  )}" (${typeof extension})`
                );
              }
            },
            args: args as TypedExecutionArgs<PluginsContext>,
          });

          if (stopCalled) {
            return result!;
          }

          if (after) {
            if (after.onExecuteDone) {
              afterCalls.push(after.onExecuteDone);
            }
            if (after.onResolverCalled) {
              onResolversHandlers.push(after.onResolverCalled);
            }
          }
        }

        if (onResolversHandlers.length) {
          context[resolversHooksSymbol] = onResolversHandlers;
        }

        result = await executeFn({
          ...args,
          contextValue: context,
        });

        const onNextHandler: OnExecuteDoneHookResultOnNextHook[] = [];
        const onEndHandler: OnExecuteDoneHookResultOnEndHook[] = [];

        for (const afterCb of afterCalls) {
          const hookResult = afterCb({
            result,
            setResult: newResult => {
              result = newResult;
            },
          });
          if (hookResult) {
            if (hookResult.onNext) {
              onNextHandler.push(hookResult.onNext);
            }
            if (hookResult.onEnd) {
              onEndHandler.push(hookResult.onEnd);
            }
          }
        }

        if (onNextHandler.length && isAsyncIterable(result)) {
          result = mapAsyncIterator(result, async result => {
            for (const onNext of onNextHandler) {
              await onNext({ result, setResult: newResult => (result = newResult) });
            }
            return result;
          });
        }
        if (onEndHandler.length && isAsyncIterable(result)) {
          result = finalAsyncIterator(result, () => {
            for (const onEnd of onEndHandler) {
              onEnd();
            }
          });
        }

        return result;
      })
    : execute;

  initDone = true;

  // This is done in order to trigger the first schema available, to allow plugins that needs the schema
  // eagerly to have it.
  if (schema) {
    for (const [i, plugin] of plugins.entries()) {
      plugin.onSchemaChange &&
        plugin.onSchemaChange({
          schema,
          replaceSchema: modifiedSchema => replaceSchema(modifiedSchema, i),
        });
    }
  }

  return {
    getCurrentSchema() {
      return schema;
    },
    init,
    parse: customParse,
    validate: customValidate,
    execute: customExecute as ExecuteFunction,
    subscribe: customSubscribe,
    contextFactory: customContextFactory,
  };
}
