import {
  buildSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLID,
  GraphQLInt,
  GraphQLSchema,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLList,
} from 'graphql';
import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { useExtendedValidation, ONE_OF_DIRECTIVE_SDL, OneOfInputObjectsRule } from '../src';

describe('oneOf', () => {
  const astSchema = buildSchema(/* GraphQL */ `
    ${ONE_OF_DIRECTIVE_SDL}

    input NestedOneOfFieldInput {
      field: UserUniqueCondition!
    }

    input DeeplyNestedOneOfFieldInput {
      field: NestedOneOfFieldInput!
    }

    input ListOneOfInput {
      items: [UserUniqueCondition!]
    }

    type Query {
      user(input: UserUniqueCondition): User
      findUser(byID: ID, byUsername: String, byEmail: String, byRegistrationNumber: Int): User @oneOf
      nestedOneOf(input: NestedOneOfFieldInput!): Boolean
      deeplyNestedOneOf(input: DeeplyNestedOneOfFieldInput): Boolean
      listOneOf(input: [UserUniqueCondition!]): Boolean
      inputFieldOneOfList(input: ListOneOfInput): Boolean
    }

    type User {
      id: ID!
    }

    input UserUniqueCondition @oneOf {
      id: ID
      username: String
    }
  `);

  const GraphQLUser = new GraphQLObjectType({
    name: 'User',
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLID),
      },
    },
  });
  const GraphQLUserUniqueCondition = new GraphQLInputObjectType({
    name: 'UserUniqueCondition',
    fields: {
      id: {
        type: GraphQLID,
      },
      username: {
        type: GraphQLString,
      },
    },
    extensions: {
      oneOf: true,
    },
  });
  const GraphQLNestedOneOfFieldInput = new GraphQLInputObjectType({
    name: 'NestedOneOfFieldInput',
    fields: {
      field: {
        type: new GraphQLNonNull(GraphQLUserUniqueCondition),
      },
    },
  });
  const GraphQLDeeplyNestedOneOfFieldInput = new GraphQLInputObjectType({
    name: 'DeeplyNestedOneOfFieldInput',
    fields: {
      field: {
        type: new GraphQLNonNull(GraphQLNestedOneOfFieldInput),
      },
    },
  });
  const GraphQLListOneOfInput = new GraphQLInputObjectType({
    name: 'ListOneOfInput',
    fields: {
      items: {
        type: new GraphQLList(new GraphQLNonNull(GraphQLUserUniqueCondition)),
      },
    },
  });
  const GraphQLQuery = new GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: GraphQLUser,
        args: {
          input: {
            type: GraphQLUserUniqueCondition,
          },
        },
      },
      findUser: {
        type: GraphQLUser,
        args: {
          byID: {
            type: GraphQLID,
          },
          byUsername: {
            type: GraphQLString,
          },
          byEmail: {
            type: GraphQLString,
          },
          byRegistrationNumber: {
            type: GraphQLInt,
          },
        },
        extensions: {
          oneOf: true,
        },
      },
      nestedOneOf: {
        type: GraphQLBoolean,
        args: {
          input: {
            type: new GraphQLNonNull(GraphQLNestedOneOfFieldInput),
          },
        },
      },
      deeplyNestedOneOf: {
        type: GraphQLBoolean,
        args: {
          input: {
            type: GraphQLDeeplyNestedOneOfFieldInput,
          },
        },
      },
      listOneOf: {
        type: GraphQLBoolean,
        args: {
          input: {
            type: new GraphQLList(new GraphQLNonNull(GraphQLUserUniqueCondition)),
          },
        },
      },
      inputFieldOneOfList: {
        type: GraphQLBoolean,
        args: {
          input: {
            type: GraphQLListOneOfInput,
          },
        },
      },
    },
  });
  const programmaticSchema = new GraphQLSchema({ query: GraphQLQuery });

  describe.each([
    ['AST via Directive', astSchema],
    ['Programmatic via extensions.oneOf', programmaticSchema],
  ])('%s', (_, testSchema) => {
    describe('INPUT_OBJECT', () => {
      const DOCUMENT_WITH_WHOLE_INPUT = /* GraphQL */ `
        query user($input: UserUniqueCondition!) {
          user(input: $input) {
            id
          }
        }
      `;

      it.each([
        [
          'Valid: Exactly one key is specified through literal',
          {
            document: `query user { user(input: { id: 1 }) { id }}`,
            variables: {},
            expectedError: null,
          },
        ],
        [
          'Valid: Exactly one key is specified through variables',
          {
            document: DOCUMENT_WITH_WHOLE_INPUT,
            variables: {
              input: {
                id: 1,
              },
            },
            expectedError: null,
          },
        ],
        [
          'Valid: Mixed variables resolved into a single value',
          {
            document: `query user($username: String) { user(input: { id: 1, username: $username }) { id }}`,
            variables: {},
            expectedError: null,
          },
        ],
        [
          'Valid: Mixed variables resolved into a single value - separate variables',
          {
            document: `query user($id: ID, $username: String) { user(input: { id: $id, username: $username }) { id }}`,
            variables: {
              id: 1,
            },
            expectedError: null,
          },
        ],
        [
          'Valid: nullable input field without any variable value provided',
          {
            document: `query user($input: UserUniqueCondition) { user(input: $input) { id } }`,
            variables: {},
            expectedError: null,
          },
        ],
        [
          'Valid: nested nullable input field without any variable value provided',
          {
            document: `query user($input: DeeplyNestedOneOfFieldInput) { deeplyNestedOneOf(input: $input) }`,
            variables: {},
            expectedError: null,
          },
        ],
        [
          'Valid: Nested oneOf on input field',
          {
            document: `query user($input: NestedOneOfFieldInput!) { nestedOneOf(input: $input) }`,
            variables: {
              input: {
                field: {
                  id: 1,
                },
              },
            },
            expectedError: null,
          },
        ],
        [
          'Valid: Deeply nested oneOf on input field',
          {
            document: `query user($input: DeeplyNestedOneOfFieldInput!) { deeplyNestedOneOf(input: $input) }`,
            variables: {
              input: {
                field: {
                  field: {
                    id: 1,
                  },
                },
              },
            },
            expectedError: null,
          },
        ],
        [
          'Valid: oneOf input list',
          {
            document: `query user($input: [UserUniqueCondition!]) { listOneOf(input: $input) }`,
            variables: {
              input: [
                {
                  id: 1,
                },
              ],
            },
            expectedError: null,
          },
        ],
        [
          'Valid: oneOf input list (multiple items)',
          {
            document: `query user($input: [UserUniqueCondition!]) { listOneOf(input: $input) }`,
            variables: {
              input: [
                {
                  id: 1,
                },
                {
                  id: 2,
                },
              ],
            },
            expectedError: null,
          },
        ],
        [
          'Valid: oneOf input list field on input type',
          {
            document: `query user($input: ListOneOfInput!) { inputFieldOneOfList(input: $input) }`,
            variables: {
              input: {
                items: [
                  {
                    id: 1,
                  },
                ],
              },
            },
            expectedError: null,
          },
        ],
        [
          'Invalid: Mixed variables leading to multiple values',
          {
            document: `query user($username: String) { user(input: { id: 1, username: $username }) { id }}`,
            variables: {
              username: 'test',
            },
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: More than one value specified through literals',
          {
            document: `query user { user(input: { id: 1, username: "t" }) { id }}`,
            variables: {},
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: More than one value specified through literals with null value',
          {
            document: `query user { user(input: { id: null, username: "t" }) { id }}`,
            variables: {},
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: All values specified explicity with null values',
          {
            document: `query user { user(input: { id: null, username: null }) { id }}`,
            variables: {},
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          `Invalid: When variables are empty`,
          {
            document: DOCUMENT_WITH_WHOLE_INPUT,
            variables: {},
            expectedError: 'Variable "$input" of required type "UserUniqueCondition!" was not provided.',
          },
        ],
        [
          `Invalid: When specific variable is empty and provided as input type variable`,
          {
            document: DOCUMENT_WITH_WHOLE_INPUT,
            variables: {
              input: {},
            },
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: More than one value is specific',
          {
            document: DOCUMENT_WITH_WHOLE_INPUT,
            variables: {
              input: {
                id: 1,
                username: 'test',
              },
            },
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: More than one value is specific for deeply nested oneOf input type',
          {
            document: `query user($input: NestedOneOfFieldInput!) { nestedOneOf(input: $input) }`,
            variables: {
              input: {
                field: {
                  id: 1,
                  username: 'test',
                },
              },
            },
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: More than one value is specific for deeply nested oneOf input type',
          {
            document: `query user($input: DeeplyNestedOneOfFieldInput!) { deeplyNestedOneOf(input: $input) }`,
            variables: {
              input: {
                field: {
                  field: {
                    id: 1,
                    username: 'test',
                  },
                },
              },
            },
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: oneOf input list with more than one value specified on the oneOf type',
          {
            document: `query user($input: [UserUniqueCondition!]) { listOneOf(input: $input) }`,
            variables: {
              input: [
                {
                  id: 1,
                  username: 'test',
                },
              ],
            },
            expectedError: 'Exactly one key must be specified for input type "UserUniqueCondition"',
          },
        ],
        [
          'Invalid: oneOf object field with incorrect object value',
          {
            document: DOCUMENT_WITH_WHOLE_INPUT,
            variables: {
              input: 1,
            },
            expectedError: `Variable "$input" got invalid value 1; Expected type "UserUniqueCondition" to be an object.`,
          },
        ],
        [
          'Invalid: oneOf input list with incorrect list value',
          {
            document: `query user($input: [UserUniqueCondition!]) { listOneOf(input: $input) }`,
            variables: {
              input: 1,
            },
            expectedError: `Variable "$input" got invalid value 1; Expected type "UserUniqueCondition" to be an object.`,
          },
        ],
        [
          'Invalid: oneOf input list with incorrect list value (variant with input coercion)',
          {
            document: `query user($input: [UserUniqueCondition!]) { listOneOf(input: $input) }`,
            variables: {
              input: { a: 1 },
            },
            expectedError: `Variable "$input" got invalid value { a: 1 }; Field "a" is not defined by type "UserUniqueCondition".`,
          },
        ],
      ])('%s', async (_title, { document, variables, expectedError }) => {
        const testInstance = createTestkit(
          [
            useExtendedValidation({
              rules: [OneOfInputObjectsRule],
            }),
          ],
          testSchema
        );

        const result = await testInstance.execute(document, variables);
        assertSingleExecutionValue(result);
        if (expectedError) {
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBe(1);
          expect(result.errors![0].message).toBe(expectedError);
        } else {
          expect(result.errors).toBeUndefined();
        }
      });
    });

    describe('FIELD_DEFINITION', () => {
      const DOCUMENT = /* GraphQL */ `
        query user($byID: ID, $byUsername: String, $byEmail: String, $byRegistrationNumber: Int) {
          findUser(byID: $byID, byUsername: $byUsername, byEmail: $byEmail, byRegistrationNumber: $byRegistrationNumber) {
            id
          }
        }
      `;

      it.each([
        [
          'Valid: One value specified correctly through variables',
          {
            document: DOCUMENT,
            variables: {
              byID: 1,
            },
            expectedError: null,
          },
        ],
        [
          'Valid: Mixed values of variables and literal without variables specified',
          {
            document: /* GraphQL */ `
              query user($username: String) {
                findUser(byID: 1, byUsername: $username) {
                  id
                }
              }
            `,
            variables: {},
            expectedError: null,
          },
        ],
        [
          'Invalid: Multiple values specified through variables',
          {
            document: DOCUMENT,
            variables: {
              byID: 1,
              byUsername: 'test',
            },
            expectedError: 'Exactly one key must be specified for input for field "User.findUser"',
          },
        ],
        [
          'Invalid: Multiple values specified through literal',
          {
            document: /* GraphQL */ `
              query user {
                findUser(byID: 1, byUsername: "test") {
                  id
                }
              }
            `,
            variables: {},
            expectedError: 'Exactly one key must be specified for input for field "User.findUser"',
          },
        ],
        [
          'Invalid: Mixed values of variables and literal',
          {
            document: /* GraphQL */ `
              query user($username: String) {
                findUser(byID: 1, byUsername: $username) {
                  id
                }
              }
            `,
            variables: {
              username: 'test',
            },
            expectedError: 'Exactly one key must be specified for input for field "User.findUser"',
          },
        ],
      ])('%s', async (_title, { document, variables, expectedError }) => {
        const testInstance = createTestkit(
          [
            useExtendedValidation({
              rules: [OneOfInputObjectsRule],
            }),
          ],
          testSchema
        );

        const result = await testInstance.execute(document, variables);
        assertSingleExecutionValue(result);
        if (expectedError) {
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBe(1);
          expect(result.errors![0].message).toBe(expectedError);
        } else {
          expect(result.errors).toBeUndefined();
        }
      });
    });
  });
});
