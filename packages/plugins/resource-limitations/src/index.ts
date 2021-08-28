import { handleStreamOrSingleExecutionResult, Plugin } from '@envelop/types';
import { ExtendedValidationRule, useExtendedValidation } from '@envelop/extended-validation';
import {
  ExecutionArgs,
  ExecutionResult,
  FieldNode,
  GraphQLError,
  GraphQLField,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLType,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values.js';

const getWrappedType = (graphqlType: GraphQLType): Exclude<GraphQLType, GraphQLList<any> | GraphQLNonNull<any>> => {
  if (graphqlType instanceof GraphQLList || graphqlType instanceof GraphQLNonNull) {
    return getWrappedType(graphqlType.ofType);
  }
  return graphqlType;
};

const hasFieldDefConnectionArgs = (field: GraphQLField<any, any>) => {
  let hasFirst = false;
  let hasLast = false;
  for (const arg of field.args) {
    if (arg.name === 'first' && arg.type === GraphQLInt) {
      hasFirst = true;
    } else if (arg.name === 'last' && arg.type === GraphQLInt) {
      hasLast = true;
    } else if (hasLast && hasFirst) {
      break;
    }
  }
  return { hasFirst, hasLast };
};

const buildMissingPaginationFieldErrorMessage = (params: { fieldName: string; hasFirst: boolean; hasLast: boolean }) =>
  `Missing pagination argument for field '${params.fieldName}'. ` +
  `Please provide ` +
  (params.hasFirst && params.hasLast ? "either the 'first' or 'last'" : params.hasFirst ? "the 'first'" : "the 'last'") +
  ' field argument.';

const buildInvalidPaginationRangeErrorMessage = (params: { fieldName: string; argumentName: string }) =>
  `Invalid pagination argument for field ${params.fieldName}. ` +
  `The value for the '${params.argumentName}' argument must be an integer within 1-100.`;

export const defaultNodeCostLimit = 500000;

export type ResourceLimitationValidationRuleParams = {
  nodeCostLimit: number;
  reportNodeCost?: (cost: number, executionArgs: ExecutionArgs) => void;
};

/**
 * Validate whether a user is allowed to execute a certain GraphQL operation.
 */
export const ResourceLimitationValidationRule =
  (params: ResourceLimitationValidationRuleParams): ExtendedValidationRule =>
  (context, executionArgs) => {
    const nodeCostStack: Array<number> = [];
    let totalNodeCost = 0;

    const connectionFieldMap = new WeakSet<FieldNode>();

    return {
      Field: {
        enter(fieldNode) {
          const fieldDef = context.getFieldDef();

          // if it is not found the query is invalid and graphql validation will complain
          if (fieldDef != null) {
            const argumentValues = getArgumentValues(fieldDef, fieldNode, executionArgs.variableValues);
            const type = getWrappedType(fieldDef.type);
            if (type instanceof GraphQLObjectType && type.name.endsWith('Connection')) {
              let nodeCost = 1;
              connectionFieldMap.add(fieldNode);

              const { hasFirst, hasLast } = hasFieldDefConnectionArgs(fieldDef);
              if (hasFirst === false && hasLast === false) {
                // eslint-disable-next-line no-console
                console.warn('Encountered paginated field without pagination arguments.');
              } else if (hasFirst === true || hasLast === true) {
                if ('first' in argumentValues === false && 'last' in argumentValues === false) {
                  context.reportError(
                    new GraphQLError(
                      buildMissingPaginationFieldErrorMessage({
                        fieldName: fieldDef.name,
                        hasFirst,
                        hasLast,
                      }),
                      fieldNode
                    )
                  );
                } else if ('first' in argumentValues === true && 'last' in argumentValues === false) {
                  // eslint-disable-next-line dot-notation
                  if ((argumentValues['first'] as number) < 1 || (argumentValues['first'] as number) > 100) {
                    context.reportError(
                      new GraphQLError(
                        buildInvalidPaginationRangeErrorMessage({
                          fieldName: fieldDef.name,
                          argumentName: 'first',
                        }),
                        fieldNode
                      )
                    );
                  } else {
                    // eslint-disable-next-line dot-notation
                    nodeCost = argumentValues['first'] as number;
                  }
                } else if ('last' in argumentValues === true && 'false' in argumentValues === false) {
                  // eslint-disable-next-line dot-notation
                  if ((argumentValues['last'] as number) < 1 || (argumentValues['last'] as number) > 100) {
                    context.reportError(
                      new GraphQLError(
                        buildInvalidPaginationRangeErrorMessage({
                          fieldName: fieldDef.name,
                          argumentName: 'last',
                        }),
                        fieldNode
                      )
                    );
                  } else {
                    // eslint-disable-next-line dot-notation
                    nodeCost = argumentValues['last'] as number;
                  }
                } else {
                  context.reportError(
                    new GraphQLError(
                      buildMissingPaginationFieldErrorMessage({
                        fieldName: fieldDef.name,
                        hasFirst,
                        hasLast,
                      }),
                      fieldNode
                    )
                  );
                }
              }

              nodeCostStack.push(nodeCost);
            }
          }
        },
        leave(node) {
          if (connectionFieldMap.delete(node)) {
            totalNodeCost = totalNodeCost + nodeCostStack.reduce((a, b) => a * b, 1);
            nodeCostStack.pop();
          }
        },
      },
      Document: {
        leave(documentNode) {
          if (totalNodeCost === 0) {
            totalNodeCost = 1;
          }
          if (totalNodeCost > params.nodeCostLimit) {
            context.reportError(
              new GraphQLError(
                `Cannot request more than ${params.nodeCostLimit} nodes in a single document. Please split your operation into multiple sub operations or reduce the amount of requested nodes.`,
                documentNode
              )
            );
          }
          params.reportNodeCost?.(totalNodeCost, executionArgs);
        },
      },
    };
  };

type UseResourceLimitationsParams = {
  /**
   * The node cost limit for rejecting a operation.
   * @default 500000
   */
  nodeCostLimit?: number;
  /**
   * Whether the resourceLimitations.nodeCost field should be included within the execution result extensions map.
   * @default false
   */
  extensions?: boolean;
};

export const useResourceLimitations = (params?: UseResourceLimitationsParams): Plugin => {
  const nodeCostLimit = params?.nodeCostLimit ?? defaultNodeCostLimit;
  const extensions = params?.extensions ?? false;
  const nodeCostMap = new WeakMap<object, number>();

  const handleResult = ({ result, args }: { result: ExecutionResult; args: ExecutionArgs }) => {
    const nodeCost = nodeCostMap.get(args);
    if (nodeCost != null) {
      result.extensions = {
        ...result.extensions,
        resourceLimitations: {
          nodeCost,
        },
      };
    }
  };

  return {
    onPluginInit({ addPlugin }) {
      addPlugin(
        useExtendedValidation({
          rules: [
            ResourceLimitationValidationRule({
              nodeCostLimit,
              reportNodeCost: extensions
                ? (nodeCost, ref) => {
                    nodeCostMap.set(ref, nodeCost);
                  }
                : undefined,
            }),
          ],
          onValidationFailed: params => handleResult(params),
        })
      );
    },
    onExecute({ args }) {
      return {
        onExecuteDone(payload) {
          return handleStreamOrSingleExecutionResult(payload, ({ result }) => handleResult({ result, args }));
        },
      };
    },
  };
};
