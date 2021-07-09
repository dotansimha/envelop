import { Plugin } from '@envelop/types';

export type ContextFactoryFn<TResult = unknown> = (currentContext: unknown) => TResult | Promise<TResult>;

type UnwrapAsync<T> = T extends Promise<infer U> ? U : T;

export const useExtendContext = <TContextFactory extends (...args: any[]) => any>(
  contextFactory: TContextFactory
): Plugin<UnwrapAsync<ReturnType<TContextFactory>>> => ({
  async onContextBuilding({ context, extendContext }) {
    extendContext((await contextFactory(context)) as UnwrapAsync<ReturnType<TContextFactory>>);
  },
});
