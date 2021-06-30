import { LocalGraphQLDataSource } from '@apollo/gateway';
import { createTestkit } from '@envelop/testing';
import { execute } from 'graphql';
import { useFederation } from '../src';
import * as accounts from './fixtures/accounts';
import * as products from './fixtures/products';
import * as reviews from './fixtures/reviews';

describe('useFederation', () => {
  const query = /* GraphQL */ `
    # A query that the gateway resolves by calling all three services
    query GetCurrentUserReviews {
      me {
        username
        reviews {
          body
          product {
            name
            upc
          }
        }
      }
    }
  `;

  const useTestFederation = () => useFederation({
    gateway: {
      localServiceList: [
        { name: 'accounts', typeDefs: accounts.typeDefs },
        { name: 'products', typeDefs: products.typeDefs },
        { name: 'reviews', typeDefs: reviews.typeDefs },
      ],
      buildService: definition => {
        switch (definition.name) {
          case 'accounts':
            return new LocalGraphQLDataSource(accounts.schema);
          case 'products':
            return new LocalGraphQLDataSource(products.schema);
          case 'reviews':
            return new LocalGraphQLDataSource(reviews.schema);
        }
        throw new Error(`Unknown service ${definition.name}`);
      },
    },
  });

  it('Should override execute function', async () => {
    const onExecuteSpy = jest.fn();

    const testInstance = createTestkit([
      useTestFederation(),
      {
        onExecute: onExecuteSpy,
      },
    ]);

    await testInstance.execute(query);

    expect(onExecuteSpy).toHaveBeenCalledTimes(1);
    expect(onExecuteSpy.mock.calls[0][0].executeFn).not.toBe(execute);
    expect(onExecuteSpy.mock.calls[0][0].executeFn.name).toBe('federationExecutor');
  });

  it('Should execute correctly', async () => {
    const testInstance = createTestkit([useTestFederation()]);
    const result = await testInstance.execute(query);
    expect(result.errors).toBeFalsy();
    expect(result.data).toMatchSnapshot();
  });
});
