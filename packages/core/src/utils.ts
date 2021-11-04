import {
  ASTNode,
  DocumentNode,
  Kind,
  OperationDefinitionNode,
  visit,
  BREAK,
  Source,
  ExecutionResult,
  SubscriptionArgs,
  ExecutionArgs,
} from 'graphql';
import {
  AsyncIterableIteratorOrValue,
  ExecuteFunction,
  PolymorphicExecuteArguments,
  PolymorphicSubscribeArguments,
  SubscribeFunction,
  PromiseOrValue,
  DefaultContext,
  OnExecuteDoneEventPayload,
  OnExecuteDoneHookResult,
  OnExecuteDoneHookResultOnNextHook,
} from '@envelop/types';

export const envelopIsIntrospectionSymbol = Symbol('ENVELOP_IS_INTROSPECTION');

export function isOperationDefinition(def: ASTNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}

export function isIntrospectionOperation(operation: OperationDefinitionNode): boolean {
  if (operation.kind === 'OperationDefinition') {
    let hasIntrospectionField = false;

    visit(operation, {
      Field: node => {
        if (node.name.value === '__schema') {
          hasIntrospectionField = true;
          return BREAK;
        }
      },
    });

    return hasIntrospectionField;
  }

  return false;
}

export function isIntrospectionDocument(document: DocumentNode): boolean {
  const operations = document.definitions.filter(isOperationDefinition);

  return operations.some(op => isIntrospectionOperation(op));
}

export function isIntrospectionOperationString(operation: string | Source): boolean {
  return (typeof operation === 'string' ? operation : operation.body).indexOf('__schema') !== -1;
}

function getSubscribeArgs(args: PolymorphicSubscribeArguments): SubscriptionArgs {
  return args.length === 1
    ? args[0]
    : {
        schema: args[0],
        document: args[1],
        rootValue: args[2],
        contextValue: args[3],
        variableValues: args[4],
        operationName: args[5],
        fieldResolver: args[6],
        subscribeFieldResolver: args[7],
      };
}

/**
 * Utility function for making a subscribe function that handles polymorphic arguments.
 */
export const makeSubscribe = (
  subscribeFn: (args: SubscriptionArgs) => PromiseOrValue<AsyncIterableIterator<ExecutionResult>>
): SubscribeFunction =>
  ((...polyArgs: PolymorphicSubscribeArguments): PromiseOrValue<AsyncIterableIterator<ExecutionResult>> =>
    subscribeFn(getSubscribeArgs(polyArgs))) as SubscribeFunction;

export async function* mapAsyncIterator<TInput, TOutput = TInput>(
  asyncIterable: AsyncIterable<TInput>,
  map: (input: TInput) => Promise<TOutput> | TOutput
): AsyncIterableIterator<TOutput> {
  for await (const value of asyncIterable) {
    yield map(value);
  }
}

function getExecuteArgs(args: PolymorphicExecuteArguments): ExecutionArgs {
  return args.length === 1
    ? args[0]
    : {
        schema: args[0],
        document: args[1],
        rootValue: args[2],
        contextValue: args[3],
        variableValues: args[4],
        operationName: args[5],
        fieldResolver: args[6],
        typeResolver: args[7],
      };
}

/**
 * Utility function for making a execute function that handles polymorphic arguments.
 */
export const makeExecute = (
  executeFn: (args: ExecutionArgs) => PromiseOrValue<AsyncIterableIteratorOrValue<ExecutionResult>>
): ExecuteFunction =>
  ((...polyArgs: PolymorphicExecuteArguments): PromiseOrValue<AsyncIterableIteratorOrValue<ExecutionResult>> =>
    executeFn(getExecuteArgs(polyArgs))) as unknown as ExecuteFunction;

/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * implementing a `Symbol.asyncIterator` method.
 *
 * Source: https://github.com/graphql/graphql-js/blob/main/src/jsutils/isAsyncIterable.ts
 */
export function isAsyncIterable<T = any>(maybeAsyncIterable: any): maybeAsyncIterable is AsyncIterable<T> {
  return (
    maybeAsyncIterable != null &&
    typeof maybeAsyncIterable === 'object' &&
    typeof maybeAsyncIterable[Symbol.asyncIterator] === 'function'
  );
}

/**
 * A utility function for handling `onExecuteDone` hook result, for simplifying the handling of AsyncIterable returned from `execute`.
 *
 * @param payload The payload send to `onExecuteDone` hook function
 * @param fn The handler to be executed on each result
 * @returns a subscription for streamed results, or undefined in case of an non-async
 */
export function handleStreamOrSingleExecutionResult<ContextType = DefaultContext>(
  payload: OnExecuteDoneEventPayload<ContextType>,
  fn: OnExecuteDoneHookResultOnNextHook<ContextType>
): void | OnExecuteDoneHookResult<ContextType> {
  if (isAsyncIterable(payload.result)) {
    return { onNext: fn };
  } else {
    fn({
      args: payload.args,
      result: payload.result,
      setResult: payload.setResult,
    });

    return undefined;
  }
}

export async function* finalAsyncIterator<TInput>(
  asyncIterable: AsyncIterable<TInput>,
  onFinal: () => void
): AsyncIterableIterator<TInput> {
  try {
    yield* asyncIterable;
  } finally {
    onFinal();
  }
}

export async function* errorAsyncIterator<TInput>(
  asyncIterable: AsyncIterable<TInput>,
  onError: (err: unknown) => void
): AsyncIterableIterator<TInput> {
  try {
    yield* asyncIterable;
  } catch (err: unknown) {
    onError(err);
  }
}
