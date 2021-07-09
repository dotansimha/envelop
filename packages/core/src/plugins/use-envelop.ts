import { GetEnvelopedFn, Plugin } from '@envelop/types';

export const useEnvelop = (envelop: GetEnvelopedFn<any>): Plugin<any> => {
  return {
    onPluginInit({ addPlugin }) {
      for (const plugin of envelop._plugins) {
        addPlugin(plugin);
      }
    },
  };
};
