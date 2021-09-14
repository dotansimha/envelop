## `@envelop/response-cache`

- Skip the execution phase and reduce server load by caching execution results in-memory.
- Customize cache entry time to live based on fields and types within the execution result.
- Automatically invalidate the cache based on mutation selection sets.
- Customize invalidation through the cache api (e.g. listen to a database write log).
- Implement your own global cache (e.g. using Redis) by implementing the `Cache` interface.

[Check out the GraphQL Response Cache Guide for more information](https://envelop.dev/docs/guides/adding-a-graphql-response-cache)

## Getting Started

```bash
yarn add @envelop/response-cache
```

## Usage Example

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache(),
  ],
});
```

## Recipes

### Cache with maximum TTL

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000, // cached execution results become stale after 2 seconds
    }),
  ],
});
```

### Cache with custom TTL per object type

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      ttlPerType: {
        // cached execution results that contain a `Stock` object become stale after 500ms
        Stock: 500,
      },
    }),
  ],
});
```

### Cache with custom TTL per schema coordinate

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      ttlPerSchemaCoordinate: {
        // cached execution results that select the `Query.user` field become stale after 100ms
        'Query.rocketCoordinates': 100,
      },
    }),
  ],
});
```

### Cache based on session/user

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // context is the GraphQL context used for execution
      session: context => String(context.user?.id),
    }),
  ],
});
```

### Disable cache based on session/user

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // context is the GraphQL context used for execution
      enabled: context => context.user?.role !== 'admin',
    }),
  ],
});
```

### Prevent caching of sensitive information

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // never cache responses that include a RefreshToken object type.
      ignoredTypes: ['RefreshToken'],
    }),
  ],
});
```

### Customize the fields that are used for building the cache ID

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // use the `_id` instead of `id` field.
      idFields: ['_id'],
    }),
  ],
});
```

### Disable automatic cache invalidation via mutations

```ts
import { envelop } from '@envelop/core';
import { useResponseCache } from '@envelop/response-cache';

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // some might prefer invalidating based on a database write log
      invalidateViaMutation: false,
    }),
  ],
});
```

### Invalidate Cache based on custom logic

```ts
import { envelop } from '@envelop/core';
import { useResponseCache, createInMemoryCache } from '@envelop/response-cache';
import { emitter } from './eventEmitter';

// we create our cache instance, which allows calling all methods on it
const cache = createInMemoryCache();

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // we pass the cache instance to the request.
      cache,
    }),
  ],
});

emitter.on('invalidate', resource => {
  cache.invalidate([
    {
      typename: resource.type,
      id: resource.id,
    },
  ]);
});
```

### Customize how cache ids are built

```ts
import { envelop } from '@envelop/core';
import { useResponseCache, createInMemoryCache } from '@envelop/response-cache';
import { emitter } from './eventEmitter';

// we create our cache instance, which allows calling all methods on it
const cache = createInMemoryCache({
  // in relay we have global unique ids, no need to use `typename:id`
  makeId: (typename, id) => id ?? typename,
});

const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      // we pass the cache instance to the request.
      cache,
    }),
  ],
});
```

### Expose cache metadata via extensions

For debugging or monitoring it might be useful to know whether a response got served from the cache or not.

```ts
const getEnveloped = envelop({
  plugins: [
    // ... other plugins ...
    useResponseCache({
      ttl: 2000,
      includeExtensionMetadata: true,
    }),
  ],
});
```

This option will attach the following fields to the execution result if set to true (or `process.env["NODE_ENV"]` is `"development"`).

- `extension.responseCache.hit` - Whether the result was served form the cache or not
- `extension.responseCache.invalidatedEntities` - Entities that got invalidated by a mutation operation

#### Examples:

**Cache miss (response is generated by executing the query):**

```graphql
query UserById {
  user(id: "1") {
    id
    name
  }
}
```

```json
{
  "result": {
    "user": {
      "id": "1",
      "name": "Laurin"
    }
  },
  "extensions": {
    "responseCache": {
      "hit": false
    }
  }
}
```

**Cache hit (response served from response cache):**

```graphql
query UserById {
  user(id: "1") {
    id
    name
  }
}
```

```json
{
  "result": {
    "user": {
      "id": "1",
      "name": "Laurin"
    }
  },
  "extensions": {
    "responseCache": {
      "hit": true
    }
  }
}
```

**Invalidation via Mutation:**

```graphql
mutation SetNameMutation {
  userSetName(name: "NotLaurin") {
    user {
      id
      name
    }
  }
}
```

```json
{
  "result": {
    "userSetName": {
      "user": {
        "id": "1",
        "name": "Laurin"
      }
    }
  },
  "extensions": {
    "invalidatedEntities": [{ "id": "1", "typename": "User" }]
  }
}
```
