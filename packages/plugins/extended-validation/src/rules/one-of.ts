import { ArgumentNode, GraphQLError, GraphQLInputObjectType, GraphQLInputType, isListType, ValidationContext } from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { ExtendedValidationRule, getDirectiveFromAstNode, unwrapType } from '../common';

export const ONE_OF_DIRECTIVE_SDL = /* GraphQL */ `
  directive @oneOf on INPUT_OBJECT | FIELD_DEFINITION
`;

type VariableValue = null | undefined | string | number | VariableValue[] | { [key: string]: VariableValue };

export const OneOfInputObjectsRule: ExtendedValidationRule = (validationContext, executionArgs) => {
  return {
    Field: node => {
      if (node.arguments?.length) {
        const fieldType = validationContext.getFieldDef();

        if (!fieldType) {
          return;
        }

        const values = getArgumentValues(fieldType, node, executionArgs.variableValues);

        if (fieldType) {
          const isOneOfFieldType =
            fieldType.extensions?.oneOf || (fieldType.astNode && getDirectiveFromAstNode(fieldType.astNode, 'oneOf'));

          if (isOneOfFieldType) {
            if (Object.keys(values).length !== 1) {
              validationContext.reportError(
                new GraphQLError(
                  `Exactly one key must be specified for input for field "${fieldType.type.toString()}.${node.name.value}"`,
                  [node]
                )
              );
            }
          }
        }

        for (const arg of node.arguments) {
          const argType = fieldType.args.find(typeArg => typeArg.name === arg.name.value);

          if (argType) {
            traverseVariables(validationContext, arg, argType.type, values[arg.name.value] as VariableValue);
          }
        }
      }
    },
  };
};

function traverseVariables(
  validationContext: ValidationContext,
  arg: ArgumentNode,
  graphqlType: GraphQLInputType,
  currentValue: VariableValue
) {
  // if the current value is empty we don't need to traverse deeper
  // if it shouldn't be empty, the "original" validation phase should complain.
  if (currentValue == null) {
    return;
  }

  if (isListType(graphqlType)) {
    if (!Array.isArray(currentValue)) {
      // because of graphql type coercion a single object should be treated as an array of one object
      currentValue = [currentValue];
    }
    currentValue.forEach(value => {
      traverseVariables(validationContext, arg, graphqlType.ofType, value);
    });
    return;
  }

  if (typeof currentValue !== 'object' || currentValue == null) {
    // in case the value is not an object, the "original" validation phase should complain.
    return;
  }

  const inputType = unwrapType(graphqlType);
  const isOneOfInputType =
    inputType.extensions?.oneOf || (inputType.astNode && getDirectiveFromAstNode(inputType.astNode, 'oneOf'));

  if (isOneOfInputType) {
    if (Object.keys(currentValue).length !== 1) {
      validationContext.reportError(
        new GraphQLError(`Exactly one key must be specified for input type "${inputType.name}"`, [arg])
      );
    }
  }

  if (inputType instanceof GraphQLInputObjectType) {
    for (const [name, fieldConfig] of Object.entries(inputType.getFields())) {
      traverseVariables(validationContext, arg, fieldConfig.type, currentValue[name]);
    }
  }
}
