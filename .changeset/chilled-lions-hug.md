---
'@envelop/core': minor
'@envelop/types': minor
---

Add API for registering a context creation error handler.

```ts
export const useMyHook = (): Plugin => {
  return {
    onPluginInit(context) {
      context.registerContextErrorHandler(({ error, setError }) => {
        console.error('Error occurred during context creation.', error);
        setError(new Error('Something went wrong :('));
      });
    },
  };
};
```
