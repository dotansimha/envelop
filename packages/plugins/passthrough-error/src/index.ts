import { Plugin } from '@envelop/types';
import { GraphQLError } from 'graphql';

const shortCircuteSymbol = Symbol('shortCircuteSymbol');

export const useErrorPassthrough = (): Plugin<{
  [shortCircuteSymbol]?: Error;
}> => ({
  onParse({ extendContext }) {
    return ({ result, replaceParseResult }) => {
      if (result instanceof Error) {
        extendContext({
          [shortCircuteSymbol]: result,
        });

        // Probably this is needed as well
        // replaceParseResult(null);
      }
    };
  },
  // onValidate should just passthrough as well
  // Maybe we need to hook into onContextBuilding as well?
  // And stop the flow there? Just to make sure we don't run if it not needed?
  onExecute({ args, setResultAndStopExecution }) {
    if (args.contextValue[shortCircuteSymbol]) {
      setResultAndStopExecution({
        data: undefined,
        errors: [
          args.contextValue[shortCircuteSymbol] instanceof GraphQLError
            ? args.contextValue[shortCircuteSymbol]
            : new GraphQLError(args.contextValue[shortCircuteSymbol].message),
        ],
      });
    }
  },
});
