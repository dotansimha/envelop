import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServerBase } from 'apollo-server-core';
import { GraphQLSchema } from 'graphql';
import { envelop, useSchema } from '@envelop/core';
import { useApolloServerErrors } from '../src';
import { assertSingleExecutionValue } from '@envelop/testing';

// Fix compat by mocking broken function
// we can remove this once apollo fixed legacy usages of execute(schema, ...args)
// aka when https://github.com/apollographql/apollo-server/pull/5662 or rather https://github.com/apollographql/apollo-server/pull/5664 has been released
jest.mock('../../../../node_modules/apollo-server-core/dist/utils/schemaHash', () => ({
  generateSchemaHash: () => 'noop',
}));

describe('useApolloServerErrors', () => {
  const executeBoth = async (schema: GraphQLSchema, query: string, debug: boolean) => {
    const apolloServer = new ApolloServerBase({ schema, debug });
    const envelopRuntime = envelop({ plugins: [useSchema(schema), useApolloServerErrors({ debug })] })({});

    return {
      apollo: await apolloServer.executeOperation({ query }),
      envelop: await envelopRuntime.execute({
        document: envelopRuntime.parse(query),
        schema: envelopRuntime.schema,
      }),
    };
  };

  it('should return the same output when Error is thrown from a resolver (debug=false)', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `type Query { test: String }`,
      resolvers: {
        Query: {
          test: () => {
            throw new Error('Test');
          },
        },
      },
    });

    const query = `query test { test }`;
    const results = await executeBoth(schema, query, false);
    assertSingleExecutionValue(results.envelop);
    expect(results.apollo.data!.test).toBeNull();
    expect(results.envelop.data!.test).toBeNull();
    expect(results.envelop.errors![0].locations).toEqual(results.apollo.errors![0].locations);
    expect(results.envelop.errors![0].path).toEqual(results.apollo.errors![0].path);
    expect(results.envelop.errors![0].message).toEqual(results.apollo.errors![0].message);
    expect(Object.keys(results.envelop.errors![0].extensions!)).toEqual(Object.keys(results.apollo.errors![0].extensions!));
    expect(results.envelop.errors![0].extensions!.code).toEqual(results.apollo.errors![0].extensions!.code);
  });

  it('should return the same output when Error is thrown from a resolver (debug=true)', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `type Query { test: String }`,
      resolvers: {
        Query: {
          test: () => {
            throw new Error('Test');
          },
        },
      },
    });

    const query = `query test { test }`;
    const results = await executeBoth(schema, query, true);
    assertSingleExecutionValue(results.envelop);
    expect(results.apollo.data!.test).toBeNull();
    expect(results.envelop.data!.test).toBeNull();
    expect(results.envelop.errors![0].locations).toEqual(results.apollo.errors![0].locations);
    expect(results.envelop.errors![0].path).toEqual(results.apollo.errors![0].path);
    expect(results.envelop.errors![0].message).toEqual(results.apollo.errors![0].message);
    expect(Object.keys(results.envelop.errors![0].extensions!)).toEqual(Object.keys(results.apollo.errors![0].extensions!));
    expect(results.envelop.errors![0].extensions!.code).toEqual(results.apollo.errors![0].extensions!.code);
  });
});
