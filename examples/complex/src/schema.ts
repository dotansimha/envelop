import { makeExecutableSchema } from '@graphql-tools/schema';

export const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type AuthenticationInfo {
      sub: String!
    }

    type Query {
      isAuthenticated: Boolean
      authInfo: AuthenticationInfo
    }
  `,
  resolvers: {
    Query: {
      isAuthenticated: (_, __, context) => {
        return context.auth0 != null;
      },
      authInfo: (_, __, context) => {
        return context.auth0;
      },
    },
  },
});
