import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { DIRECTIVE_SDL, ResolveUserFn, useGenericAuth } from '../src';

type UserType = {
  id: number;
  name: string;
};

describe('useGenericAuth', () => {
  const schema = makeExecutableSchema({
    typeDefs: `type Query { test: String! }`,
    resolvers: {
      Query: {
        test: (root, args, context) => context.currentUser?.name || '',
      },
    },
  });

  const validresolveUserFn: ResolveUserFn<UserType> = async context => {
    return {
      id: 1,
      name: 'Dotan',
    };
  };

  const invalidresolveUserFn: ResolveUserFn<UserType> = async context => {
    return null;
  };

  describe('protect-all', () => {
    it('Should allow execution when user is authenticated correctly', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'protect-all',
            resolveUserFn: validresolveUserFn,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(result.data?.test).toBe('Dotan');
    });

    it('Should prevent execution when user is not authenticated correctly', async () => {
      expect.assertions(1);
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'protect-all',
            resolveUserFn: invalidresolveUserFn,
          }),
        ],
        schema
      );

      try {
        await testInstance.execute(`query { test }`);
      } catch (err) {
        expect(err).toMatchInlineSnapshot(`[GraphQLError: Unauthenticated!]`);
      }
    });

    it('Should inject currentUser into the context when the user is valid', async () => {
      const spyFn = jest.fn();
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'resolve-only',
            resolveUserFn: validresolveUserFn,
          }),
          {
            onExecute: spyFn,
          },
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(spyFn).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            contextValue: expect.objectContaining({
              currentUser: {
                id: 1,
                name: 'Dotan',
              },
            }),
          }),
        })
      );
    });
  });

  describe('resolve-only', () => {
    it('Should passthrough execution when user is authenticated correctly', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'resolve-only',
            resolveUserFn: validresolveUserFn,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(result.data?.test).toBe('Dotan');
    });

    it('Should passthrough also when the user is not authenticated', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'resolve-only',
            resolveUserFn: invalidresolveUserFn,
          }),
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(result.data?.test).toBe('');
    });

    it('Should inject currentUser into the context when the user is valid', async () => {
      const spyFn = jest.fn();
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'resolve-only',
            resolveUserFn: validresolveUserFn,
          }),
          {
            onExecute: spyFn,
          },
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(spyFn).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            contextValue: expect.objectContaining({
              currentUser: {
                id: 1,
                name: 'Dotan',
              },
            }),
          }),
        })
      );
    });

    it('Should inject currentUser as null into the context when the user is not valid', async () => {
      const spyFn = jest.fn();
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'resolve-only',
            resolveUserFn: invalidresolveUserFn,
          }),
          {
            onExecute: spyFn,
          },
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(spyFn).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            contextValue: expect.objectContaining({
              currentUser: null,
            }),
          }),
        })
      );
    });

    it('Should inject validateUser and make it available for the resolver', async () => {
      const spyFn = jest.fn();
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'resolve-only',
            resolveUserFn: validresolveUserFn,
          }),
          {
            onExecute: spyFn,
          },
        ],
        schema
      );

      const result = await testInstance.execute(`query { test }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(spyFn).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            contextValue: expect.objectContaining({
              validateUser: expect.any(Function),
            }),
          }),
        })
      );
    });
  });

  describe('auth-directive', () => {
    const schemaWithDirective = makeExecutableSchema({
      typeDefs: `
      ${DIRECTIVE_SDL}
      
      type Query {
        protected: String @auth
        public: String
      }
      `,
      resolvers: {
        Query: {
          protected: (root, args, context) => context.currentUser.name,
          public: (root, args, context) => 'public',
        },
      },
    });

    it('Should allow execution when user is authenticated correctly and directive is set', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'protect-auth-directive',
            resolveUserFn: validresolveUserFn,
          }),
        ],
        schemaWithDirective
      );

      const result = await testInstance.execute(`query { protected }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(result.data?.protected).toBe('Dotan');
    });

    it('Should allow execution for public field when the user is authenticated ', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'protect-auth-directive',
            resolveUserFn: validresolveUserFn,
          }),
        ],
        schemaWithDirective
      );

      const result = await testInstance.execute(`query { public }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(result.data?.public).toBe('public');
    });

    it('Should allow execution for public field when the user incorrectly authenticated', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'protect-auth-directive',
            resolveUserFn: invalidresolveUserFn,
          }),
        ],
        schemaWithDirective
      );

      const result = await testInstance.execute(`query { public }`);
      assertSingleExecutionValue(result);
      expect(result.errors).toBeUndefined();
      expect(result.data?.public).toBe('public');
    });

    it('Should prevent field execution when user is not authenticated correctly', async () => {
      const testInstance = createTestkit(
        [
          useGenericAuth({
            mode: 'protect-auth-directive',
            resolveUserFn: invalidresolveUserFn,
          }),
        ],
        schemaWithDirective
      );

      const result = await testInstance.execute(`query { protected }`);
      assertSingleExecutionValue(result);
      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0].message).toBe('Unauthenticated!');
      expect(result.errors?.[0].path).toEqual(['protected']);
    });
  });
});
