## `@envelop/persisted-operations`

This plugin allow you to enforce execution of persisted (hashed) operation, using a custom store.

The idea behind running persisted operations is to allow clients to run only specific queries, that defined ahead of time. This provides an enhances security and disables (optionally) the execution of other operations. This plugin is useful if you are looking for a way to improve security and reduce network traffic.

## Getting Started

```
yarn add @envelop/persisted-operations
```

## Usage Example

```ts
import { envelop } from '@envelop/core';
import { usePersistedOperations } from '@envelop/persisted-operations';

// You can retrieve the store in any way (e.g. from a remote source) and implement it with a Map
const myStore = new Map();
myStore.set('persisted_1', parse(`query { ... }`));
myStore.set('persisted_2', 'query { ... }'));

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    usePersistedOperations({
      store: myStore,
    }),
  ],
});
```

Now, when running operations through your GraphQL server, you can use a key instead of a query language:

```json
{
  "query": "persisted_1",
  "variables": {}
}
```

You can also provide a function to retrieve the operation id from a custom property available in your context

```ts
usePersistedOperations({
  store: myStore,
  setOperationId: (context) => context.request.body.operationId // get id from custom property in body object
}),
```

## Usage Example with built-in Json-Files-Store

```ts
import { usePersistedOperations, JsonFilesStore } from '@envelop/persisted-operations';

const persistedOperationsPaths = [
  resolve(process.cwd(), 'assets/client1PersistedOperations.json'),
  resolve(process.cwd(), 'assets/client2PersistedOperations.json'),
];
const persistedOperationsStore = new JsonFilesStore(persistedOperationsPaths);
await persistedOperationsStore.load(); // load and parse persisted-operations files

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    usePersistedOperations({
      store: persistedOperationsStore.get(),
    }),
  ],
});
```

## With Relay

If you are using Relay, you can leverage `relay-compiler` feature for hashing and and creating the store for you, during build.

You can [read more about this feature here](https://relay.dev/docs/guides/persisted-queries/). After building your hashes, you can use `queryMap.json` as your store.
