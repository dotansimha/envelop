import { Plugin } from '@envelop/types';
import { GraphQLError, TypeInfo, ValidationContext, visit, visitInParallel, visitWithTypeInfo } from 'graphql';
import { ExtendedValidationRule } from './common';

const SYMBOL_EXTENDED_VALIDATION_RULES = Symbol('SYMBOL_EXTENDED_VALIDATION_RULES');

export const useExtendedValidation = (options: { rules: ExtendedValidationRule[] }): Plugin => {
  let schemaTypeInfo: TypeInfo;

  return {
    onSchemaChange({ schema }) {
      schemaTypeInfo = new TypeInfo(schema);
    },
    onParse({ context, extendContext }) {
      const rules: ExtendedValidationRule[] = (context as any)?.[SYMBOL_EXTENDED_VALIDATION_RULES] ?? [];
      rules.push(...options.rules);
      extendContext({
        [SYMBOL_EXTENDED_VALIDATION_RULES]: rules,
      });
    },
    onExecute({ args, setResultAndStopExecution }) {
      const rules: ExtendedValidationRule[] = args.contextValue[SYMBOL_EXTENDED_VALIDATION_RULES];
      const errors: GraphQLError[] = [];
      const typeInfo = schemaTypeInfo || new TypeInfo(args.schema);
      const validationContext = new ValidationContext(args.schema, args.document, typeInfo, e => {
        errors.push(e);
      });

      const visitor = visitInParallel(rules.map(rule => rule(validationContext, args)));
      visit(args.document, visitWithTypeInfo(typeInfo, visitor));

      for (const rule of rules) {
        rule(validationContext, args);
      }

      if (errors.length > 0) {
        return setResultAndStopExecution({
          data: null,
          errors,
        });
      }
    },
  };
};
