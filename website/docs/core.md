---
title: Envelop Core
sidebar_label: '@envelop/core'
---

## @envelop/core

This is the core package for `envelop`, it comes with the execution pipeline wrapper, and some basic core plugins you can use for creating your initial Envelop instance.

### Built-in plugins

#### useSchema

This plugin is the simplest plugin for specifying your GraphQL schema. You can specify a schema created from any tool that emits `GraphQLSchema` object.

```ts
import { envelop, useSchema } from '@envelop/core';
import { buildSchema } from 'graphql';

const mySchema = buildSchema(...);

const getEnveloped = envelop({
  plugins: [
    useSchema(mySchema),
    // ... other plugins ...
  ],
});
```

#### useErrorHandler

This plugin invokes a custom function with the every time execution encounters an error.

```ts
import { envelop, useErrorHandler } from '@envelop/core';
import { buildSchema } from 'graphql';

const getEnveloped = envelop({
  plugins: [
    useErrorHandler(error => {
      // This callback is called per each GraphQLError emitted during execution phase
    }),
    // ... other plugins ...
  ],
});
```

> **Note:** The handler is invoked for each error. So an execution result with multiple errors will yield multiple calls.

#### useExtendContext

Easily extends the context with custom fields.

```ts
import { envelop, useExtendContext } from '@envelop/core';
import { buildSchema } from 'graphql';

const getEnveloped = envelop({
  plugins: [
    useExtendContext(async (contextSoFar) => {
      return {
        myCustomField: { ... }
      }
    }),
    // ... other plugins ...
  ],
});
```

#### useLogger

Logs parameters and information about the execution phases. You can easily plug in your custom logger.

```ts
import { envelop, useLogger } from '@envelop/core';
import { buildSchema } from 'graphql';

const getEnveloped = envelop({
  plugins: [
    useLogger({
      logFn: (eventName, args) => {
        // Event could be `execute-start` / `execute-end` / `subscribe-start` / `subscribe-end`
        // `args` will include the arguments passed to execute/subscribe (in case of "start" event) and additional result in case of "end" event.
      },
    }),
    // ... other plugins ...
  ],
});
```

#### usePayloadFormatter

Allow you to format/modify the execution result payload before returning it to your consumer.

```ts
import { envelop, usePayloadFormatter } from '@envelop/core';
import { buildSchema } from 'graphql';

const getEnveloped = envelop({
  plugins: [
    usePayloadFormatter(result => {
      // Return a modified result here,
      // Or `false`y value to keep it as-is.
    }),
    // ... other plugins ...
  ],
});
```

#### useTiming

It's a simple time metric collection for every phase in your execution. You can easily customize the behavior of each timing measurement. By default, the timing is printed to the log, using `console.log`.

```ts
import { envelop, useTiming } from '@envelop/core';
import { buildSchema } from 'graphql';

const getEnveloped = envelop({
  plugins: [
    useTiming({
      // All options are optional. By default it just print it to the log.
      // ResultTiming is an object built with { ms, ns } (milliseconds and nanoseconds)
      onContextBuildingMeasurement: (timing: ResultTiming) => {},
      onExecutionMeasurement: (args: ExecutionArgs, timing: ResultTiming) => {},
      onSubscriptionMeasurement: (args: SubscriptionArgs, timing: ResultTiming) => {},
      onParsingMeasurement: (source: Source | string, timing: ResultTiming) => {},
      onValidationMeasurement: (document: DocumentNode, timing: ResultTiming) => {},
      onResolverMeasurement: (info: GraphQLResolveInfo, timing: ResultTiming) => {},
    }),
    // ... other plugins ...
  ],
});
```

#### useMaskedErrors

Prevent unexpected error messages from leaking to the GraphQL API consumers.

```ts
import { envelop, useSchema, useMaskedErrors, EnvelopError } from '@envelop/core';
import { makeExecutableSchema } from 'graphql';

const schema = makeExecutableSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      something: String!
      somethingElse: String!
      somethingSpecial: String!
    }
  `,
  resolvers: {
    Query: {
      something: () => {
        throw new EnvelopError('Error that is propagated to the clients.');
      },
      somethingElse: () => {
        throw new Error("Unsafe error that will be masked as 'Unexpected Error.'.");
      },
      somethingSpecial: () => {
        throw new EnvelopError('The error will have an extensions field.', {
          code: 'ERR_CODE',
          randomNumber: 123,
        });
      },
    },
  },
});

const getEnveloped = envelop({
  plugins: [useSchema(schema), useMaskedErrors()],
});
```
