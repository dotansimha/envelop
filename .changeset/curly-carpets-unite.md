---
'@envelop/core': minor
---

`useMaskedErrors` now masks errors thrown during context creation (calling `contextFactory`).

It might be possible that you need to load some data during context creation from a remote source that could be unavailable and thus yield in an error being thrown. `useMaskedErrors` now handles such scenarios and prevents leaking such information to clients.

✅ context error will be masked

```ts
const getEnveloped = envelop({
  plugins: [
    useExtendContext(() => {
      throw new Error('Oooooops.');
    }),
    useMaskedErrors(),
  ],
});
```
