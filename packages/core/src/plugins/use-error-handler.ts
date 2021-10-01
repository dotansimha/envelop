import { Plugin, handleStreamOrSingleExecutionResult, DefaultContext, TypedExecutionArgs } from '@envelop/types';
import { ExecutionResult, GraphQLError } from 'graphql';

export type ErrorHandler = (errors: readonly GraphQLError[], context: Readonly<DefaultContext>) => void;

type ErrorHandlerCallback<ContextType> = {
  result: ExecutionResult;
  args: TypedExecutionArgs<ContextType>;
};

const makeHandleResult =
  <ContextType>(errorHandler: ErrorHandler) =>
  ({ result, args }: ErrorHandlerCallback<ContextType>) => {
    if (result.errors?.length) {
      errorHandler(result.errors, args);
    }
  };

export const useErrorHandler = <ContextType = DefaultContext>(errorHandler: ErrorHandler): Plugin<ContextType> => ({
  onExecute() {
    const handleResult = makeHandleResult<ContextType>(errorHandler);
    return {
      onExecuteDone(payload) {
        return handleStreamOrSingleExecutionResult(payload, handleResult);
      },
    };
  },
});
