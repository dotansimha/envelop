export type Tags =
  | 'tracing'
  | 'metrics'
  | 'core'
  | 'error-handling'
  | 'security'
  | 'utilities'
  | 'performance'
  | 'caching'
  | 'dev-tools'
  | 'authentication'
  | 'authorization'
  | 'schema';

export type RawPlugin = {
  identifier: string;
  title: string;
  npmPackage: string;
  tags: Tags[];
  readme?: string;
  iconUrl?: string;
};

export const pluginsArr: RawPlugin[] = [
  {
    identifier: 'use-sentry',
    title: 'useSentry',
    npmPackage: '@envelop/sentry',
    iconUrl: '/assets/logos/sentry.png',
    tags: ['tracing', 'metrics', 'error-handling'],
  },
  {
    identifier: 'use-schema',
    title: 'useSchema',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core'],
  },
  {
    identifier: 'use-error-handler',
    title: 'useErrorHandler',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core', 'error-handling'],
  },
  {
    identifier: 'use-masked-errors',
    title: 'useMaskedErrors',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core', 'error-handling', 'security'],
  },
  {
    identifier: 'use-extend-context',
    title: 'useExtendContext',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core', 'utilities'],
  },
  {
    identifier: 'use-logger',
    title: 'useLogger',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core', 'utilities'],
  },
  {
    identifier: 'use-payload-formatter',
    title: 'usePayloadFormatter',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core', 'utilities'],
  },
  {
    identifier: 'use-timing',
    title: 'useTiming',
    npmPackage: '@envelop/core',
    iconUrl: '/logo.png',
    tags: ['core', 'tracing', 'utilities'],
  },
  {
    identifier: 'use-graphql-jit',
    title: 'useGraphQLJit',
    npmPackage: '@envelop/graphql-jit',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['performance'],
  },
  {
    identifier: 'use-parser-cache',
    title: 'useParserCache',
    npmPackage: '@envelop/parser-cache',
    iconUrl: '/logo.png',
    tags: ['performance', 'caching'],
  },
  {
    identifier: 'use-validation-cache',
    title: 'useValidationCache',
    npmPackage: '@envelop/validation-cache',
    iconUrl: '/logo.png',
    tags: ['performance', 'caching'],
  },
  {
    identifier: 'use-depth-limit',
    title: 'useDepthLimit',
    npmPackage: '@envelop/depth-limit',
    iconUrl: '/logo.png',
    tags: ['performance', 'security'],
  },
  {
    identifier: 'use-data-loader',
    title: 'useDataLoader',
    npmPackage: '@envelop/dataloader',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['performance'],
  },
  {
    identifier: 'use-apollo-tracing',
    title: 'useApolloTracing',
    npmPackage: '@envelop/apollo-tracing',
    iconUrl: '/assets/logos/apollo.png',
    tags: ['dev-tools'],
  },
  {
    identifier: 'use-open-telemetry',
    title: 'useOpenTelemetry',
    npmPackage: '@envelop/opentelemetry',
    iconUrl: '/assets/logos/opentelemetry.png',
    tags: ['tracing', 'metrics', 'error-handling'],
  },
  {
    identifier: 'use-generic-auth',
    title: 'useGenericAuth',
    npmPackage: '@envelop/generic-auth',
    iconUrl: '/assets/logos/generic_auth.png',
    tags: ['security', 'authentication', 'authorization'],
  },
  {
    identifier: 'use-auth0',
    title: 'useAuth0',
    npmPackage: '@envelop/auth0',
    iconUrl: '/assets/logos/auth0.png',
    tags: ['security', 'authentication', 'authorization'],
  },
  {
    identifier: 'use-graphql-modules',
    title: 'useGraphQLModules',
    npmPackage: '@envelop/graphql-modules',
    iconUrl: 'https://www.graphql-modules.com/img/just-logo.svg',
    tags: ['schema', 'utilities', 'dev-tools'],
  },
  {
    identifier: 'use-rate-limiter',
    title: 'useRateLimiter',
    npmPackage: '@envelop/graphql-middleware',
    iconUrl: '/assets/logos/rate_limiter.png',
    tags: ['schema', 'utilities', 'security'],
  },
  {
    identifier: 'use-disable-introspection',
    title: 'useDisableIntrospection',
    npmPackage: '@envelop/disable-introspection',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['utilities', 'security'],
  },
  {
    identifier: 'use-filter-allowed-operations',
    title: 'useFilterAllowedOperations',
    npmPackage: '@envelop/filter-operation-type',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['utilities', 'security'],
  },
  {
    identifier: 'use-preload-assets',
    title: 'usePreloadAssets',
    npmPackage: '@envelop/preload-assets',
    iconUrl: '/assets/logos/assets.png',
    tags: ['utilities'],
  },
  {
    identifier: 'use-persisted-operations',
    title: 'usePersistedOperations',
    npmPackage: '@envelop/persisted-operations',
    iconUrl: '/assets/logos/persisted_operations.png',
    tags: ['security', 'performance'],
  },
  {
    identifier: 'use-graphql-hive',
    title: 'useHive',
    npmPackage: '@graphql-hive/client',
    iconUrl: 'https://the-guild.dev/static/shared-logos/products/hive.svg',
    tags: ['tracing', 'metrics', 'dev-tools'],
  },
  {
    identifier: 'use-newrelic',
    title: 'useNewRelic',
    npmPackage: '@envelop/newrelic',
    iconUrl: '/assets/logos/newrelic.png',
    tags: ['tracing', 'metrics', 'error-handling'],
  },
  {
    identifier: 'use-live-query',
    title: 'useLiveQuery',
    npmPackage: '@envelop/live-query',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['utilities'],
  },
  {
    identifier: 'use-fragment-arguments',
    title: 'useFragmentArguments',
    npmPackage: '@envelop/fragment-arguments',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['utilities'],
  },
  {
    identifier: 'use-apollo-server-errors',
    title: 'useApolloServerErrors',
    npmPackage: '@envelop/apollo-server-errors',
    iconUrl: '/assets/logos/apollo.png',
    tags: ['utilities', 'error-handling'],
  },
  {
    identifier: 'use-operation-field-permissions',
    title: 'useOperationFieldPermissions',
    npmPackage: '@envelop/operation-field-permissions',
    iconUrl: '/assets/logos/graphql.png',
    tags: ['security', 'authorization'],
  },
];
