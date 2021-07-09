import { Plugin } from './plugin';
import { GraphQLSchema } from 'graphql';
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';
import { OriginalExecuteFn, OriginalParseFn, OriginalSubscribeFn, OriginalValidateFn } from './hooks';
import { ArbitraryObject, Spread } from './utils';
export { ArbitraryObject } from './utils';

export type EnvelopContextFnWrapper<TFunction extends Function, ContextType = unknown> = (context: ContextType) => TFunction;

export type GetEnvelopedFn<PluginsContext> = {
  <InitialContext extends ArbitraryObject>(initialContext?: InitialContext): {
    execute: OriginalExecuteFn;
    validate: OriginalValidateFn;
    subscribe: OriginalSubscribeFn;
    parse: OriginalParseFn;
    contextFactory: <ContextExtension>(
      contextExtension?: ContextExtension
    ) => PromiseOrValue<Spread<[InitialContext, PluginsContext, ContextExtension]>>;
    schema: GraphQLSchema;
  };
  _plugins: Plugin[];
};
