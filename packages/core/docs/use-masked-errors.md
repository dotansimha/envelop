#### `useMaskedErrors`

Prevent unexpected error messages from leaking to the GraphQL clients.

```ts
import { envelop, useSchema, useMaskedErrors, EnvelopError } from '@envelop/core';
import { makeExecutableSchema } from 'graphql';

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      something: String!
      somethingElse: String!
      somethingSpecial: String!
    }
  `,
  resolvers: {
    Query: {
      something: () => {
        throw new EnvelopError('Error that is propagated to the clients.');
      },
      somethingElse: () => {
        throw new Error("Unsafe error that will be masked as 'Unexpected Error.'.");
      },
      somethingSpecial: () => {
        throw new EnvelopError('The error will have an extensions field.', {
          code: 'ERR_CODE',
          randomNumber: 123,
        });
      },
    },
  },
});

const getEnveloped = envelop({
  plugins: [useSchema(schema), useMaskedErrors()],
});
```

You may customize the default error message `Unexpected error.` with your own `errorMessage`:

```ts
const getEnveloped = envelop({
  plugins: [useSchema(schema), useMaskedErrors({ errorMessage: 'Something went wrong.' })],
});
```

Or provide a custom formatter when masking the output:

```ts
export const customFormatError: FormatErrorHandler = (err: any) => {
  if (err.originalError && err.originalError instanceof EnvelopError === false) {
    return new GraphQLError('Sorry, something went wrong.');
  }

  return err;
};

const getEnveloped = envelop({
  plugins: [useSchema(schema), useMaskedErrors({ formatError: customFormatError })],
});
```
