import { makeExecutableSchema } from '@graphql-tools/schema';
import DataLoader from 'dataloader';
import { createTestkit } from '@envelop/testing';
import { useDataLoader } from '../src';

describe('useDataLoader', () => {
  const schema = makeExecutableSchema({
    typeDefs: `type Query { test: String! }`,
    resolvers: {
      Query: {
        test: (root, args, context: { test: DataLoader<string, string> }) => context.test.load('1'),
      },
    },
  });

  it('Should inject dataloader correctly to context, based on name', async () => {
    const testInstance = createTestkit(
      [
        useDataLoader(
          'test',
          () =>
            new DataLoader<string, string>(async () => {
              return ['myValue'];
            })
        ),
      ],
      schema
    );

    const result = await testInstance.execute(`query { test }`);
    expect(result.data.test).toBe('myValue');
  });
});
