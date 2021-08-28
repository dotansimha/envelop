import { makeExecutableSchema } from '@graphql-tools/schema';
import { DocumentNode, parse } from 'graphql';
import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { PersistedOperationsStore, usePersistedOperations } from '../src';

// describe('usePersistedOperations', () => {
//   const testSchema = makeExecutableSchema({
//     resolvers: {
//       Query: {
//         foo: () => 'test',
//       },
//     },
//     typeDefs: /* GraphQL */ `
//       type Query {
//         foo: String
//       }
//     `,
//   });

//   const createStore = (data: Record<string, DocumentNode | string>): PersistedOperationsStore => ({
//     canHandle: key => key.startsWith('persisted_'),
//     get: key => data[key],
//   });

//   it('Should allow running persisted operations', async () => {
//     const store = createStore({
//       persisted_1: parse(`query { foo }`),
//     });

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: true,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`persisted_1`, {}, {});
//     assertSingleExecutionValue(result);
//     expect(result.errors).toBeUndefined();
//     expect(result.data?.foo).toBe('test');
//   });

//   it('Should allow store to return string', async () => {
//     const store = createStore({
//       persisted_1: 'query { foo }',
//     });

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: true,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`persisted_1`, {}, {});
//     assertSingleExecutionValue(result);
//     expect(result.errors).toBeUndefined();
//     expect(result.data?.foo).toBe('test');
//   });

//   it('Should fail when key is valid, but operation is not persisted', async () => {
//     const store = createStore({});

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: true,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`persisted_1`);
//     assertSingleExecutionValue(result);
//     expect(result.errors![0].message).toBe('The operation hash "persisted_1" is not valid');
//   });

//   it('Should throw an error in case of an invalid key', async () => {
//     const store = createStore({
//       persisted_1: parse(`query { foo }`),
//     });

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: true,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`invalid`);
//     assertSingleExecutionValue(result);
//     expect(result.errors![0].message).toBe(`Failed to handle GraphQL persisted operation.`);
//   });

//   it('Should allow regular parse flow when onlyPersistedOperations=false', async () => {
//     const store = createStore({
//       persisted_1: parse(`query { foo }`),
//     });

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: false,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`invalid`);
//     assertSingleExecutionValue(result);
//     expect(result.errors![0].message).toBe(`Syntax Error: Unexpected Name \"invalid\".`);
//   });

//   it('Should allow regular parse flow when onlyPersistedOperations=false and valid operation', async () => {
//     const store = createStore({
//       persisted_1: parse(`query { foo }`),
//     });

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: false,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`query { foo }`);
//     assertSingleExecutionValue(result);
//     expect(result.errors).toBeUndefined();
//     expect(result.data?.foo).toBe('test');
//   });

//   it('Should prevent regular operations flow when onlyPersistedOperations=true and valid operation', async () => {
//     const store = createStore({
//       persisted_1: parse(`query { foo }`),
//     });

//     const testInstance = createTestkit(
//       [
//         usePersistedOperations({
//           onlyPersistedOperations: true,
//           store,
//         }),
//       ],
//       testSchema
//     );

//     const result = await testInstance.execute(`query { foo }`);
//     assertSingleExecutionValue(result);
//     expect(result.errors![0].message).toBe(`Failed to handle GraphQL persisted operation.`);
//   });
// });
