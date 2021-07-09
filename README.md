## Envelop

`envelop` is a lightweight JavaScript (/TypeScript) library for wrapping GraphQL execution layer and flow, allowing developers to develop, share
and collaborate on GraphQL-related plugins while filling the missing pieces in GraphQL implementations.

`envelop` aims to extend the GraphQL execution flow by adding plugins that enrichs the feature set of your application.

<p align="center">
  <img height="150" src="./logo.png">
</p>

`@envelop/core`: [![npm version](https://badge.fury.io/js/%40envelop%2Fcore.svg)](https://www.npmjs.com/package/@envelop/core)

> Envelop is created and maintained by [The Guild](https://the-guild.dev/), and used in production by our clients.

### [Envelop Key Concepts](<(https://www.envelop.dev/docs#key-concepts)>)

- Lightweight
- Wraps the entire GraphQL pipeline, based on plugins
- Low-level API for extending the execution layer
- Agnostic to the HTTP layer
- Agnostic to the schema tools
- Plugins-based usage
- No vendor-locking
- Amazing TypeScript support

[You can read more about the key concepts or Envelop here](https://www.envelop.dev/docs#key-concepts)

## [Getting Started](https://www.envelop.dev/docs/getting-started)

Start by adding the core of Envelop to your codebase:

```
yarn add graphql @envelop/core
```

Then, create a simple Envelop based on your GraphQL schema:

```ts
import { envelop, useSchema } from '@envelop/core';

const mySchema = buildSchema( ... ); // GraphQLSchema

const getEnveloped = envelop({
  plugins: [
    useSchema(mySchema)
  ],
});
```

The result of `envelop` is a function that allows you to get everything you need for the GraphQL execution: `parse`, `validate`, `contextBuilder` and `execute`. Use that to run the client's GraphQL queries. Here's a pseudo-code example of how it should look like:

```ts
const httpServer = createServer();

httpServer.on('request', (req, res) => {
  // Here you get the alternative methods that are bundled with your plugins
  // You can also pass the "req" to make it available for your plugins or GraphQL context.
  const { parse, validate, contextFactory, execute, schema } = getEnveloped({ req });

  // Parse the initial request and validate it
  const { query, variables } = JSON.parse(req.payload);
  const document = parse(query);
  const validationErrors = validate(schema, document);

  if (validationErrors.length > 0) {
    return res.end(JSON.stringify({ errors: validationErrors }));
  }

  // Build the context and execute
  const context = await contextFactory(req);
  const result = await execute({
    document,
    schema,
    variableValues: variables,
    contextValue: context,
  });

  // Send the response
  res.end(JSON.stringify(result));
});

httpServer.listen(3000);
```

Behind the scenes, this simple workflow allows you to use **Envelop plugins** and hook into the entire request handling flow.

Here's a simple example for collecting metrics and log all incoming requests, using the built-in plugins:

```ts
const getEnveloped = envelop({
  plugins: [useSchema(schema), useLogger(), useTiming()],
});
```

> [You can read more about here](https://www.envelop.dev/docs/getting-started)

## [Integrations / Examples](https://www.envelop.dev/docs/integrations)

[You can find the integrations and compatibility list, and code-based examples here](https://www.envelop.dev/docs/integrations)

## Available Plugins

You can explore all plugins in our [Plugins Hub](https://www.envelop.dev/plugins). If you wish your plugin to be listed here and under PluginsHub, feel free to add your plugin information [in this file](https://github.com/dotansimha/envelop/edit/main/website/src/lib/plugins.ts#L23) and create a Pull Request!

We provide a few built-in plugins within the `@envelop/core`, and many more plugins as standalone packages.

| Name                         | Package                                                                                  | Description                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| useSchema                    | [`@envelop/core`](./packages/core#useschema)                                             | Simplest plugin to provide your GraphQL schema.                                                                                                   |
| useErrorHandler              | [`@envelop/core`](./packages/core#useerrorhandler)                                       | Get notified when any execution error occurs.                                                                                                     |
| useMaskedErrors              | [`@envelop/core`](./packages/core#usemaskederrors)                                       | Hide sensitive/unexpected errors from your clients.                                                                                               |
| useExtendContext             | [`@envelop/core`](./packages/core#useextendcontext)                                      | Extend execution context based on your needs.                                                                                                     |
| useLogger                    | [`@envelop/core`](./packages/core#uselogger)                                             | Simple, yet powerful logging for GraphQL execution.                                                                                               |
| usePayloadFormatter          | [`@envelop/core`](./packages/core#usepayloadformatter)                                   | Format, clean and customize execution result.                                                                                                     |
| useTiming                    | [`@envelop/core`](./packages/core#usetiming)                                             | Simple timing/tracing mechanism for your execution.                                                                                               |
| useGraphQLJit                | [`@envelop/graphql-jit`](./packages/plugins/graphql-jit)                                 | Custom executor based on GraphQL-JIT.                                                                                                             |
| useParserCache               | [`@envelop/parser-cache`](./packages/plugins/parser-cache)                               | Simple LRU for caching `parse` results.                                                                                                           |
| useValidationCache           | [`@envelop/validation-cache`](./packages/plugins/validation-cache)                       | Simple LRU for caching `validate` results.                                                                                                        |
| useDepthLimit                | [`@envelop/depth-limit`](./packages/plugins/depth-limit)                                 | Limits the depth of your GraphQL selection sets.                                                                                                  |
| useDataLoader                | [`@envelop/dataloader`](./packages/plugins/dataloader)                                   | Simply injects a DataLoader instance into your context.                                                                                           |
| useApolloTracing             | [`@envelop/apollo-tracing`](./packages/plugins/apollo-tracing)                           | Integrates timing with Apollo-Tracing format (for GraphQL Playground)                                                                             |
| useSentry                    | [`@envelop/sentry`](./packages/plugins/sentry)                                           | Tracks performance, timing and errors and reports it to Sentry.                                                                                   |
| useOpenTelemetry             | [`@envelop/opentelemetry`](./packages/plugins/opentelemetry)                             | Tracks performance, timing and errors and reports in OpenTelemetry structure.                                                                     |
| useGenericAuth               | [`@envelop/generic-auth`](./packages/plugins/generic-auth)                               | Super flexible authentication, also supports `@auth` directive .                                                                                  |
| useAuth0                     | [`@envelop/auth0`](./packages/plugins/auth0)                                             | Validates Auth0 JWT tokens and injects the authenticated user to your context.                                                                    |
| useGraphQLModules            | [`@envelop/graphql-modules`](./packages/plugins/graphql-modules)                         | Integrates the execution lifecycle of GraphQL-Modules.                                                                                            |
| useGraphQLMiddleware         | [`@envelop/graphql-middleware`](./packages/plugins/graphql-middleware)                   | Integrates middlewares written for `graphql-middleware`                                                                                           |
| useRateLimiter               | [`@envelop/rate-limiter`](./packages/plugins/rate-limiter)                               | Limit request rate via `@rateLimit` directive                                                                                                     |
| useDisableIntrospection      | [`@envelop/disable-introspection`](./packages/plugins/disable-introspection)             | Disables introspection by adding a validation rule                                                                                                |
| useFilterAllowedOperations   | [`@envelop/filter-operation-type`](./packages/plugins/filter-operation-type)             | Only allow execution of specific operation types                                                                                                  |
| useExtendedValidation        | [`@envelop/extended-validation`](./packages/plugins/extended-validation)                 | Adds custom validations to the execution pipeline, with access to variables. Comes with an implementation for `@oneOf` directive for input union. |
| usePreloadAssets             | [`@envelop/preload-assets`](./packages/plugins/preload-assets)                           | Register asset that should be prefetched on the client via an extensions field.                                                                   |
| usePersistedOperations       | [`@envelop/persisted-operations`](./packages/plugins/persisted-operations)               | Simple implementation of persisted operations/queries, based on custom store.                                                                     |
| useNewRelic                  | [`@envelop/newrelic`](./packages/plugins/newrelic)                                       | Instrument your GraphQL application with New Relic reporting.                                                                                     |
| useLiveQuery                 | [`@envelop/live-query`](./packages/plugins/live-query)                                   | The easiest way of adding live queries to your GraphQL server!                                                                                    |
| useFragmentArguments         | [`@envelop/fragment-arguments`](./packages/plugins/fragment-arguments)                   | Adds support for using arguments on fragments                                                                                                     |
| useApolloServerErrors        | [`@envelop/apollo-server-errors`](./packages/plugins/apollo-server-errors)               | Exposes execution error in the same structure as Apollo-Server                                                                                    |
| useOperationFieldPermissions | [`@envelop/operation-field-permissions`](./packages/plugins/operation-field-permissions) | Extended validation rule for creating user-aware permissions, based on types and fields                                                           |

## Sharing / Composing `envelop`s

After an `envelop` has been created, you can share it with others as a complete layer of plugins. This is useful if you wish to create a predefined layer of plugins, and share it with others. You can use it as a shell and as a base for writing shareable pieces of servers.

You can read more about [Sharing and Composing Envelops here](https://www.envelop.dev/docs/composing-envelop).

## Write your own plugin!

Envelop plugins are just objects with functions, that provide contextual implementation for before/after of each phase, with a flexible API.

Here's a simple example that allows you to print the execution params:

```ts
const myPlugin = {
  onExecute({ args }) {
    console.log('Execution started!', { args });

    return {
      onExecuteDone: ({ result }) => {
        console.log('Execution done!', { result });
      },
    };
  },
};

const getEnveloped = envelop({
  plugins: [
    /// ... other plugins ...,
    myPlugin,
  ],
});
```

[For a complete guide and API docs for custom plugins, please refer to Envelop website](https://www.envelop.dev/docs/plugins)

### Contributing

If this is your first time contributing to this project, please do read our [Contributor Workflow Guide](https://github.com/the-guild-org/Stack/blob/master/CONTRIBUTING.md) before you get started off.

Feel free to open issues and pull requests. We're always welcome support from the community.

For a contribution guide specific to this project, please refer to: http://graphql-code-generator.com/docs/custom-codegen/contributing

### Code of Conduct

Help us keep GraphQL Codegenerator open and inclusive. Please read and follow our [Code of Conduct](https://github.com/the-guild-org/Stack/blob/master/CODE_OF_CONDUCT.md) as adopted from [Contributor Covenant](https://www.contributor-covenant.org/)

### License

[![GitHub license](https://img.shields.io/badge/license-MIT-lightgrey.svg?maxAge=2592000)](https://raw.githubusercontent.com/apollostack/apollo-ios/master/LICENSE)

MIT
