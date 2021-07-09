import { GetEnvelopedFn } from 'packages/core/src';
import { Plugin } from './plugin';
import { Spread, TuplifyUnion, Unarray } from './utils';

// We are using `interface` instead of `type` in order to allow type augmentation
export interface DefaultContext extends Record<string | symbol | number, unknown> {}

export type ComposeContextArray<V extends unknown> = V extends []
  ? []
  : V extends [Plugin<infer Ctx>]
  ? [Ctx]
  : V extends [Plugin<infer Ctx>, ...infer R]
  ? [Ctx, ...ComposeContextArray<R>]
  : [{ error: 'ComposeContextArray-no-match'; value: V }];

export type ComposeContext<V extends Plugin[]> = Spread<ComposeContextArray<TuplifyUnion<Unarray<V>>>>;
export type ContextFrom<TEnvelop> = TEnvelop extends GetEnvelopedFn<infer Context> ? Context : never;
