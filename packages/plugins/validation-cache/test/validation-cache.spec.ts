import { buildSchema, validate } from 'graphql';
import { createTestkit } from '@envelop/testing';
import { useValidationCache } from '../src';
import { Plugin } from '@envelop/types';

describe('useValidationCache', () => {
  const testSchema = buildSchema(/* GraphQL */ `
    type Query {
      foo: String
    }
  `);

  let testValidator: jest.Mock<typeof validate>;
  let useTestPlugin: Plugin<any>;

  beforeEach(() => {
    testValidator = jest.fn().mockImplementation((source, options) => validate(source, options));

    useTestPlugin = {
      onValidate({ setValidationFn }) {
        setValidationFn(testValidator as any as typeof validate);
      },
    };
  });

  afterEach(() => {
    testValidator.mockReset();
  });

  it('Should call original validate when cache is empty', async () => {
    const testInstance = createTestkit([useTestPlugin, useValidationCache()], testSchema);
    await testInstance.execute(`query { foo }`);
    expect(testValidator).toHaveBeenCalledTimes(1);
  });

  it('Should call validate once once when operation is cached', async () => {
    const testInstance = createTestkit([useTestPlugin, useValidationCache()], testSchema);
    await testInstance.execute(`query { foo }`);
    await testInstance.execute(`query { foo }`);
    await testInstance.execute(`query { foo }`);
    expect(testValidator).toHaveBeenCalledTimes(1);
  });

  it('Should call validate once once when operation is cached and errored', async () => {
    const testInstance = createTestkit([useTestPlugin, useValidationCache()], testSchema);
    const r1 = await testInstance.execute(`query { foo2 }`);
    const r2 = await testInstance.execute(`query { foo2 }`);
    expect(testValidator).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('Should call validate multiple times on different operations', async () => {
    const testInstance = createTestkit([useTestPlugin, useValidationCache()], testSchema);
    await testInstance.execute(`query t { foo }`);
    await testInstance.execute(`query t2 { foo }`);
    expect(testValidator).toHaveBeenCalledTimes(2);
  });

  it('should call validate multiple times when operation is invalidated', async () => {
    const testInstance = createTestkit(
      [
        useTestPlugin,
        useValidationCache({
          ttl: 1,
        }),
      ],
      testSchema
    );
    await testInstance.execute(`query t { foo }`);
    await testInstance.wait(10);
    await testInstance.execute(`query t { foo }`);
    expect(testValidator).toHaveBeenCalledTimes(2);
  });

  it('should call validate multiple times when schema changes', async () => {
    const testInstance = createTestkit([useTestPlugin, useValidationCache()], testSchema);
    await testInstance.execute(`query t { foo }`);

    testInstance.replaceSchema(
      buildSchema(/* GraphQL */ `
        type Query {
          foo2: String
        }
      `)
    );

    await testInstance.execute(`query t { foo }`);
    expect(testValidator).toHaveBeenCalledTimes(2);
  });
});
