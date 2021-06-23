## `@envelop/persisted-operations`

TODO

## Getting Started

```
yarn add @envelop/persisted-queries
```

## Basic Usage

TODO

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
      onlyPersisted: true,
      setQueryId: (context) => context.request.body.queryId
    }),
    // ... other plugins ...
  ],
});

...

await persistedQueriesStore.buildStore(); // load persisted-quries files
server.listen() // once queries are loaded you can safely start the server
```

## Advanced usage

TODO

- default behaviour to identify query id from standard "query" param
- how to match ids from a single queries list
- 
