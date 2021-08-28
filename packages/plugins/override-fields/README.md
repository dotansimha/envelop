## `@envelop/override-fields`

This plugin allows you to target specific fields and override their default behavior.  
This is useful when you want to control parts of your schema, f.i. if they are sensible for your business or incur an extra cost from underlying data sources.  
With this plugin, you can define conditions to replace the original resolver functions for your targeted fields to potentially prevent expensive execution and instead return simple arbitrary values.

## Getting Started

```
yarn add @envelop/override-fields
```

## Basic Usage

You can target fields either by referencing them as plain strings or by using a Regular Expression.  
To target fields, you need to specify the parent type followed by the field name, like `CallingCode.countries`.  
You can also target specific nested fields by declaring the full path tree, like `Query.region.countries.borders`.

```ts
import { envelop } from '@envelop/core';
import { useOverrideFields } from '@envelop/override-fields';

const getEnveloped = envelop({
  plugins: [
    useOverrideFields({
      fields: ['Query.continents', 'Query.region.countries.borders', 'CallingCode.countries', /Country\.aplhaCode.*/],
    }),
    // ... other plugins
  ],
});
```

> NOTE: Where possible, prefer using plain strings for targeting fields.  
> Matching by a plain string is more performant since it requires just as a direct lookup, with a fixed O(1) cost.  
> Matching with a Regular Expression requires testing all the patterns you define, on each resolver hit by your operation; hence you probably want to make sure your patterns are as simple as possible.

## Advanced usage

The snippet below is an example of a full plugin configuration that uses all the options available to customise implementation logic.

```ts
  useOverrideFields({
    fields: ['Query.continents', 'Query.region.countries.borders', 'CallingCode.countries', /Country\.aplhaCode.*/],
    shouldOverride: context => context.request.headers.illictTraffic === 'true',
    overrideFn: (root, args, context, info) => !info.path.length ? context.cache[info.fieldName] : null,
  }),
```

### shouldOverride

This function lets you implement your own logic to define when you want the override to happen.  
The function expects a boolean as a return value, and by default, it's always set to `true`, so you can use it only when you want to implement custom logic to enable/disable the override behavior.  
`shouldOverride` receives a single argument that is the context available in Envelop. To build your custom logic, you might probably want to enrich your context, for instance by passing the `request` object (or part of it) to `getEnveloped`, so that this will be available as the initial context.

### overrideFn

`overrideFn` is the function that will replace the original resolver functions for your matched fields.  
The default implementation for this function will just return `null` as the value for the fields that are matched. This works well for root fields which can always be nullable as per GraphQL specs, but nested fields might have different validation rules, so by using this function you can return any different value.  
This function is a full replacement for the resolver functions, which means it complies with GraphQL specs and so it receives the following arguments `root, args, context, info`. You can use those arguments to implement any resolver logic you wish, or ignore the arguments and return an arbitrary value.

### Multiple instances

In the examples above we've seen how you can use this plugin to target a group of fields and override their original resolver functions.  
However, you might want to setup different overriding logic and implementation for different groups of fields.  
In this case, nothing prevents you from defining multiple instances of this plugin so that you can have a dedicated `overrideFn`, and maybe even `shouldOverride` logic, for different groups of fields.
