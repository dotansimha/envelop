import { createTestkit } from '@envelop/testing';
import { buildSchema, GraphQLError } from 'graphql';
import { useExtendedValidation } from '../src';

describe('useExtendedValidation', () => {
  it('supports usage of multiple useExtendedValidation in different plugins', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        foo: String!
      }
    `);
    const operation = /* GraphQL */ `
      {
        foo
      }
    `;
    const testInstance = createTestkit(
      [
        useExtendedValidation({
          rules: [
            ctx => {
              return {
                OperationDefinition() {
                  ctx.reportError(new GraphQLError('No 1'));
                },
              };
            },
          ],
        }),
        useExtendedValidation({
          rules: [
            ctx => {
              return {
                OperationDefinition() {
                  ctx.reportError(new GraphQLError('No 2'));
                },
              };
            },
          ],
        }),
      ],
      schema
    );

    const result = await testInstance.execute(operation);
    expect(result).toMatchInlineSnapshot(`
    Object {
      "data": null,
      "errors": Array [
        [GraphQLError: No 1],
        [GraphQLError: No 2],
      ],
    }
    `);
  });
});
