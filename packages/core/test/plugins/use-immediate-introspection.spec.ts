import { createTestkit } from '@envelop/testing';
import { useImmediateIntrospection } from '../../src/plugins/use-immediate-introspection';
import { useExtendContext } from '../../src/plugins/use-extend-context';
import { schema } from '../common';

describe('useImmediateIntrospection', () => {
  it('skips context building for introspection only operation', async () => {
    const testInstance = createTestkit(
      [useImmediateIntrospection(), useExtendContext<() => Promise<{}>>(() => Promise.reject('EHHH'))],
      schema
    );

    await testInstance.execute(/* GraphQL */ `
      query {
        __typename
      }
    `);
  });
  it('skips context building for introspection only operation (alias)', async () => {
    const testInstance = createTestkit(
      [useImmediateIntrospection(), useExtendContext<() => Promise<{}>>(() => Promise.reject('EHHH'))],
      schema
    );

    await testInstance.execute(/* GraphQL */ `
      query {
        some: __typename
      }
    `);
  });
  it('runs context building for operation containing non introspection fields', async () => {
    const testInstance = createTestkit(
      [useImmediateIntrospection(), useExtendContext<() => Promise<{}>>(() => Promise.reject('This should reject'))],
      schema
    );

    try {
      await testInstance.execute(/* GraphQL */ `
        query {
          __schema {
            aaa: __typename
          }
          me {
            id
          }
        }
      `);
      throw new Error('Should throw.');
    } catch (err) {
      if (err === 'This should reject') {
        return;
      }
      throw err;
    }
  });
});
