---
'@envelop/core': patch
---

ensure legacy graphql execute parameters are passed properly.

```ts
// deprecated (removed in GraphQL.js 16)
execute(schema, ...args);
// how it should be done
execute({ schema, ...args });
```

This fixes an edge-case with graphql frameworks that call execute with the old and deprecated signature.

Thus, Envelop allows developers using server frameworks that hard-core the legacy v15 call signature to immediately use v16 without waiting for framework developers to adjusting it or fork/patch it.
