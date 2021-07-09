import { NoSchemaIntrospectionCustomRule } from 'graphql';
import { Plugin, DefaultContext } from '@envelop/types';

export interface DisableIntrospectionOptions {
  disableIf?: (args: { context: DefaultContext; params: Parameters<NonNullable<Plugin['onValidate']>>[0]['params'] }) => boolean;
}

export const useDisableIntrospection = (options?: DisableIntrospectionOptions): Plugin => {
  const disableIf = options?.disableIf;
  return {
    onValidate: disableIf
      ? ({ addValidationRule, context, params }) => {
          if (disableIf({ context, params })) {
            addValidationRule(NoSchemaIntrospectionCustomRule);
          }
        }
      : ({ addValidationRule }) => {
          addValidationRule(NoSchemaIntrospectionCustomRule);
        },
  };
};
