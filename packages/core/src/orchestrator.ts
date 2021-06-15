import { AfterCallback, EnvelopContextFnWrapper, OnResolverCalledHooks, Plugin } from '@envelop/types';
import {
  DocumentNode,
  execute,
  ExecutionArgs,
  ExecutionResult,
  GraphQLError,
  GraphQLFieldResolver,
  GraphQLSchema,
  GraphQLTypeResolver,
  parse,
  specifiedRules,
  subscribe,
  SubscriptionArgs,
  validate,
  ValidationRule,
} from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { prepareTracedSchema, resolversHooksSymbol } from './traced-schema';

export type EnvelopOrchestrator = {
  parse: EnvelopContextFnWrapper<typeof parse, any>;
  validate: EnvelopContextFnWrapper<typeof validate, any>;
  execute: typeof execute;
  subscribe: typeof subscribe;
  contextFactory: EnvelopContextFnWrapper<() => any, any>;
  schema: Maybe<GraphQLSchema>;
  prepareSchema: () => void;
};

export function createEnvelopOrchestrator(plugins: Plugin[]): EnvelopOrchestrator {
  let schema: GraphQLSchema | undefined | null = null;
  let initDone = false;

  // Define the initial method for replacing the GraphQL schema, this is needed in order
  // to allow setting the schema from the onPluginInit callback. We also need to make sure
  // here not to call the same plugin that initiated the schema switch.
  const replaceSchema = (newSchema: GraphQLSchema, ignorePluginIndex = -1) => {
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

  // Iterate all plugins and trigger onPluginInit
  for (const [i, plugin] of plugins.entries()) {
    plugin.onPluginInit &&
      plugin.onPluginInit({
        plugins,
        addPlugin: newPlugin => {
          plugins.push(newPlugin);
        },
        setSchema: modifiedSchema => replaceSchema(modifiedSchema, i),
      });
  }

  // A set of before callbacks defined here in order to allow it to be used later
  const beforeCallbacks = {
    parse: [] as NonNullable<Plugin['onParse']>[],
    validate: [] as NonNullable<Plugin['onValidate']>[],
    subscribe: [] as NonNullable<Plugin['onSubscribe']>[],
    execute: [] as NonNullable<Plugin['onExecute']>[],
    context: [] as NonNullable<Plugin['onContextBuilding']>[],
  };

  for (const { onContextBuilding, onExecute, onParse, onSubscribe, onValidate } of plugins) {
    onContextBuilding && beforeCallbacks.context.push(onContextBuilding);
    onExecute && beforeCallbacks.execute.push(onExecute);
    onParse && beforeCallbacks.parse.push(onParse);
    onSubscribe && beforeCallbacks.subscribe.push(onSubscribe);
    onValidate && beforeCallbacks.validate.push(onValidate);
  }

  const customParse: EnvelopContextFnWrapper<typeof parse, any> = beforeCallbacks.parse.length
    ? sharedObj => (source, parseOptions) => {
        let result: DocumentNode | Error | null = null;
        let parseFn: typeof parse = parse;
        const context = sharedObj;
        const afterCalls: AfterCallback<'onParse'>[] = [];

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
            result = e;
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

        const afterCalls: AfterCallback<'onValidate'>[] = [];
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

  const customContextFactory: EnvelopContextFnWrapper<() => any, any> = beforeCallbacks.context.length
    ? initialContext => async () => {
        const afterCalls: AfterCallback<'onContextBuilding'>[] = [];
        let context = initialContext;

        for (const onContext of beforeCallbacks.context) {
          const afterFn = await onContext({
            context,
            extendContext: extension => {
              context = { ...context, ...extension };
            },
          });

          afterFn && afterCalls.push(afterFn);
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
      }
    : ctx => () => ctx;

  const customSubscribe = async (
    argsOrSchema: SubscriptionArgs | GraphQLSchema,
    document?: DocumentNode,
    rootValue?: any,
    contextValue?: any,
    variableValues?: Maybe<{ [key: string]: any }>,
    operationName?: Maybe<string>,
    fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
    subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>
  ) => {
    const args: SubscriptionArgs =
      argsOrSchema instanceof GraphQLSchema
        ? {
            schema: argsOrSchema,
            document: document!,
            rootValue,
            contextValue,
            variableValues,
            operationName,
            fieldResolver,
            subscribeFieldResolver,
          }
        : argsOrSchema;

    const onResolversHandlers: OnResolverCalledHooks[] = [];
    let subscribeFn: typeof subscribe = subscribe;

    const afterCalls: ((options: {
      result: AsyncIterableIterator<ExecutionResult> | ExecutionResult;
      setResult: (newResult: AsyncIterableIterator<ExecutionResult> | ExecutionResult) => void;
    }) => void)[] = [];
    let context = args.contextValue || {};

    for (const onSubscribe of beforeCallbacks.subscribe) {
      const after = onSubscribe({
        subscribeFn,
        setSubscribeFn: newSubscribeFn => {
          subscribeFn = newSubscribeFn;
        },
        extendContext: extension => {
          context = { ...context, ...extension };
        },
        args,
      });

      if (after) {
        if (after.onSubscribeResult) {
          afterCalls.push(after.onSubscribeResult);
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

    for (const afterCb of afterCalls) {
      afterCb({
        result,
        setResult: newResult => {
          result = newResult;
        },
      });
    }

    return result;
  };

  const customExecute = beforeCallbacks.execute.length
    ? async (
        argsOrSchema: ExecutionArgs | GraphQLSchema,
        document?: DocumentNode,
        rootValue?: any,
        contextValue?: any,
        variableValues?: Maybe<{ [key: string]: any }>,
        operationName?: Maybe<string>,
        fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
        typeResolver?: Maybe<GraphQLTypeResolver<any, any>>
      ) => {
        const args: ExecutionArgs =
          argsOrSchema instanceof GraphQLSchema
            ? {
                schema: argsOrSchema,
                document: document!,
                rootValue,
                contextValue,
                variableValues,
                operationName,
                fieldResolver,
                typeResolver,
              }
            : argsOrSchema;

        const onResolversHandlers: OnResolverCalledHooks[] = [];
        let executeFn: typeof execute = execute;
        let result: ExecutionResult;

        const afterCalls: ((options: { result: ExecutionResult; setResult: (newResult: ExecutionResult) => void }) => void)[] =
          [];
        let context = args.contextValue || {};

        for (const onExecute of beforeCallbacks.execute) {
          let stopCalled = false;

          const after = onExecute({
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
            args,
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

        for (const afterCb of afterCalls) {
          afterCb({
            result,
            setResult: newResult => {
              result = newResult;
            },
          });
        }

        return result;
      }
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
    get schema() {
      return schema;
    },
    prepareSchema: () => prepareTracedSchema(schema),
    parse: customParse,
    validate: customValidate,
    execute: customExecute,
    subscribe: customSubscribe,
    contextFactory: customContextFactory,
  };
}
