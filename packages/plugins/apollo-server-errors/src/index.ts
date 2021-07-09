import { Plugin } from '@envelop/types';
import { formatApolloErrors } from 'apollo-server-errors';

export const useApolloServerErrors = (options: Parameters<typeof formatApolloErrors>[1] = {}): Plugin => {
  return {
    onExecute() {
      return {
        onExecuteDone({ result, setResult }) {
          if (result.errors && result.errors.length > 0) {
            setResult({
              ...result,
              errors: formatApolloErrors(result.errors, {
                debug: options.debug,
                formatter: options.formatter,
              }),
            });
          }
        },
      };
    },
  };
};
