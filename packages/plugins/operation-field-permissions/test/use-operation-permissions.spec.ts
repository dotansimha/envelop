import { useOperationPermissions } from '../src';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createTestkit } from '@envelop/testing';

const schema = makeExecutableSchema({
  typeDefs: [
    /* GraphQL */ `
      type Query {
        greetings: [String!]
        foo: String
        user: User
      }

      type User {
        id: ID!
      }
    `,
  ],
  resolvers: {},
});

const query = /* GraphQL */ `
  {
    greetings
    foo
    user {
      id
    }
  }
`;

describe('useOperationPermissions', () => {
  it('allow everything', async () => {
    const kit = createTestkit(
      [
        useOperationPermissions({
          getPermissions: () => '*',
        }),
      ],
      schema
    );

    const result = await kit.execute(query);
    expect(result.errors).toBeUndefined();
  });
  it('allow only one field', async () => {
    const kit = createTestkit(
      [
        useOperationPermissions({
          getPermissions: () => 'Query.greetings',
        }),
      ],
      schema
    );

    const result = await kit.execute(query);
    expect(result.errors).toMatchInlineSnapshot(`
Array [
  [GraphQLError: Insufficient permissions for selecting 'Query.foo'.],
  [GraphQLError: Insufficient permissions for selecting 'Query.user'.],
  [GraphQLError: Insufficient permissions for selecting 'User.id'.],
]
`);
  });
  it('allow wildcard for types', async () => {
    const kit = createTestkit(
      [
        useOperationPermissions({
          getPermissions: () => 'Query.*',
        }),
      ],
      schema
    );

    const result = await kit.execute(query);
    expect(result.errors).toMatchInlineSnapshot(`
Array [
  [GraphQLError: Insufficient permissions for selecting 'User.id'.],
]
`);
  });
  it('allow selecting specific fields', async () => {
    const kit = createTestkit(
      [
        useOperationPermissions({
          getPermissions: () => new Set(['Query.greetings', 'Query.foo', 'Query.user', 'User.id']),
        }),
      ],
      schema
    );

    const result = await kit.execute(query);
    expect(result.errors).toBeUndefined();
  });
});
