import { ASTNode, buildSchema, print as graphQLPrint } from 'graphql';
import { Registry } from 'prom-client';
import { Plugin, useExtendContext } from '@envelop/core';
import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { BucketsConfig, MetricsConfig } from '../src/config.js';
import {
  createCounter,
  createHistogram,
  PrometheusTracingPluginConfig,
  usePrometheus,
} from '../src/index.js';
import { registerHistogram } from '../src/utils.js';

// Graphql.js 16 and 15 produce different results
// Graphql.js 16 output has not trailing \n
// In order to produce the same output we remove any trailing white-space
const print = (ast: ASTNode) => graphQLPrint(ast).replace(/^\s+|\s+$/g, '');

const allMetrics: { [Name in keyof MetricsConfig]-?: true } = {
  graphql_envelop_deprecated_field: true,
  graphql_envelop_error_result: true,
  graphql_envelop_phase_context: true,
  graphql_envelop_phase_execute: true,
  graphql_envelop_phase_parse: true,
  graphql_envelop_phase_subscribe: true,
  graphql_envelop_phase_validate: true,
  graphql_envelop_request: true,
  graphql_envelop_request_duration: true,
  graphql_envelop_request_time_summary: true,
  graphql_envelop_schema_change: true,
  graphql_envelop_execute_resolver: true,
};

describe('Prom Metrics plugin', () => {
  const schema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        regularField: String!
        deprecatedField: String @deprecated(reason: "old")
        longField: String!
        errorField: String
      }
      input MutationInput {
        deprecatedField: String @deprecated(reason: "old")
        regularField: String!
      }
      type MutationPayload {
        payloadField: String
      }
      type Mutation {
        mutationWithDeprecatedFields(
          deprecatedInput: String @deprecated(reason: "old")
        ): MutationPayload
      }
    `,
    resolvers: {
      Query: {
        regularField() {
          return 'regular';
        },
        deprecatedField() {
          return 'regular';
        },
        errorField() {
          throw new Error('error');
        },
        async longField() {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve('long');
            }, 500);
          });
        },
      },
      Mutation: {
        mutationWithDeprecatedFields: () => {
          return {
            payloadField: 'a non deprecated field',
          };
        },
      },
    },
  });

  function prepare(
    config: PrometheusTracingPluginConfig,
    registry: Registry = new Registry(),
    plugins: Plugin[] = [],
  ) {
    const plugin = usePrometheus({
      ...config,
      registry,
    });

    const teskit = createTestkit(
      [
        plugin,
        useExtendContext(() => new Promise<void>(resolve => setTimeout(resolve, 250))),
        ...plugins,
      ],
      schema,
    );

    return {
      execute: teskit.execute,
      plugin,
      registry,
      async metricString(name: string) {
        return registry.getSingleMetricAsString(name);
      },
      async allMetrics() {
        return await registry.metrics();
      },
      async metricCount(name: string, sub: string | null = null) {
        const arr = await registry.getMetricsAsJSON();
        const m = arr.find(m => m.name === name);

        if (m) {
          return ((m as any).values || []).filter((v: any) =>
            sub === null ? true : v.metricName === `${name}_${sub}`,
          ).length;
        }

        return 0;
      },
      async metricValue(name: string, sub: string | null = null) {
        const arr = await registry.getMetricsAsJSON();
        const m = arr.find(m => m.name === name);

        if (m) {
          return ((m as any).values || []).find((v: any) =>
            sub === null ? true : v.metricName === `${name}_${sub}`,
          ).value;
        }

        return 0;
      },
    };
  }

  it('integration', async () => {
    const { execute, allMetrics } = prepare({
      metrics: {
        graphql_envelop_error_result: true,
        graphql_envelop_phase_execute: true,
        graphql_envelop_phase_parse: true,
        graphql_envelop_phase_validate: true,
        graphql_envelop_phase_context: true,
        graphql_envelop_deprecated_field: true,
        graphql_envelop_execute_resolver: true,
      },
    });
    const result = await execute('query { regularField longField deprecatedField }');
    assertSingleExecutionValue(result);

    expect(result.errors).toBeUndefined();
    const metricsStr = await allMetrics();

    expect(metricsStr).toContain('graphql_envelop_phase_parse_count{');
    expect(metricsStr).toContain('graphql_envelop_phase_validate_count{');
    expect(metricsStr).toContain('graphql_envelop_phase_context_count{');
    expect(metricsStr).toContain('graphql_envelop_phase_execute_count{');
    expect(metricsStr).toContain('graphql_envelop_execute_resolver_count{');
    expect(metricsStr).toContain('graphql_envelop_deprecated_field{');
    expect(metricsStr).not.toContain('graphql_envelop_error_result{');
  });

  it(`should limit it's impact on perf by adding unnecessary hooks`, () => {
    const plugin = usePrometheus({
      metrics: {},
    });

    const hooks = Object.entries(plugin)
      .filter(([, value]) => value)
      .map(([key]) => key);

    // onParse is the only required hook, it sets up the params for most metric labels
    expect(hooks).toEqual(['onParse']);
  });

  describe('parse', () => {
    it.each([
      {
        name: 'enabled alone',
        config: { metrics: { graphql_envelop_phase_parse: true } },
      },
      {
        name: 'enabled with all metrics',
        config: { metrics: allMetrics },
      },
      {
        name: 'given a buckets list',
        config: { metrics: { graphql_envelop_phase_parse: [0.5, 1, 5, 10] } },
      },
      {
        name: 'given a list of phase',
        config: { metrics: { graphql_envelop_phase_parse: ['parse'] } },
      },
      ((registry: Registry) => ({
        name: 'given a custom configuration',
        config: {
          registry,
          metrics: {
            graphql_envelop_phase_parse: createHistogram({
              registry,
              histogram: {
                name: 'graphql_envelop_phase_parse',
                help: 'test',
                labelNames: ['operationName', 'operationType'],
              },
              fillLabelsFn: params => ({
                operationName: params.operationName!,
                operationType: params.operationType!,
              }),
            }),
          },
        },
      }))(new Registry()),
      ((registry: Registry) => ({
        name: 'given a shouldObserve',
        config: {
          registry,
          metrics: {
            graphql_envelop_phase_parse: createHistogram({
              registry,
              histogram: {
                name: 'graphql_envelop_phase_parse',
                help: 'test',
                labelNames: ['operationName', 'operationType'],
              },
              fillLabelsFn: params => ({
                operationName: params.operationName!,
                operationType: params.operationType!,
              }),
              shouldObserve: () => true,
            }),
          },
        },
      }))(new Registry()),
      ((registry: Registry) => ({
        name: 'given a custom config and phases',
        config: {
          registry,
          metrics: {
            graphql_envelop_phase_parse: createHistogram({
              registry,
              histogram: {
                name: 'graphql_envelop_phase_parse',
                help: 'test',
                labelNames: ['operationName', 'operationType'],
              },
              fillLabelsFn: params => ({
                operationName: params.operationName!,
                operationType: params.operationType!,
              }),
              phases: ['parse'],
            }),
          },
        },
      }))(new Registry()),
    ] as { name: string; config: PrometheusTracingPluginConfig }[])(
      'should monitor parse timing when $name',
      async ({ config }) => {
        const { execute, metricCount, metricString } = prepare(config, config.registry);
        const result = await execute('query { regularField }');
        assertSingleExecutionValue(result);

        expect(result.errors).toBeUndefined();
        expect(await metricCount('graphql_envelop_phase_parse', 'count')).toBe(1);
        const metricReport = await metricString('graphql_envelop_phase_parse');
        expect(metricReport).toContain(`operationName="Anonymous"`);
        expect(metricReport).toContain(`operationType="query"`);
      },
    );

    it.each([
      {
        name: 'disabled with all metrics',
        config: { metrics: { ...allMetrics, graphql_envelop_phase_parse: false } },
      },
      {
        name: 'providing empty list of phases',
        config: {
          metrics: {
            graphql_envelop_phase_parse: [],
            graphql_envelop_schema_change: [],
          },
        },
      },
      ((registry: Registry) => ({
        name: 'given a shouldObserve',
        config: {
          registry,
          metrics: {
            graphql_envelop_phase_parse: createHistogram({
              registry,
              histogram: {
                name: 'graphql_envelop_phase_parse',
                help: 'test',
                labelNames: ['operationName', 'operationType'],
              },
              fillLabelsFn: params => ({
                operationName: params.operationName!,
                operationType: params.operationType!,
              }),
              shouldObserve: () => false,
            }),
          },
        },
      }))(new Registry()),
    ] satisfies { name: string; config: PrometheusTracingPluginConfig }[])(
      'should not monitor parse timing when $name',
      async ({ config }) => {
        const { execute, metricCount, metricString } = prepare(config, config.registry);
        const result = await execute('query { regularField }');
        assertSingleExecutionValue(result);

        expect(result.errors).toBeUndefined();
        expect(await metricCount('graphql_envelop_phase_parse', 'count')).toBe(0);
      },
    );

    it('Should trace error during parse', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_error_result: true,
        },
      });
      const result = await execute('query {');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      console.log(await metricString('graphql_envelop_error_result'));
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain('phase="parse"');
      expect(await metricCount('graphql_envelop_phase_parse')).toBe(0);
    });

    it('Should trace valid parse result', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_phase_parse: true,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('graphql_envelop_phase_parse', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_phase_parse')).toContain(
        `graphql_envelop_phase_parse_count{operationName=\"Anonymous\",operationType=\"query\"} 1`,
      );
    });

    it('Should skip parse when parse = false', async () => {
      const { execute, metricCount } = prepare({ metrics: { graphql_envelop_phase_parse: false } });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_parse')).toBe(0);
    });

    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_phase_parse: createHistogram({
              registry,
              histogram: {
                name: 'test_parse',
                help: 'HELP ME',
                labelNames: ['opText'] as const,
              },
              fillLabelsFn: params => {
                return {
                  opText: print(params.document!),
                };
              },
            }),
          },
        },
        registry,
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('test_parse', 'count')).toBe(1);
      expect(await metricString('test_parse')).toContain(
        `test_parse_count{opText=\"{\\n  regularField\\n}\"} 1`,
      );
    });
  });

  describe('validate', () => {
    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_phase_validate: createHistogram({
              registry,
              histogram: {
                name: 'test_validate',
                help: 'HELP ME',
                labelNames: ['opText'] as const,
              },
              fillLabelsFn: params => {
                return {
                  opText: print(params.document!),
                };
              },
            }),
          },
        },
        registry,
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('test_validate', 'count')).toBe(1);
      expect(await metricString('test_validate')).toContain(
        `test_validate_count{opText=\"{\\n  regularField\\n}\"} 1`,
      );
    });

    it('should not register to onValidate event when not needed', () => {
      expect(
        prepare({
          metrics: {
            graphql_envelop_phase_validate: false,
            graphql_envelop_error_result: ['context', 'execute', 'parse', 'subscribe'],

            graphql_envelop_deprecated_field: true,
            graphql_envelop_execute_resolver: true,
            graphql_envelop_phase_context: true,
            graphql_envelop_phase_execute: true,
            graphql_envelop_phase_parse: true,
            graphql_envelop_phase_subscribe: true,
            graphql_envelop_request: true,
            graphql_envelop_request_duration: true,
            graphql_envelop_request_time_summary: true,
            graphql_envelop_schema_change: true,
          },
        }).plugin.onValidate,
      ).toBeUndefined();
    });

    it('Should trace error during validate, and also trace timing', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_phase_validate: true,
          graphql_envelop_error_result: true,
        },
      });
      const result = await execute('query test($v: String!) { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="test",operationType="query",phase="validate"} 1',
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      expect(await metricCount('graphql_envelop_phase_validate', 'count')).toBe(1);
    });

    it('should trace error during validate, even when not tracing timing', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_error_result: true,
        },
      });
      const result = await execute('query test($v: String!) { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="test",operationType="query",phase="validate"} 1',
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      expect(await metricCount('graphql_envelop_phase_validate', 'count')).toBe(0);
    });

    it('Should trace valid validations result', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_phase_validate: true,
        },
      });
      const result = await execute('query test { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_validate', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_phase_validate')).toContain(
        `graphql_envelop_phase_validate_count{operationName=\"test\",operationType=\"query\"} 1`,
      );
    });

    it('Should skip validate when validate = false', async () => {
      const { execute, metricCount } = prepare({
        metrics: { graphql_envelop_phase_validate: false },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_validate')).toBe(0);
    });
  });

  describe('contextBuilding', () => {
    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_phase_context: createHistogram({
              registry,
              histogram: {
                name: 'test_context',
                help: 'HELP ME',
                labelNames: ['opText'] as const,
              },
              fillLabelsFn: params => {
                return {
                  opText: print(params.document!),
                };
              },
            }),
          },
        },
        registry,
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('test_context', 'count')).toBe(1);
      expect(await metricString('test_context')).toContain(
        `test_context_count{opText=\"{\\n  regularField\\n}\"} 1`,
      );
    });

    it('Should trace contextBuilding timing', async () => {
      const { execute, metricCount } = prepare({
        metrics: { graphql_envelop_phase_context: true },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_context', 'count')).toBe(1);
    });

    it('Should skip contextBuilding when contextBuilding = false', async () => {
      const { execute, metricCount } = prepare({
        metrics: { graphql_envelop_phase_context: false },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_context')).toBe(0);
    });

    it('should trace error and timing during contextBuilding', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricValue, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_error_result: true,
            graphql_envelop_phase_context: true,
          },
        },
        registry,
        [
          useExtendContext<any>(() => {
            throw new Error('error');
          }),
        ],
      );

      try {
        await execute('query { regularField }');
      } catch (e) {}
      expect(await metricValue('graphql_envelop_phase_context', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      const errorMetric = await metricString('graphql_envelop_error_result');
      expect(errorMetric).toContain('phase="context"');
      expect(errorMetric).toContain('operationName="Anonymous"');
      expect(errorMetric).toContain('operationType="query"');
    });

    it('should trace error during contextBuilding', async () => {
      const registry = new Registry();
      const testKit = createTestkit(
        [
          usePrometheus({
            metrics: {
              graphql_envelop_error_result: true,
            },
            registry,
          }),
          useExtendContext<any>(() => {
            throw new Error('error');
          }),
        ],
        schema,
      );
      try {
        await testKit.execute('query { regularField }');
      } catch (e) {}
      const metrics = await registry.getMetricsAsJSON();
      expect(metrics).toEqual([
        {
          help: 'Counts the amount of errors reported from all phases',
          name: 'graphql_envelop_error_result',
          type: 'counter',
          values: [
            {
              labels: {
                operationName: 'Anonymous',
                operationType: 'query',
                phase: 'context',
              },
              value: 1,
            },
          ],
          aggregator: 'sum',
        },
      ]);
    });
  });

  describe('execute', () => {
    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_phase_execute: createHistogram({
              registry,
              histogram: {
                name: 'test_execute',
                help: 'HELP ME',
                labelNames: ['opText'] as const,
              },
              fillLabelsFn: params => {
                return {
                  opText: print(params.document!),
                };
              },
            }),
          },
        },
        registry,
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('test_execute', 'count')).toBe(1);
      expect(await metricString('test_execute')).toContain(
        `test_execute_count{opText=\"{\\n  regularField\\n}\"} 1`,
      );
    });

    it('Should trace error during execute with a single error', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_error_result: true,
        },
      });
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="Anonymous",operationType="query",phase="execute",path="errorField"} 1',
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
    });

    it('Should trace error during execute with a multiple errors', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_error_result: true,
        },
      });
      const result = await execute('query { errorField test: errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(2);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="Anonymous",operationType="query",phase="execute",path="errorField"} 1',
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(2);
    });

    it('Should trace error and timing during execute', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_error_result: true,
          graphql_envelop_phase_execute: true,
        },
      });
      const result = await execute('query { errorField test: errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(2);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="Anonymous",operationType="query",phase="execute",path="errorField"} 1',
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(2);
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
    });

    it('Should trace valid execute result', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_phase_execute: true,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
    });

    it('Should skip execute when execute = false', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_phase_execute: false,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(0);
    });

    it('should not contain operationName and operationType if disables', async () => {
      const { execute, metricString } = prepare({
        metrics: {
          graphql_envelop_error_result: true,
          graphql_envelop_phase_execute: true,
        },
        labels: {
          operationName: false,
          operationType: false,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricString('graphql_envelop_phase_execute')).not.toContain(
        ',operationName="Anonymous",operationType="query"',
      );
    });
  });

  describe('errors', () => {
    it('Should allow to use custom Counter and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_error_result: createCounter({
              registry,
              counter: {
                name: 'test_error',
                help: 'HELP ME',
                labelNames: ['opText', 'errorMessage'] as const,
              },
              fillLabelsFn: params => {
                return {
                  opText: print(params.document!),
                  errorMessage: params.error!.message,
                };
              },
            }),
          },
        },
        registry,
      );
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('test_error')).toBe(1);
      expect(await metricString('test_error')).toContain(
        `test_error{opText=\"{\\n  errorField\\n}\",errorMessage=\"error\"} 1`,
      );
    });

    it('Should allow to use custom Counter and custom phases', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          metrics: {
            graphql_envelop_error_result: createCounter({
              registry,
              counter: {
                name: 'test_error',
                help: 'HELP ME',
                labelNames: ['opText', 'errorMessage'] as const,
              },
              fillLabelsFn: params => {
                return {
                  opText: print(params.document!),
                  errorMessage: params.error!.message,
                };
              },
              phases: ['context'],
            }),
          },
        },
        registry,
      );
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('test_error')).toBe(0);
    });

    it('Should not trace parse errors when not needed', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_error_result: false,
        },
      });
      const result = await execute('query {');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
    });

    it('Should not trace validate errors when not needed', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_error_result: false,
        },
      });
      const result = await execute('query test($v: String!) { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
    });

    it('Should not trace execute errors when not needed', async () => {
      const { execute, metricCount } = prepare({
        metrics: { graphql_envelop_error_result: false },
      });
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
    });
  });

  describe('resolvers', () => {
    it('Should trace all resolvers times correctly', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_execute_resolver: true,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_execute_resolver')).toContain(
        'graphql_envelop_execute_resolver_count{operationName="Anonymous",operationType="query",fieldName="regularField",typeName="Query",returnType="String!"} 1',
      );
    });

    it('Should allow custom metric options', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString, allMetrics } = prepare(
        {
          metrics: {
            graphql_envelop_execute_resolver: createHistogram({
              registry,
              fillLabelsFn: ({ document }) => ({
                opText: print(document!),
              }),
              histogram: {
                name: 'graphql_envelop_execute_resolver',
                help: 'test',
                labelNames: ['opText'] as const,
              },
            }),
          },
        },
        registry,
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_execute_resolver')).toContain(
        'graphql_envelop_execute_resolver_count{opText="{\\n  regularField\\n}"} 1',
      );
    });

    it('Should allow custom metric options', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString, allMetrics } = prepare(
        {
          metrics: {
            graphql_envelop_execute_resolver: createHistogram({
              registry,
              fillLabelsFn: ({ document }) => ({
                opText: print(document!),
              }),
              histogram: {
                name: 'graphql_envelop_execute_resolver',
                help: 'test',
                labelNames: ['opText'] as const,
              },
              phases: ['subscribe'],
            }),
          },
        },
        registry,
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(0);
    });

    it('Should trace only specified resolvers when resolversWhitelist is used', async () => {
      const { execute, metricCount, metricString } = prepare({
        metrics: {
          graphql_envelop_execute_resolver: true,
        },
        resolversWhitelist: ['Query.regularField'],
      });
      const result = await execute('query { regularField longField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_execute_resolver')).toContain(
        'graphql_envelop_execute_resolver_count{operationName="Anonymous",operationType="query",fieldName="regularField",typeName="Query",returnType="String!"} 1',
      );
    });
  });

  describe('deprecation', () => {
    it('Should not trace deprecation when not needed', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_deprecated_field: false,
        },
      });
      const result = await execute('query { regularField deprecatedField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_deprecated_field', 'count')).toBe(0);
    });

    it('Should trace all deprecated fields times correctly', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_deprecated_field: true,
        },
      });
      const result = await execute('query { regularField deprecatedField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_deprecated_field')).toBe(1);
    });

    it('Should track deprecated arguments in mutation', async () => {
      const { execute, metricCount, allMetrics, metricString } = prepare({
        metrics: {
          graphql_envelop_deprecated_field: true,
        },
      });
      const result = await execute(
        /* GraphQL */ `
          mutation MutationWithDeprecatedFields($deprecatedInput: String) {
            mutationWithDeprecatedFields(deprecatedInput: $deprecatedInput) {
              payloadField
            }
          }
        `,
        {
          deprecatedInput: 'a deprecated input',
        },
      );
      assertSingleExecutionValue(result);

      const metricStr = await allMetrics();

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_deprecated_field')).toBe(1);

      const metric = await metricString('graphql_envelop_deprecated_field');
      expect(metric).toContain(
        '{operationName="MutationWithDeprecatedFields",operationType="mutation",fieldName="deprecatedInput",typeName="mutationWithDeprecatedFields"}',
      );
    });
  });

  describe('requestCount', () => {
    it('Should not trace requestCount when not needed', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_request: false,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_request')).toBe(0);
    });

    it('Should trace all successful requests', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_request: true,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_request')).toBe(1);
    });

    it('Should trace all successful requests, with multiple req', async () => {
      const { execute, metricValue } = prepare({
        metrics: {
          graphql_envelop_request: true,
        },
      });
      const result1 = await execute('query { regularField }');
      const result2 = await execute('query { regularField }');
      assertSingleExecutionValue(result1);
      assertSingleExecutionValue(result2);

      expect(result1.errors).toBeUndefined();
      expect(result2.errors).toBeUndefined();
      expect(await metricValue('graphql_envelop_request')).toBe(2);
    });
  });

  describe('requestSummary', () => {
    it('Should not trace requestSummary when not needed', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_request_time_summary: false,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_request')).toBe(0);
    });

    it('Should trace all successful requests', async () => {
      const { execute, metricCount } = prepare({
        metrics: {
          graphql_envelop_request_time_summary: true,
        },
      });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_request_time_summary', 'count')).toBe(1);
    });
  });

  describe('schema', () => {
    it('should capture graphql schema changing', async () => {
      const registry = new Registry();
      createTestkit(
        [
          usePrometheus({ registry, metrics: { graphql_envelop_schema_change: true } }),
          {
            onSchemaChange: ({ replaceSchema }) => {
              replaceSchema(
                buildSchema(/* GraphQL */ `
                  type Query {
                    hello: String!
                  }
                `),
              );
            },
          },
        ],
        schema,
      );

      const metrics = await registry.getMetricsAsJSON();
      expect(metrics).toEqual([
        {
          help: 'Counts the amount of schema changes',
          name: 'graphql_envelop_schema_change',
          type: 'counter',
          values: [
            {
              labels: {},
              value: 2,
            },
          ],
          aggregator: 'sum',
        },
      ]);
    });
  });

  it('should be able to be initialized multiple times', async () => {
    const registry = new Registry();
    const allMetrics: PrometheusTracingPluginConfig = {
      metrics: {
        graphql_envelop_request: true,
        graphql_envelop_request_duration: true,
        graphql_envelop_request_time_summary: true,
        graphql_envelop_phase_parse: true,
        graphql_envelop_phase_validate: true,
        graphql_envelop_phase_context: true,
        graphql_envelop_phase_execute: true,
        graphql_envelop_phase_subscribe: true,
        graphql_envelop_error_result: true,
        graphql_envelop_deprecated_field: true,
        graphql_envelop_schema_change: true,
        graphql_envelop_execute_resolver: true,
      },
    };

    prepare(allMetrics, registry); // fake initialization to make sure it doesn't break

    const { execute } = prepare(allMetrics, registry);
    const result = await execute('{ regularField }');
    assertSingleExecutionValue(result);

    expect(result.errors).toBeUndefined();
  });

  it('should be able to register the same histogram for multiple different registries', async () => {
    const registry1 = new Registry();
    const registry2 = new Registry();

    const h1 = registerHistogram(registry1, { name: 'h', help: 'This is a test' });
    const h2 = registerHistogram(registry2, { name: 'h', help: 'This is a test' });

    expect(h1 === h2).toBe(false);
  });

  it('should allow to clear the registry between initializations', async () => {
    const registry = new Registry();

    prepare({ metrics: { graphql_envelop_phase_parse: true } }, registry); // fake initialization to make sure it doesn't break
    registry.clear();
    const { execute, allMetrics } = prepare(
      { metrics: { graphql_envelop_phase_parse: true } },
      registry,
    );
    const result = await execute('{ regularField }');
    assertSingleExecutionValue(result);

    expect(result.errors).toBeUndefined();
    expect(await allMetrics()).toContain('graphql_envelop_phase_parse_count{');
  });
});
