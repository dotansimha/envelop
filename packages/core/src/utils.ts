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
} from '@envelop/types';
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';

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
  subscribeFn: (args: SubscriptionArgs) => PromiseOrValue<AsyncIterableIterator<ExecutionResult> | ExecutionResult>
): SubscribeFunction =>
  ((...polyArgs: PolymorphicSubscribeArguments): PromiseOrValue<AsyncIterableIterator<ExecutionResult> | ExecutionResult> =>
    subscribeFn(getSubscribeArgs(polyArgs))) as SubscribeFunction;

export async function* mapAsyncIterator<TInput, TOutput = TInput>(
  asyncIterable: AsyncIterableIterator<TInput>,
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
    executeFn(getExecuteArgs(polyArgs))) as ExecuteFunction;

export async function* finalAsyncIterator<TInput>(
  asyncIterable: AsyncIterableIterator<TInput>,
  onFinal: () => void
): AsyncIterableIterator<TInput> {
  try {
    yield* asyncIterable;
  } finally {
    onFinal();
  }
}

export async function* errorAsyncIterator<TInput>(
  asyncIterable: AsyncIterableIterator<TInput>,
  onError: (err: unknown) => void
): AsyncIterableIterator<TInput> {
  try {
    yield* asyncIterable;
  } catch (err: unknown) {
    onError(err);
  }
}
