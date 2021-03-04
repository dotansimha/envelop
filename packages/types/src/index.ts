import {
  DocumentNode,
  GraphQLSchema,
  Source,
  ParseOptions,
  GraphQLError,
  execute,
  parse,
  validate,
  GraphQLResolveInfo,
  ExecutionArgs,
  ExecutionResult,
  ValidationRule,
  TypeInfo,
} from 'graphql';

type AfterFnOrVoid<Result> = void | ((afterOptions: Result) => void);

export type BeforeAfterHook<BeforePayload, AfterPayload = unknown, Async = false> = (
  beforeOptions: BeforePayload
) => Async extends true ? Promise<AfterFnOrVoid<AfterPayload>> | AfterFnOrVoid<AfterPayload> : AfterFnOrVoid<AfterPayload>;

export type OnResolverCalledHooks = BeforeAfterHook<
  {
    root: unknown;
    args: unknown;
    context: unknown;
    info: GraphQLResolveInfo;
  },
  { result: unknown | Error },
  true
>;

export type OnExecuteHookResult = {
  onExecuteDone?: (options: { result: ExecutionResult }) => void;
  onResolverCalled?: OnResolverCalledHooks;
};

export type DefaultContext = Record<string, unknown>;
export interface Plugin<PluginContext = DefaultContext> {
  onSchemaChange?: (options: { schema: GraphQLSchema }) => void;
  onPluginInit?: (options: { setSchema: (newSchema: GraphQLSchema) => void }) => void;
  onRequest?: BeforeAfterHook<
    {
      requestContext: unknown;
    },
    {}
  >;
  onExecute?: (options: {
    executeFn: typeof execute;
    args: ExecutionArgs;
    setExecuteFn: (newExecute: typeof execute) => void;
    extendContext: (contextExtension: Partial<PluginContext>) => void;
  }) => void | Promise<void> | OnExecuteHookResult | Promise<OnExecuteHookResult>;
  onParse?: BeforeAfterHook<
    {
      params: { source: string | Source; options?: ParseOptions };
      parseFn: typeof parse;
      setParseFn: (newFn: typeof parse) => void;
      setParsedDocument: (doc: DocumentNode) => void;
    },
    {
      result: DocumentNode | Error;
      replaceParseResult: (newResult: DocumentNode | Error) => void;
    },
    false
  >;
  onValidate?: BeforeAfterHook<
    {
      params: {
        schema: GraphQLSchema;
        documentAST: DocumentNode;
        rules?: ReadonlyArray<ValidationRule>;
        typeInfo?: TypeInfo;
        options?: { maxErrors?: number };
      };
      addValidationRule: (rule: ValidationRule) => void;
      validateFn: typeof validate;
      setValidationFn: (newValidate: typeof validate) => void;
      setResult: (errors: readonly GraphQLError[]) => void;
    },
    {
      valid: boolean;
      result: readonly GraphQLError[];
    }
  >;
  onContextBuilding?: BeforeAfterHook<
    {
      context: Readonly<PluginContext>;
      extendContext: (contextExtension: Partial<PluginContext>) => void;
    },
    {
      context: PluginContext;
    },
    true
  >;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type AfterCallback<T extends keyof Plugin> = Plugin[T] extends BeforeAfterHook<infer B, infer A, infer Async> ? (afterOptions: A) => void : never;

export type GraphQLServerOptions<RequestContext = unknown> = (
  requestContext: RequestContext
) => {
  dispose: () => void;
  execute: typeof execute;
  // subscribe: typeof subscribe;
  validate: typeof validate;
  parse: typeof parse;
  contextFactory: (requestContext: RequestContext) => unknown | Promise<unknown>;
  // rootValueFactory: (executionParams: ExecutionParams) => RootValue | Promise<RootValue>;
  schema: GraphQLSchema;
};
