## `@envelop/persisted-queries`

TODO

## Getting Started

```
yarn add @envelop/persisted-queries
```

## Basic Usage

For convenience the plugin expose a Class which allow you to setup a basic store from one or more JSON files.  
You can use this or build your own store that implements `PersistedQueriesStore` typescript interface exported by the plugin.

```ts
import { resolve } from 'path';
import { envelop } from '@envelop/core';
import { usePersistedQueries, JsonFilesStore } from '@envelop/persisted-queries';

const persistedQueriesStore = new JsonFilesStore([
  resolve(process.cwd(), 'assets/clientOne_persistedQueries.json'),
  resolve(process.cwd(), 'assets/clientTwo_persistedQueries.json'),
]);

const getEnveloped = envelop({
  plugins: [
    usePersistedQueries({
      store: persistedQueriesStore,
      onlyPersisted: true, // default `false`. When set to true, will reject queries that don't have a valid query id
    }),
    // ... other plugins ...
  ],
});

-----

await persistedQueriesStore.build(); // get store ready, in this case by loading persisted-quries files

server.listen() // once queries are loaded you can safely start the server
```

TODO: explain default behaviour which identifies query id from standard "query" param (GraphQL source)

## Advanced usage

In order to build custom logic you probably want to pass the request object (or part of it) to `getEnveloped`, so that this will be available as the initial context

```ts
httpServer.on('request', (request, response) => {
  const { parse, validate, contextFactory, execute, schema } = getEnveloped({ request });
  // ...
}
```

TODO, describe the following:

-  when using `JsonFilesStore`, lists are named after file name (without extension)
- build custom logic to set query id: `setQueryId: (context) => context.request.body.queryId // set custom logic to get queryId`
- how to match ids from a single queries list: `` pickSingleList: (context) => `${context.request.headers.applicationName}_persistedQueries` ``
- `setQueryId` and `pickSingleList` can return undefined, explain what happens
- building your own store
- update the store during runtime with updated or new lists, without restarting the server
