/* eslint-disable no-console */
import { DefaultContext, Plugin } from '@envelop/types';
import DataLoader from 'dataloader';

export const useDataLoader = <TName extends string, Key, Value, CacheKey = Key, Context = DefaultContext>(
  name: TName,
  builderFn: (context: Context) => DataLoader<Key, Value, CacheKey>
): Plugin<
  {
    [K in TName]: DataLoader<Key, Value, CacheKey>;
  }
> => {
  return {
    onContextBuilding({ context, extendContext }) {
      extendContext({
        [name]: builderFn(context as any as Context),
      } as any as { [K in TName]: DataLoader<Key, Value, CacheKey> });
    },
  };
};
