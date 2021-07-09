import {
  DocumentNode,
  execute,
  ExecutionArgs,
  ExecutionResult,
  GraphQLError,
  GraphQLResolveInfo,
  GraphQLSchema,
  parse,
  ParseOptions,
  Source,
  subscribe,
  SubscriptionArgs,
  TypeInfo,
  validate,
  ValidationRule,
} from 'graphql';
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';
import { DefaultContext } from 'packages/core/src';
import { Plugin } from './plugin';

export type DefaultArgs = Record<string, unknown>;
export type SetSchemaFn = (newSchema: GraphQLSchema) => void;

/** onSchemaChange */
export type OnSchemaChangeEventPayload = { schema: GraphQLSchema; replaceSchema: SetSchemaFn };
export type OnSchemaChangeHook = (options: OnSchemaChangeEventPayload) => void;

/** onPluginInit */
export type OnPluginInitEventPayload = {
  addPlugin: (newPlugin: Plugin<any>) => void;
  plugins: Plugin<any>[];
  setSchema: SetSchemaFn;
};
export type OnPluginInitHook = (options: OnPluginInitEventPayload) => void;

/** onParse */
export type OriginalParseFn = typeof parse;
export type OnParseEventPayload<ContextType> = {
  context: Readonly<ContextType>;
  extendContext: (contextExtension: Partial<ContextType>) => void;
  params: { source: string | Source; options?: ParseOptions };
  parseFn: OriginalParseFn;
  setParseFn: (newFn: OriginalParseFn) => void;
  setParsedDocument: (doc: DocumentNode) => void;
};
export type AfterParseEventPayload<ContextType> = {
  context: Readonly<ContextType>;
  extendContext: (contextExtension: Partial<ContextType>) => void;
  result: DocumentNode | Error | null;
  replaceParseResult: (newResult: DocumentNode | Error) => void;
};
export type AfterParseHook<ContextType> = (options: AfterParseEventPayload<ContextType>) => void;
export type OnParseHook<ContextType> = (options: OnParseEventPayload<ContextType>) => void | AfterParseHook<ContextType>;

/** onValidate */
export type OriginalValidateFn = typeof validate;
export type OnValidateEventPayload<ContextType> = {
  context: Readonly<ContextType>;
  extendContext: (contextExtension: Partial<ContextType>) => void;
  params: {
    schema: GraphQLSchema;
    documentAST: DocumentNode;
    rules?: ReadonlyArray<ValidationRule>;
    typeInfo?: TypeInfo;
    options?: { maxErrors?: number };
  };
  addValidationRule: (rule: ValidationRule) => void;
  validateFn: OriginalValidateFn;
  setValidationFn: (newValidate: OriginalValidateFn) => void;
  setResult: (errors: readonly GraphQLError[]) => void;
};
export type AfterValidateEventPayload<ContextType> = {
  context: Readonly<ContextType>;
  extendContext: (contextExtension: Partial<ContextType>) => void;
  valid: boolean;
  result: readonly GraphQLError[];
};
export type AfterValidateHook<ContextType> = (options: AfterValidateEventPayload<ContextType>) => void;
export type OnValidateHook<ContextType> = (options: OnValidateEventPayload<ContextType>) => void | AfterValidateHook<ContextType>;

/** onContextBuilding */
export type OnContextBuildingEventPayload<ContextType> = {
  context: Readonly<ContextType>;
  extendContext: (contextExtension: Partial<ContextType>) => void;
};
export type AfterContextBuildingEventPayload<ContextType> = {
  extendContext: (contextExtension: Partial<ContextType>) => void;
  context: ContextType;
};
export type AfterContextBuildingHook<ContextType> = (
  options: AfterContextBuildingEventPayload<ContextType>
) => PromiseOrValue<void>;
export type OnContextBuildingHook<ContextType> = (
  options: OnContextBuildingEventPayload<ContextType>
) => PromiseOrValue<void | AfterContextBuildingHook<ContextType>>;

/** onExecute */
export type OriginalExecuteFn = typeof execute;
export type OnExecuteEventPayload<ContextType> = {
  executeFn: OriginalExecuteFn;
  args: ExecutionArgs;
  setExecuteFn: (newExecute: OriginalExecuteFn) => void;
  setResultAndStopExecution: (newResult: ExecutionResult) => void;
  extendContext: (contextExtension: Partial<ContextType>) => void;
};
export type OnBeforeResolverCalledEventPayload<ParentType = unknown, ArgsType = DefaultArgs, ContextType = unknown> = {
  root: ParentType;
  args: ArgsType;
  context: ContextType;
  info: GraphQLResolveInfo;
};
export type AfterResolverEventPayload = { result: unknown | Error; setResult: (newResult: unknown) => void };
export type AfterResolverHook = (options: AfterResolverEventPayload) => void;
export type OnResolverCalledHook<ParentType = unknown, ArgsType = DefaultArgs, ContextType = DefaultContext> = (
  options: OnBeforeResolverCalledEventPayload<ParentType, ArgsType, ContextType>
) => PromiseOrValue<void | AfterResolverHook>;
export type OnExecuteDoneEventPayload = { result: ExecutionResult; setResult: (newResult: ExecutionResult) => void };
export type OnExecuteDoneHook = (options: OnExecuteDoneEventPayload) => void;
export type OnExecuteHookResult<ContextType> = {
  onExecuteDone?: OnExecuteDoneHook;
  onResolverCalled?: OnResolverCalledHook<any, DefaultArgs, ContextType>;
};
export type OnExecuteHook<ContextType> = (
  options: OnExecuteEventPayload<ContextType>
) => PromiseOrValue<void | OnExecuteHookResult<ContextType>>;

/** onSubscribe */
export type OriginalSubscribeFn = typeof subscribe;
export type OnSubscribeEventPayload<ContextType> = {
  subscribeFn: OriginalSubscribeFn;
  args: SubscriptionArgs;
  setSubscribeFn: (newSubscribe: OriginalSubscribeFn) => void;
  extendContext: (contextExtension: Partial<ContextType>) => void;
};
export type OnSubscribeResultEventPayload = {
  result: AsyncIterableIterator<ExecutionResult> | ExecutionResult;
  setResult: (newResult: AsyncIterableIterator<ExecutionResult> | ExecutionResult) => void;
};
export type SubscribeResultHook = (options: OnSubscribeResultEventPayload) => void;
export type OnSubscribeHookResult<ContextType> = {
  onSubscribeResult?: SubscribeResultHook;
  onResolverCalled?: OnResolverCalledHook<ContextType>;
};
export type OnSubscribeHook<ContextType> = (
  options: OnSubscribeEventPayload<ContextType>
) => PromiseOrValue<void | OnSubscribeHookResult<ContextType>>;
