import type {
  DocumentNode,
  ExecutionArgs,
  ExecutionResult,
  GraphQLError,
  GraphQLResolveInfo,
  GraphQLSchema,
  ParseOptions,
  Source,
  SubscriptionArgs,
  ValidationRule,
} from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';
import { DefaultContext } from './context-types';
import {
  AsyncIterableIteratorOrValue,
  ExecuteFunction,
  ParseFunction,
  ValidateFunction,
  ValidateFunctionParameter,
} from '@envelop/core';
import { SubscribeFunction } from './graphql';
import { Plugin } from './plugin';

export type DefaultArgs = Record<string, unknown>;

export type SetSchemaFn = (newSchema: GraphQLSchema) => void;

/**
 * The payload forwarded to the onSchemaChange hook.
 */
export type OnSchemaChangeEventPayload = { schema: GraphQLSchema; replaceSchema: SetSchemaFn };

/**
 * Invoked each time the schema is changed via a setSchema call.
 */
export type OnSchemaChangeHook = (options: OnSchemaChangeEventPayload) => void;

export type OnContextErrorHandlerPayload = {
  /** The error or thing that got rejected or thrown */
  error: unknown;
  /** Overwrite the error or thing that got rejected or thrown. */
  setError: (err: unknown) => void;
};

export type OnContextErrorHandler = (options: OnContextErrorHandlerPayload) => PromiseOrValue<void>;

export type RegisterContextErrorHandler = (handler: OnContextErrorHandler) => void;

/**
 * Payload forwarded to the onPluginInit hook.
 */
export type OnPluginInitEventPayload = {
  /**
   * Register a new plugin.
   */
  addPlugin: (newPlugin: Plugin<any>) => void;
  /**
   * A list of all currently active plugins.
   */
  plugins: Plugin<any>[];
  /**
   * Set the GraphQL schema.
   */
  setSchema: SetSchemaFn;
  /**
   * Register an error handler used for context creation.
   */
  registerContextErrorHandler: RegisterContextErrorHandler;
};

/**
 * Invoked when a plugin is initialized.
 */
export type OnPluginInitHook = (options: OnPluginInitEventPayload) => void;

/** onPluginInit */
export type OnEnvelopedHookEventPayload<ContextType> = {
  /**
   * Set the schema that should be used for execution.
   */
  setSchema: SetSchemaFn;
  /**
   * The context object.
   */
  context: Readonly<Maybe<ContextType>>;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
};

export type OnEnvelopedHook<ContextType> = (options: OnEnvelopedHookEventPayload<ContextType>) => void;

export type OnParseEventPayload<ContextType> = {
  /**
   * The current context object.
   */
  context: Readonly<ContextType>;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
  /**
   * The parameters that are passed to the parse call.
   */
  params: { source: string | Source; options?: ParseOptions };
  /**
   * The current parse function
   */
  parseFn: ParseFunction;
  /**
   * Replace the current parse function
   */
  setParseFn: (newFn: ParseFunction) => void;
  /**
   * Set/overwrite the parsed document.
   * If a parsed document is set the call to the parseFn will be skipped.
   */
  setParsedDocument: (doc: DocumentNode) => void;
};

export type AfterParseEventPayload<ContextType> = {
  /**
   * The current context object.
   */
  context: Readonly<ContextType>;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
  /**
   * The result of the parse phase.
   */
  result: DocumentNode | Error | null;
  /**
   * Replace the parse result with a new result.
   */
  replaceParseResult: (newResult: DocumentNode | Error) => void;
};

/**
 * Hook that is invoked after the parse function has been invoked.
 */
export type AfterParseHook<ContextType> = (options: AfterParseEventPayload<ContextType>) => void;
/**
 * Hook that is invoked before the parse function is invoked.
 */
export type OnParseHook<ContextType> = (options: OnParseEventPayload<ContextType>) => void | AfterParseHook<ContextType>;
/**
 * Payload forwarded to the onValidate hook.
 */
export type OnValidateEventPayload<ContextType> = {
  /**
   * The current context object.
   */
  context: Readonly<ContextType>;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
  /**
   * The parameters with which the validate function will be invoked.
   */
  params: ValidateFunctionParameter;
  /**
   * Register a validation rule that will be used for the validate invocation.
   */
  addValidationRule: (rule: ValidationRule) => void;
  /**
   * The current validate function that will be invoked.
   */
  validateFn: ValidateFunction;
  /**
   * Overwrite the current validate function.
   */
  setValidationFn: (newValidate: ValidateFunction) => void;
  /**
   * Set a validation error result and skip the validate invocation.
   */
  setResult: (errors: readonly GraphQLError[]) => void;
};

/**
 * Payload forwarded to the afterValidate hook.
 */
export type AfterValidateEventPayload<ContextType> = {
  /**
   * The current context object.
   */
  context: Readonly<ContextType>;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
  /**
   * Whether the validation raised any errors or not.
   */
  valid: boolean;
  /**
   * An array of errors that were raised during the validation phase.
   * The array is empty if no errors were raised.
   */
  result: readonly GraphQLError[];
};

/**
 * AfterValidateHook is invoked after the validate function has been invoked.
 */
export type AfterValidateHook<ContextType> = (options: AfterValidateEventPayload<ContextType>) => void;

/**
 * The OnValidateHook is invoked before the validate function has been invoked.
 */
export type OnValidateHook<ContextType> = (options: OnValidateEventPayload<ContextType>) => void | AfterValidateHook<ContextType>;

/**
 * The payload forwarded to the onContextBuilding hook.
 */
export type OnContextBuildingEventPayload<ContextType> = {
  /**
   * The current context object.
   */
  context: Readonly<ContextType>;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
};

/**
 * The payload forwarded to the afterContextBuilding hook.
 */
export type AfterContextBuildingEventPayload<ContextType> = {
  /**
   * The current context object.
   */
  context: ContextType;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
};

/**
 * Invoked after the context has been builded.
 */
export type AfterContextBuildingHook<ContextType> = (
  options: AfterContextBuildingEventPayload<ContextType>
) => PromiseOrValue<void>;

/**
 * Invoked before the context has been builded.
 * Return a AfterContextBuildingHook, which is invoked after the context building has been finished.
 */
export type OnContextBuildingHook<ContextType> = (
  options: OnContextBuildingEventPayload<ContextType>
) => PromiseOrValue<void | AfterContextBuildingHook<ContextType>>;

export type ResolverFn<ParentType = unknown, ArgsType = DefaultArgs, ContextType = unknown, ResultType = unknown> = (
  root: ParentType,
  args: ArgsType,
  context: ContextType,
  info: GraphQLResolveInfo
) => PromiseOrValue<ResultType>;

export type OnBeforeResolverCalledEventPayload<
  ParentType = unknown,
  ArgsType = DefaultArgs,
  ContextType = unknown,
  ResultType = unknown
> = {
  root: ParentType;
  args: ArgsType;
  context: ContextType;
  info: GraphQLResolveInfo;
  resolverFn: ResolverFn<ParentType, ArgsType, ContextType, ResultType>;
  replaceResolverFn: (newResolver: ResolverFn<ParentType, ArgsType, ContextType, ResultType>) => void;
};

export type AfterResolverEventPayload = { result: unknown | Error; setResult: (newResult: unknown) => void };

export type AfterResolverHook = (options: AfterResolverEventPayload) => void;

export type OnResolverCalledHook<
  ParentType = unknown,
  ArgsType = DefaultArgs,
  ContextType = DefaultContext,
  ResultType = unknown
> = (
  options: OnBeforeResolverCalledEventPayload<ParentType, ArgsType, ContextType, ResultType>
) => PromiseOrValue<void | AfterResolverHook>;

/**
 * Execution arguments with inferred context value type.
 */
export type TypedExecutionArgs<ContextType> = Omit<ExecutionArgs, 'contextValue'> & { contextValue: ContextType };

/**
 * Payload that is passed to the onExecute hook.
 */
export type OnExecuteEventPayload<ContextType> = {
  /**
   * Current execute function that will be used for execution.
   */
  executeFn: ExecuteFunction;
  /**
   * Arguments the execute function will be invoked with.
   */
  args: TypedExecutionArgs<ContextType>;
  /**
   * Replace the current execute function with a new one.
   */
  setExecuteFn: (newExecute: ExecuteFunction) => void;
  /**
   * Set a execution result and skip calling the execute function.
   */
  setResultAndStopExecution: (newResult: ExecutionResult) => void;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
};

/**
 * Payload that is passed to the onExecuteDone hook.
 */
export type OnExecuteDoneHookResultOnNextHookPayload = {
  /**
   * The execution result.
   */
  result: ExecutionResult;
  /**
   * Replace the execution result with a new execution result.
   */
  setResult: (newResult: ExecutionResult) => void;
};

/**
 * Hook that is invoked for each value a AsyncIterable returned from execute publishes.
 */
export type OnExecuteDoneHookResultOnNextHook = (payload: OnExecuteDoneHookResultOnNextHookPayload) => void | Promise<void>;

/**
 * Hook that is invoked after a AsyncIterable returned from execute completes.
 */
export type OnExecuteDoneHookResultOnEndHook = () => void;

/**
 * Hook for hooking into AsyncIterables returned from execute.
 */
export type OnExecuteDoneHookResult = {
  /**
   * Hook that is invoked for each value a AsyncIterable returned from execute publishes.
   */
  onNext?: OnExecuteDoneHookResultOnNextHook;
  /**
   * Hook that is invoked after a AsyncIterable returned from execute completes.
   */
  onEnd?: OnExecuteDoneHookResultOnEndHook;
};

/**
 * Payload with which the onExecuteDone hook is invoked.
 */
export type OnExecuteDoneEventPayload = {
  /**
   * The execution result returned from the execute function.
   * Can return an AsyncIterable if a graphql.js that has defer/stream implemented is used.
   */
  result: AsyncIterableIteratorOrValue<ExecutionResult>;
  /**
   * Replace the execution result with a new execution result.
   */
  setResult: (newResult: AsyncIterableIteratorOrValue<ExecutionResult>) => void;
};

/**
 * Hook that is invoked after the execute function has been invoked.
 * Allows returning a OnExecuteDoneHookResult for hooking into stream values if execute returned an AsyncIterable.
 */
export type OnExecuteDoneHook = (options: OnExecuteDoneEventPayload) => void | OnExecuteDoneHookResult;

/**
 * Result returned from the onExecute hook result for hooking into subsequent phases.
 */
export type OnExecuteHookResult<ContextType> = {
  /**
   * Invoked with the execution result returned from execute.
   */
  onExecuteDone?: OnExecuteDoneHook;
  /**
   * Invoked before each resolver has been invoked during the execution phase.
   */
  onResolverCalled?: OnResolverCalledHook<any, DefaultArgs, ContextType>;
};

/**
 * onExecute hook that is invoked before the execute function is invoked.
 */
export type OnExecuteHook<ContextType> = (
  options: OnExecuteEventPayload<ContextType>
) => PromiseOrValue<void | OnExecuteHookResult<ContextType>>;

/**
 * Subscription arguments with inferred context value type.
 */
export type TypedSubscriptionArgs<ContextType> = Omit<SubscriptionArgs, 'contextValue'> & { contextValue: ContextType };

/**
 * Payload with which the onSubscribe hook is invoked.
 */
export type OnSubscribeEventPayload<ContextType> = {
  /**
   * Current subscribe function that will be used for setting up the subscription.
   */
  subscribeFn: SubscribeFunction;
  /**
   * Current arguments with which the subscribe function will be invoked.
   */
  args: TypedSubscriptionArgs<ContextType>;
  /**
   * Replace the current subscribe function with a new one that will be used for setting up the subscription.
   */
  setSubscribeFn: (newSubscribe: SubscribeFunction) => void;
  /**
   * Extend the context object with a partial.
   */
  extendContext: (contextExtension: Partial<ContextType>) => void;
};

/**
 * Payload with which the onSubscribeResult hook is invoked.
 */
export type OnSubscribeResultEventPayload = {
  /**
   * The current execution result.
   */
  result: AsyncIterableIterator<ExecutionResult> | ExecutionResult;
  /**
   * Replace the current execution result with a new execution result.
   */
  setResult: (newResult: AsyncIterableIterator<ExecutionResult> | ExecutionResult) => void;
};

export type OnSubscribeResultResultOnNextHookPayload = {
  /**
   * The current execution result.
   */
  result: ExecutionResult;
  /**
   * Replace the current execution result with a new execution result.
   */
  setResult: (newResult: ExecutionResult) => void;
};

/**
 * Hook invoked for each value published by the AsyncIterable returned from subscribe.
 */
export type OnSubscribeResultResultOnNextHook = (payload: OnSubscribeResultResultOnNextHookPayload) => void | Promise<void>;

/**
 * Hook invoked after the AsyncIterable returned from subscribe completes.
 */
export type OnSubscribeResultResultOnEndHook = () => void;

export type OnSubscribeResultResult = {
  /**
   * Invoked for each value published by the AsyncIterable returned from subscribe.
   */
  onNext?: OnSubscribeResultResultOnNextHook;
  /**
   * Invoked after the AsyncIterable returned from subscribe completes.
   */
  onEnd?: OnSubscribeResultResultOnEndHook;
};

/**
 * Hook that is invoked with the result of the subscribe call.
 * Return a OnSubscribeResultResult for hooking into the AsyncIterable returned from subscribe.
 */
export type SubscribeResultHook = (options: OnSubscribeResultEventPayload) => void | OnSubscribeResultResult;

export type SubscribeErrorHookPayload = {
  error: unknown;
  setError: (err: unknown) => void;
};

export type SubscribeErrorHook = (payload: SubscribeErrorHookPayload) => void;

export type OnSubscribeHookResult<ContextType> = {
  /**
   * Invoked with the result returned from subscribe.
   */
  onSubscribeResult?: SubscribeResultHook;
  /**
   * Invoked if the source stream returned from subscribe throws an error.
   */
  onSubscribeError?: SubscribeErrorHook;
  /**
   * Invoked before each resolver has been invoked during the execution phase.
   */
  onResolverCalled?: OnResolverCalledHook<ContextType>;
};

/**
 * onSubscribe hook that is invoked before the subscribe function is called.
 * Return a OnSubscribeHookResult for hooking into phase after the subscribe function has been called.
 */
export type OnSubscribeHook<ContextType> = (
  options: OnSubscribeEventPayload<ContextType>
) => PromiseOrValue<void | OnSubscribeHookResult<ContextType>>;
