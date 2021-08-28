import { Plugin, isAsyncIterable, Maybe, DefaultContext } from '@envelop/types';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { createHash } from 'crypto';
import {
  DocumentNode,
  OperationDefinitionNode,
  visit,
  TypeInfo,
  visitWithTypeInfo,
  GraphQLSchema,
  defaultFieldResolver,
  ExecutionArgs,
} from 'graphql';
import type { Cache, CacheEntityRecord } from './cache';
import { createInMemoryCache } from './in-memory-cache';

const contextSymbol = Symbol('responseCache');
const rawDocumentStringSymbol = Symbol('rawDocumentString');

type Context = {
  identifier: Map<string, CacheEntityRecord>;
  types: Set<string>;
  ttl: number;
  ttlPerType: Record<string, number>;
  ignoredTypesMap: Set<string>;
  skip: boolean;
};

/**
 * Function for building the response cache key based on the input parameters
 */
export type BuildResponseCacheKeyFunction = (params: {
  /** Raw document string as sent from the client. */
  documentString: string;
  /** Variable values as sent form the client. */
  variableValues: ExecutionArgs['variableValues'];
  /** optional sessionId for make unique cache keys based on the session.  */
  sessionId?: Maybe<string>;
}) => string;

export type GetDocumentStringFromContextFunction = (params: DefaultContext) => Maybe<string>;

export type UseResponseCacheParameter<C = any> = {
  cache?: Cache;
  /**
   * Maximum age in ms. Defaults to `Infinity`.
   */
  ttl?: number;
  /**
   * Overwrite the ttl for query operations whose execution result contains a specific object type.
   * Useful if the occurrence of a object time in the execution result should reduce the ttl of the query operation.
   */
  ttlPerType?: Record<string, number>;
  /**
   * Overwrite the ttl for query operations whose selection contains a specific schema coordinate (e.g. Query.users).
   * Useful if the selection of a specific field should reduce the TTL of the query operation.
   */
  ttlPerSchemaCoordinate?: Record<string, number>;
  /**
   * Allows to cache responses based on the resolved session id.
   * Return a unique value for each session.
   * Return `null` or `undefined` to mark the session as public/global.
   * Creates a global session by default.
   * @param context GraphQL Context
   */
  session?(context: C): string | undefined | null;
  /**
   * Specify whether the cache should be used based on the context.
   * By default any request uses the cache.
   */
  enabled?(context: C): boolean;
  /**
   * Skip caching of following the types.
   */
  ignoredTypes?: string[];
  /**
   * List of fields that are used to identify a entity.
   * Defaults to `["id"]`
   */
  idFields?: Array<string>;
  /**
   * Whether the mutation execution result should be used for invalidating resources.
   * Defaults to `true`
   */
  invalidateViaMutation?: boolean;
  /**
   * Customize the behavior how the response cache key is computed from the document, variable values and sessionId.
   * Defaults to `defaultBuildResponseCacheKey`
   */
  buildResponseCacheKey?: BuildResponseCacheKeyFunction;
  /**
   * Function used for reading the document string that is used for building the response cache key from the context object.
   * By default, the useResponseCache plugin hooks into onParse and writes the original operation string to the context.
   * If you are hard overriding parse you need to set this function, otherwise responses will not be cached or served from the cache.
   * Defaults to `defaultGetDocumentStringFromContext`
   */
  getDocumentStringFromContext?: GetDocumentStringFromContextFunction;
};

/**
 * Default function used for building the response cache key.
 * It is exported here for advanced use-cases. E.g. if you want to short circuit and serve responses from the cache on a global level in order to completely by-pass the GraphQL flow.
 */
export const defaultBuildResponseCacheKey: BuildResponseCacheKeyFunction = params =>
  createHash('sha1')
    .update([params.documentString, JSON.stringify(params.variableValues ?? {}), params.sessionId ?? ''].join('|'))
    .digest('base64');

export const defaultGetDocumentStringFromContext: GetDocumentStringFromContextFunction = context =>
  context[rawDocumentStringSymbol as any] as any;

export function useResponseCache({
  cache = createInMemoryCache(),
  ttl = Infinity,
  session = () => null,
  enabled,
  ignoredTypes = [],
  ttlPerType = {},
  ttlPerSchemaCoordinate,
  idFields = ['id'],
  invalidateViaMutation = true,
  buildResponseCacheKey = defaultBuildResponseCacheKey,
  getDocumentStringFromContext = defaultGetDocumentStringFromContext,
}: UseResponseCacheParameter = {}): Plugin {
  const ignoredTypesMap = new Set<string>(ignoredTypes);
  const schemaCache = new WeakMap<GraphQLSchema, GraphQLSchema>();

  return {
    onSchemaChange(ctx) {
      let schema = schemaCache.get(ctx.schema);
      if (schema == null) {
        schema = applyResponseCacheLogic(ctx.schema, idFields);
        schemaCache.set(ctx.schema, schema);
      }
      ctx.replaceSchema(schema);
    },
    onParse(parseCtx) {
      return function onParseEnd(ctx) {
        if (ctx.result && 'kind' in ctx.result) {
          const source = parseCtx.params.source;
          const rawDocumentString = typeof source === 'string' ? source : source.body;
          ctx.extendContext({
            [rawDocumentStringSymbol]: rawDocumentString,
          });
        }
      };
    },
    async onExecute(ctx) {
      const identifier = new Map<string, CacheEntityRecord>();
      const types = new Set<string>();

      const context: Context = {
        identifier,
        types,
        ttl,
        ttlPerType,
        ignoredTypesMap,
        skip: false,
      };

      ctx.extendContext({
        [contextSymbol]: context,
      });

      if (isMutation(ctx.args.document)) {
        if (invalidateViaMutation === false) {
          return;
        }

        return {
          onExecuteDone({ result }) {
            if (isAsyncIterable(result)) {
              // eslint-disable-next-line no-console
              console.warn('[useResponseCache] AsyncIterable returned from execute is currently unsupported.');
              return;
            }

            cache.invalidate(context.identifier.values());
          },
        };
      } else {
        const documentString = getDocumentStringFromContext(ctx.args.contextValue);
        if (documentString != null) {
          const operationId = buildResponseCacheKey({
            documentString,
            variableValues: ctx.args.variableValues,
            sessionId: session(ctx.args.contextValue),
          });

          if ((enabled?.(ctx.args.contextValue) ?? true) === true) {
            const cachedResponse = await cache.get(operationId);

            if (cachedResponse != null) {
              ctx.setResultAndStopExecution(cachedResponse);
              return;
            }
          }

          if (ttlPerSchemaCoordinate) {
            const typeInfo = new TypeInfo(ctx.args.schema);
            visit(
              ctx.args.document,
              visitWithTypeInfo(typeInfo, {
                Field(fieldNode) {
                  const parentType = typeInfo.getParentType();
                  if (parentType) {
                    const schemaCoordinate = `${parentType.name}.${fieldNode.name.value}`;
                    if (schemaCoordinate in ttlPerSchemaCoordinate) {
                      context.ttl = Math.min(context.ttl, ttlPerSchemaCoordinate[schemaCoordinate]);
                    }
                  }
                },
              })
            );
          }

          return {
            onExecuteDone({ result }) {
              if (isAsyncIterable(result)) {
                // eslint-disable-next-line no-console
                console.warn('[useResponseCache] AsyncIterable returned from execute is currently unsupported.');
                return;
              }

              if (context.skip) {
                return;
              }

              cache.set(operationId, result, identifier.values(), context.ttl);
            },
          };
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            `[useResponseCache] Failed extracting document string from the context. The response will not be cached or served from the cache. ` +
              `If you are overriding the 'parse' behavior make sure to pass a custom 'getDocumentStringFromContext' function for getting the document string, which is required for building the response cache key.`
          );
          return undefined;
        }
      }
    },
  };
}

function isOperationDefinition(node: any): node is OperationDefinitionNode {
  return node?.kind === 'OperationDefinition';
}

function isMutation(doc: DocumentNode) {
  return doc.definitions.find(isOperationDefinition)!.operation === 'mutation';
}

function runWith<T>(input: T | Promise<T>, callback: (value: T) => void) {
  if (input instanceof Promise) {
    input.then(callback, () => undefined);
  } else {
    callback(input);
  }
}

function applyResponseCacheLogic(schema: GraphQLSchema, idFieldNames: Array<string>): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig, fieldName, typename) {
      if (idFieldNames.includes(fieldName)) {
        return {
          ...fieldConfig,
          resolve(src, args, context, info) {
            const result = (fieldConfig.resolve ?? defaultFieldResolver)(src, args, context, info);
            // result must be of type string
            runWith(result, id => {
              if (contextSymbol in context) {
                const ctx: Context = context[contextSymbol];
                if (ctx.ignoredTypesMap.has(typename)) {
                  ctx.skip = true;
                }
                if (ctx.skip === true) {
                  ctx.skip = true;
                  return;
                }
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore  TODO: investigate what to do if id is something unexpected
                ctx.identifier.set(`${typename}:${id}`, { typename, id });
                ctx.types.add(typename);
                if (typename in ctx.ttlPerType) {
                  ctx.ttl = Math.min(ctx.ttl, ctx.ttlPerType[typename]);
                }
              }
            });
            return result;
          },
        };
      }

      return fieldConfig;
    },
  });
}
