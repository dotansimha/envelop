import { Plugin } from '@envelop/types';
import { print } from 'graphql';
import { NoLiveMixedWithDeferStreamRule, GraphQLLiveDirective } from '@n1ru4l/graphql-live-query';
import type { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { astFromDirective } from '@graphql-tools/utils';

export type UseLiveQueryOptions = {
  liveQueryStore: InMemoryLiveQueryStore;
};

export { GraphQLLiveDirective };
export const GraphQLLiveDirectiveAST = astFromDirective(GraphQLLiveDirective);
export const GraphQLLiveDirectiveSDL = print(GraphQLLiveDirectiveAST);

export const useLiveQuery = (opts: UseLiveQueryOptions): Plugin => {
  return {
    onExecute: ({ executeFn, setExecuteFn }) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore  execute typings do not include AsyncIterable return right now
      setExecuteFn(opts.liveQueryStore.makeExecute(executeFn));
    },
    onValidate: ({ addValidationRule }) => {
      addValidationRule(NoLiveMixedWithDeferStreamRule);
    },
    onContextBuilding: ({ extendContext }) => {
      extendContext({
        liveQueryStore: opts.liveQueryStore,
      });
    },
  };
};
