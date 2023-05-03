import { ExecutionResult } from 'graphql';
import {
  assertStreamExecutionValue,
  collectAsyncIteratorValues,
  createTestkit,
} from '@envelop/testing';
import { schema } from './common.js';

describe('subscribe', () => {
  it('Should be able to manipulate streams', async () => {
    const streamExecuteFn = async function* () {
      for (const value of ['a', 'b', 'c', 'd']) {
        yield { data: { alphabet: value } };
      }
    };

    const teskit = createTestkit(
      [
        {
          onSubscribe({ setSubscribeFn }) {
            setSubscribeFn(streamExecuteFn as any);

            return {
              onSubscribeResult: () => {
                return {
                  onNext: ({ setResult }) => {
                    setResult({ data: { alphabet: 'x' } });
                  },
                };
              },
            };
          },
        },
      ],
      schema,
    );

    const result = await teskit.execute(/* GraphQL */ `
      subscription {
        alphabet
      }
    `);
    assertStreamExecutionValue(result);
    const values = await collectAsyncIteratorValues(result);
    expect(values).toEqual([
      { data: { alphabet: 'x' } },
      { data: { alphabet: 'x' } },
      { data: { alphabet: 'x' } },
      { data: { alphabet: 'x' } },
    ]);
  });

  it('Should be able to invoke something after the stream has ended.', async () => {
    expect.assertions(1);
    const streamExecuteFn = async function* () {
      for (const value of ['a', 'b', 'c', 'd']) {
        yield { data: { alphabet: value } };
      }
    };

    const teskit = createTestkit(
      [
        {
          onSubscribe({ setSubscribeFn }) {
            setSubscribeFn(streamExecuteFn as any);

            return {
              onSubscribeResult: () => {
                let latestResult: ExecutionResult;
                return {
                  onNext: ({ result }) => {
                    latestResult = result;
                  },
                  onEnd: () => {
                    expect(latestResult).toEqual({ data: { alphabet: 'd' } });
                  },
                };
              },
            };
          },
        },
      ],
      schema,
    );

    const result = await teskit.execute(/* GraphQL */ `
      subscription {
        alphabet
      }
    `);
    assertStreamExecutionValue(result);
    await collectAsyncIteratorValues(result);
  });
});
