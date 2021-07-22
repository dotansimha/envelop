import { Plugin } from '@envelop/types';
import { TracingFormat } from 'apollo-tracing';
import { GraphQLType, ResponsePath, responsePathAsArray } from 'graphql';
import isAsyncIterable from 'graphql/jsutils/isAsyncIterable';

const HR_TO_NS = 1e9;
const NS_TO_MS = 1e6;

// Not exported by `apollo-tracing`.
interface ResolverCall {
  path: ResponsePath;
  fieldName: string;
  parentType: GraphQLType;
  returnType: GraphQLType;
  startOffset: [number, number];
  endOffset?: [number, number];
}

function durationHrTimeToNanos(hrtime: [number, number]) {
  return hrtime[0] * HR_TO_NS + hrtime[1];
}

const deltaFrom = (hrtime: [number, number]): { ms: number; ns: number } => {
  const delta = process.hrtime(hrtime);
  const ns = delta[0] * HR_TO_NS + delta[1];

  return {
    ns,
    get ms() {
      return ns / NS_TO_MS;
    },
  };
};

export const useApolloTracing = (): Plugin => {
  return {
    onExecute() {
      const startTime = new Date();
      const hrtime = process.hrtime();
      const resolversTiming: ResolverCall[] = [];

      return {
        onResolverCalled: ({ info }) => {
          // Taken from https://github.com/apollographql/apollo-server/blob/main/packages/apollo-tracing/src/index.ts
          const resolverCall: ResolverCall = {
            path: info.path,
            fieldName: info.fieldName,
            parentType: info.parentType,
            returnType: info.returnType,
            startOffset: process.hrtime(hrtime),
          };

          return () => {
            resolverCall.endOffset = process.hrtime(hrtime);
            resolversTiming.push(resolverCall);
          };
        },
        onExecuteDone({ result }) {
          const endTime = new Date();

          const tracing: TracingFormat = {
            version: 1,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: deltaFrom(hrtime).ns,
            execution: {
              resolvers: resolversTiming.map(resolverCall => {
                const startOffset = durationHrTimeToNanos(resolverCall.startOffset);
                const duration = resolverCall.endOffset ? durationHrTimeToNanos(resolverCall.endOffset) - startOffset : 0;

                return {
                  path: [...responsePathAsArray(resolverCall.path)],
                  parentType: resolverCall.parentType.toString(),
                  fieldName: resolverCall.fieldName,
                  returnType: resolverCall.returnType.toString(),
                  startOffset,
                  duration,
                };
              }),
            },
          };

          if (!isAsyncIterable(result)) {
            result.extensions = result.extensions || {};
            result.extensions.tracing = tracing;
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              `Plugin "apollo-tracing" encountered a AsyncIterator which is not supported yet, so tracing data is not available for the operation.`
            );
          }
        },
      };
    },
  };
};
