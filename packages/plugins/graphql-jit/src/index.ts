/* eslint-disable no-console */
import { Plugin, TypedExecutionArgs } from '@envelop/types';
import { DocumentNode, Source, ExecutionArgs, ExecutionResult } from 'graphql';
import { compileQuery, isCompiledQuery, CompilerOptions, CompiledQuery } from 'graphql-jit';
import lru from 'tiny-lru';

const DEFAULT_MAX = 1000;
const DEFAULT_TTL = 3600000;

export const useGraphQlJit = (
  compilerOptions: Partial<CompilerOptions> = {},
  pluginOptions: {
    /**
     * A helper function that helps to conditionally enable JIT based on incoming request
     */
    enableIf?: (executionArgs: ExecutionArgs) => boolean | Promise<boolean>;
    /**
     * Callback triggered in case of GraphQL Jit compilation error.
     */
    onError?: (r: ExecutionResult) => void;
    /**
     * Maximum size of LRU Cache
     * @default 1000
     */
    max?: number;
    /**
     * TTL in milliseconds
     * @default 3600000
     */
    ttl?: number;
  } = {}
): Plugin => {
  const max = typeof pluginOptions.max === 'number' ? pluginOptions.max : DEFAULT_MAX;
  const ttl = typeof pluginOptions.ttl === 'number' ? pluginOptions.ttl : DEFAULT_TTL;

  const documentSourceMap = new WeakMap<DocumentNode, string>();
  type JITCacheEntry = {
    query: CompiledQuery['query'];
    subscribe?: CompiledQuery['subscribe'];
  };
  const jitCache = lru<JITCacheEntry>(max, ttl);

  function getCacheEntry<T>(args: TypedExecutionArgs<T>): JITCacheEntry {
    let cacheEntry: JITCacheEntry | undefined;
    const documentSource = documentSourceMap.get(args.document);

    if (documentSource) {
      cacheEntry = jitCache.get(documentSource);
    }

    if (!cacheEntry) {
      const compilationResult = compileQuery(args.schema, args.document, args.operationName ?? undefined, compilerOptions);

      if (!isCompiledQuery(compilationResult)) {
        if (pluginOptions?.onError) {
          pluginOptions.onError(compilationResult);
        } else {
          console.error(compilationResult);
        }
        cacheEntry = {
          query: () => compilationResult,
        };
      } else {
        cacheEntry = compilationResult;
      }

      if (documentSource) {
        jitCache.set(documentSource, cacheEntry);
      }
    }
    return cacheEntry;
  }

  return {
    onParse({ params: { source } }) {
      const key = source instanceof Source ? source.body : source;

      return ({ result }) => {
        if (!result || result instanceof Error) return;

        documentSourceMap.set(result, key);
      };
    },
    async onExecute({ args, setExecuteFn }) {
      if (!pluginOptions.enableIf || (pluginOptions.enableIf && (await pluginOptions.enableIf(args)))) {
        setExecuteFn(function jitExecutor() {
          const cacheEntry = getCacheEntry(args);

          return cacheEntry.query(args.rootValue, args.contextValue, args.variableValues);
        });
      }
    },
    async onSubscribe({ args, setSubscribeFn }) {
      if (!pluginOptions.enableIf || (pluginOptions.enableIf && (await pluginOptions.enableIf(args)))) {
        setSubscribeFn(async function jitSubscriber() {
          const cacheEntry = getCacheEntry(args);

          return cacheEntry.subscribe
            ? (cacheEntry.subscribe(args.rootValue, args.contextValue, args.variableValues) as any)
            : cacheEntry.query(args.rootValue, args.contextValue, args.variableValues);
        });
      }
    },
  };
};
