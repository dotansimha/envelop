#### `useSchema`

This plugin is the simplest plugin for specifying your GraphQL schema. You can specify a schema created from any tool that emits `GraphQLSchema` object.

```ts
import { envelop, useSchema } from '@envelop/core'
import { buildSchema } from 'graphql'

const mySchema = buildSchema(/* ... */)

const getEnveloped = envelop({
  plugins: [
    useSchema(mySchema)
    // ... other plugins ...
  ]
})
```
