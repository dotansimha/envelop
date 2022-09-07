import { Plugin, ExecutionResult } from '@envelop/types';
import { handleStreamOrSingleExecutionResult } from '../utils.js';

export const DEFAULT_ERROR_MESSAGE = 'Unexpected error.';

export type MaskError = (error: unknown, message: string) => Error;

export type SerializableGraphQLErrorLike = Error & {
  name: 'GraphQLError';
  toJSON(): { message: string };
  extensions?: Record<string, unknown>;
};

export function isGraphQLError(error: unknown): error is Error & { originalError?: Error } {
  return error instanceof Error && error.name === 'GraphQLError';
}

function createSerializableGraphQLError(
  message: string,
  originalError: unknown,
  isDev: boolean
): SerializableGraphQLErrorLike {
  const error = new Error(message) as SerializableGraphQLErrorLike;
  error.name = 'GraphQLError';
  if (isDev) {
    const extensions =
      originalError instanceof Error
        ? { message: originalError.message, stack: originalError.stack }
        : { message: String(originalError) };

    Object.defineProperty(error, 'extensions', {
      get() {
        return extensions;
      },
    });
  }

  Object.defineProperty(error, 'toJSON', {
    value() {
      return {
        message: error.message,
        extensions: error.extensions,
      };
    },
  });

  return error as SerializableGraphQLErrorLike;
}

export const createDefaultMaskError =
  (isDev: boolean): MaskError =>
  (error, message) => {
    if (isGraphQLError(error)) {
      if (error?.originalError) {
        if (isGraphQLError(error.originalError)) {
          return error;
        }
        return createSerializableGraphQLError(message, error, isDev);
      }
      return error;
    }
    return createSerializableGraphQLError(message, error, isDev);
  };

const isDev = globalThis.process?.env?.NODE_ENV === 'development';

export const defaultMaskError: MaskError = createDefaultMaskError(isDev);

export type UseMaskedErrorsOpts = {
  /** The function used for identify and mask errors. */
  maskError?: MaskError;
  /** The error message that shall be used for masked errors. */
  errorMessage?: string;
};

const makeHandleResult =
  (maskError: MaskError, message: string) =>
  ({ result, setResult }: { result: ExecutionResult; setResult: (result: ExecutionResult) => void }) => {
    if (result.errors != null) {
      setResult({ ...result, errors: result.errors.map(error => maskError(error, message)) });
    }
  };

export const useMaskedErrors = (opts?: UseMaskedErrorsOpts): Plugin => {
  const maskError = opts?.maskError ?? defaultMaskError;
  const message = opts?.errorMessage || DEFAULT_ERROR_MESSAGE;
  const handleResult = makeHandleResult(maskError, message);

  return {
    onPluginInit(context) {
      context.registerContextErrorHandler(({ error, setError }) => {
        setError(maskError(error, message));
      });
    },
    onExecute() {
      return {
        onExecuteDone(payload) {
          return handleStreamOrSingleExecutionResult(payload, handleResult);
        },
      };
    },
    onSubscribe() {
      return {
        onSubscribeResult(payload) {
          return handleStreamOrSingleExecutionResult(payload, handleResult);
        },
        onSubscribeError({ error, setError }) {
          setError(maskError(error, message));
        },
      };
    },
  };
};
