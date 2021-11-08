---
'@envelop/core': patch
'@envelop/apollo-federation': patch
'@envelop/apollo-server-errors': patch
'@envelop/apollo-tracing': patch
'@envelop/auth0': patch
'@envelop/dataloader': patch
'@envelop/depth-limit': patch
'@envelop/disable-introspection': patch
'@envelop/execute-subscription-event': patch
'@envelop/extended-validation': patch
'@envelop/filter-operation-type': patch
'@envelop/fragment-arguments': patch
'@envelop/generic-auth': patch
'@envelop/graphql-jit': patch
'@envelop/graphql-middleware': patch
'@envelop/graphql-modules': patch
'@envelop/live-query': patch
'@envelop/newrelic': patch
'@envelop/opentelemetry': patch
'@envelop/parser-cache': patch
'@envelop/persisted-operations': patch
'@envelop/preload-assets': patch
'@envelop/prometheus': patch
'@envelop/rate-limiter': patch
'@envelop/resource-limitations': patch
'@envelop/response-cache': patch
'@envelop/sentry': patch
'@envelop/statsd': patch
'@envelop/validation-cache': patch
'@envelop/testing': patch
'@envelop/types': patch
---

Properly list `@envelop/core` as a `peerDependency` in plugins.

This resolves issues where the bundled envelop plugins published to npm had logic inlined from the `@envelop/core` package, causing `instanceof` check of `EnvelopError` to fail.
