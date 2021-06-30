import { Plugin } from '@envelop/types';
import { ApolloGateway, GatewayConfig } from '@apollo/gateway';
import { getOperationAST, print } from 'graphql';
import { InMemoryLRUCache, KeyValueCache } from 'apollo-server-caching';
import { GraphQLRequestMetrics, Logger } from 'apollo-server-types';

export interface FederationConfig {
  gateway?: GatewayConfig;
  load?: Parameters<ApolloGateway['load']>[0];
  metrics?: GraphQLRequestMetrics;
  cache?: KeyValueCache;
  logger?: Logger;
}

export const useFederation = (options: FederationConfig = {}): Plugin => {
  const {
    gateway: gatewayConfig = {},
    load: loadConfig = {},
    cache = new InMemoryLRUCache(),
    logger = console,
    metrics = {},
  } = options;
  const gateway = new ApolloGateway(gatewayConfig);
  gateway.load(loadConfig);
  let schemaHash: any;
  return {
    onPluginInit({ setSchema }) {
      if (gateway.schema) {
        setSchema(gateway.schema);
      }
    },
    onSchemaChange: ({ replaceSchema }) => {
      schemaHash = Date.now().toString();
      gateway.onSchemaChange(replaceSchema);
    },
    onExecute({ args, setExecuteFn }) {
      setExecuteFn(function federationExecutor() {
        const documentStr = print(args.document);
        const operation = getOperationAST(args.document, args.operationName ?? undefined);
        if (!operation) {
          throw new Error(`Operation ${args.operationName || ''} cannot be found in ${documentStr}`);
        }
        return gateway.executor({
          document: args.document,
          request: {
            query: documentStr,
            operationName: args.operationName ?? undefined,
            variables: args.variableValues ?? undefined,
          },
          operationName: args.operationName ?? null,
          cache,
          context: args.contextValue,
          queryHash: documentStr,
          logger,
          metrics,
          source: documentStr,
          operation,
          schema: args.schema,
          schemaHash,
        });
      });
    },
  };
};
