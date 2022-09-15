import { OnResolveOptions, useOnResolve } from '@envelop/on-resolve';
import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { makeExecutableSchema } from '@graphql-tools/schema';

describe('useOnResolve', () => {
  const schema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        value1: String!
        value2: String!
      }
    `,
    resolvers: {
      Query: {
        value1: () => 'value1',
        value2: () => 'value2',
      },
    },
  });

  it('should invoke the callback for each resolver', async () => {
    const onResolveDoneFn = jest.fn();
    const onResolveFn = jest.fn((_opts: OnResolveOptions) => onResolveDoneFn);
    const testkit = createTestkit([useOnResolve(onResolveFn)], schema);

    await testkit.perform({ query: '{ value1, value2 }' });

    expect(onResolveFn).toBeCalledTimes(2);
    expect(onResolveDoneFn).toBeCalledTimes(2);

    let i = 0;
    for (const field of ['value1', 'value2']) {
      expect(onResolveFn.mock.calls[i][0].context).toBeDefined();
      expect(onResolveFn.mock.calls[i][0].args).toBeDefined();
      expect(onResolveFn.mock.calls[i][0].info).toBeDefined();
      expect(onResolveFn.mock.calls[i][0].info.fieldName).toBe(field);
      expect(onResolveFn.mock.calls[i][0].resolver).toBeInstanceOf(Function);
      expect(onResolveFn.mock.calls[i][0].replaceResolver).toBeInstanceOf(Function);

      expect(onResolveDoneFn.mock.calls[i][0].result).toBe(field);
      expect(onResolveDoneFn.mock.calls[i][0].setResult).toBeInstanceOf(Function);

      i++;
    }
  });

  it('should replace the result using the after hook', async () => {
    const testkit = createTestkit(
      [
        useOnResolve(() => ({ setResult }) => {
          setResult('value2');
        }),
      ],
      schema
    );

    const result = await testkit.perform({ query: '{ value1 }' });
    assertSingleExecutionValue(result);

    expect(result.data?.value1).toBe('value2');
  });
});
