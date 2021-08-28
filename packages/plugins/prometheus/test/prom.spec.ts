import { PrometheusTracingPluginConfig, usePrometheus, createHistogram, createCounter } from '../src';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { Registry, Histogram, Counter } from 'prom-client';
import { ASTNode, print as graphQLPrint } from 'graphql';
import { useExtendContext } from '@envelop/core';

// Graphql.js 16 and 15 produce different results
// Graphql.js 16 output has not trailing \n
// In order to produce the same output we remove any trailing white-space
const print = (ast: ASTNode) => graphQLPrint(ast).replace(/^\s+|\s+$/g, '');

describe('Prom Metrics plugin', () => {
  const schema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        regularField: String!
        deprecatedField: String @deprecated(reason: "old")
        longField: String!
        errorField: String
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
    },
  });

  function prepare(config: PrometheusTracingPluginConfig, externalRegistry?: Registry) {
    const registry = externalRegistry || new Registry();

    const plugin = usePrometheus({
      ...config,
      registry,
    });
    const teskit = createTestkit(
      [plugin, useExtendContext(() => new Promise<void>(resolve => setTimeout(resolve, 250)))],
      schema
    );

    return {
      execute: teskit.execute,
      plugin,
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
          return ((m as any).values || []).filter((v: any) => (sub === null ? true : v.metricName === `${name}_${sub}`)).length;
        }

        return 0;
      },
      async metricValue(name: string, sub: string | null = null) {
        const arr = await registry.getMetricsAsJSON();
        const m = arr.find(m => m.name === name);

        if (m) {
          return ((m as any).values || []).find((v: any) => (sub === null ? true : v.metricName === `${name}_${sub}`)).value;
        }

        return 0;
      },
    };
  }

  it('integration', async () => {
    const { execute, allMetrics } = prepare({
      errors: true,
      execute: true,
      parse: true,
      validate: true,
      contextBuilding: true,
      deprecatedFields: true,
      resolvers: true,
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

  describe('parse', () => {
    it('Should trace error during parse', async () => {
      const { execute, metricCount, metricString } = prepare({ parse: true, errors: true });
      const result = await execute('query {');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain('graphql_envelop_error_result{phase="parse"} 1');
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      expect(await metricCount('graphql_envelop_phase_parse')).toBe(0);
    });

    it('Should trace valid parse result', async () => {
      const { execute, metricCount, metricString } = prepare({ parse: true, errors: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('graphql_envelop_phase_parse', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_phase_parse')).toContain(
        `graphql_envelop_phase_parse_count{operationName=\"Anonymous\",operationType=\"query\"} 1`
      );
    });

    it('Should skip parse when parse = false', async () => {
      const { execute, metricCount } = prepare({ parse: false });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_parse')).toBe(0);
    });

    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          errors: true,
          parse: createHistogram({
            histogram: new Histogram({
              name: 'test_parse',
              help: 'HELP ME',
              labelNames: ['opText'] as const,
              registers: [registry],
            }),
            fillLabelsFn: params => {
              return {
                opText: print(params.document!),
              };
            },
          }),
        },
        registry
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('test_parse', 'count')).toBe(1);
      expect(await metricString('test_parse')).toContain(`test_parse_count{opText=\"{\\n  regularField\\n}\"} 1`);
    });
  });

  describe('validate', () => {
    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          errors: true,
          validate: createHistogram({
            histogram: new Histogram({
              name: 'test_validate',
              help: 'HELP ME',
              labelNames: ['opText'] as const,
              registers: [registry],
            }),
            fillLabelsFn: params => {
              return {
                opText: print(params.document!),
              };
            },
          }),
        },
        registry
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('test_validate', 'count')).toBe(1);
      expect(await metricString('test_validate')).toContain(`test_validate_count{opText=\"{\\n  regularField\\n}\"} 1`);
    });

    it('should register to onValidate event when needed', () => {
      const { plugin } = prepare({ validate: true, errors: true });
      expect(plugin.onValidate).toBeDefined();
    });

    it('Should trace error during validate, and also trace timing', async () => {
      const { execute, metricCount, metricString } = prepare({ validate: true, errors: true });
      const result = await execute('query test($v: String!) { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="test",operationType="query",phase="validate"} 1'
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      expect(await metricCount('graphql_envelop_phase_validate', 'count')).toBe(1);
    });

    it('Should trace valid validations result', async () => {
      const { execute, metricCount, metricString } = prepare({ validate: true, errors: true });
      const result = await execute('query test { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('graphql_envelop_phase_validate', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_phase_validate')).toContain(
        `graphql_envelop_phase_validate_count{operationName=\"test\",operationType=\"query\"} 1`
      );
    });

    it('Should skip validate when validate = false', async () => {
      const { execute, metricCount } = prepare({ validate: false });
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
          errors: true,
          contextBuilding: createHistogram({
            histogram: new Histogram({
              name: 'test_context',
              help: 'HELP ME',
              labelNames: ['opText'] as const,
              registers: [registry],
            }),
            fillLabelsFn: params => {
              return {
                opText: print(params.document!),
              };
            },
          }),
        },
        registry
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('test_context', 'count')).toBe(1);
      expect(await metricString('test_context')).toContain(`test_context_count{opText=\"{\\n  regularField\\n}\"} 1`);
    });

    it('Should trace contextBuilding timing', async () => {
      const { execute, metricCount } = prepare({ contextBuilding: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_context', 'count')).toBe(1);
    });
    it('Should skip contextBuilding when contextBuilding = false', async () => {
      const { execute, metricCount } = prepare({ contextBuilding: false });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_context')).toBe(0);
    });
  });

  describe('execute', () => {
    it('Should allow to use custom Histogram and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          errors: true,
          execute: createHistogram({
            histogram: new Histogram({
              name: 'test_execute',
              help: 'HELP ME',
              labelNames: ['opText'] as const,
              registers: [registry],
            }),
            fillLabelsFn: params => {
              return {
                opText: print(params.document!),
              };
            },
          }),
        },
        registry
      );
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('test_execute', 'count')).toBe(1);
      expect(await metricString('test_execute')).toContain(`test_execute_count{opText=\"{\\n  regularField\\n}\"} 1`);
    });

    it('Should trace error during execute with a single error', async () => {
      const { execute, metricCount, metricString } = prepare({ errors: true, execute: true });
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="Anonymous",operationType="query",path="errorField",phase="execute"} 1'
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(1);
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
    });

    it('Should trace error during execute with a multiple errors', async () => {
      const { execute, metricCount, metricString } = prepare({ errors: true, execute: true });
      const result = await execute('query { errorField test: errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(2);
      expect(await metricString('graphql_envelop_error_result')).toContain(
        'graphql_envelop_error_result{operationName="Anonymous",operationType="query",path="errorField",phase="execute"} 1'
      );
      expect(await metricCount('graphql_envelop_error_result')).toBe(2);
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
    });

    it('Should trace valid execute result', async () => {
      const { execute, metricCount } = prepare({ errors: true, execute: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
    });

    it('Should skip execute when execute = false', async () => {
      const { execute, metricCount } = prepare({ errors: true, execute: false });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(0);
    });
  });

  describe('errors', () => {
    it('Should allow to use custom Counter and custom labelNames', async () => {
      const registry = new Registry();
      const { execute, metricCount, metricString } = prepare(
        {
          execute: true,
          errors: createCounter({
            counter: new Counter({
              name: 'test_error',
              help: 'HELP ME',
              labelNames: ['opText', 'errorMessage'] as const,
              registers: [registry],
            }),
            fillLabelsFn: params => {
              return {
                opText: print(params.document!),
                errorMessage: params.error!.message,
              };
            },
          }),
        },
        registry
      );
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('test_error')).toBe(1);
      expect(await metricString('test_error')).toContain(`test_error{opText=\"{\\n  errorField\\n}\",errorMessage=\"error\"} 1`);
    });

    it('Should not trace parse errors when not needed', async () => {
      const { execute, metricCount } = prepare({ parse: true, errors: false });
      const result = await execute('query {');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
    });

    it('Should not trace validate errors when not needed', async () => {
      const { execute, metricCount } = prepare({ validate: true, errors: false });
      const result = await execute('query test($v: String!) { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
    });

    it('Should not trace execute errors when not needed', async () => {
      const { execute, metricCount } = prepare({ errors: false });
      const result = await execute('query { errorField }');
      assertSingleExecutionValue(result);

      expect(result.errors?.length).toBe(1);
      expect(await metricCount('graphql_envelop_error_result')).toBe(0);
    });
  });

  describe('resolvers', () => {
    it('Should trace all resolvers times correctly', async () => {
      const { execute, metricCount, metricString } = prepare({ execute: true, resolvers: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_execute_resolver')).toContain(
        'graphql_envelop_execute_resolver_count{operationName="Anonymous",operationType="query",fieldName="regularField",typeName="Query",returnType="String!"} 1'
      );
    });

    it('Should trace only specified resolvers when resolversWhitelist is used', async () => {
      const { execute, metricCount, metricString } = prepare({
        execute: true,
        resolvers: true,
        resolversWhitelist: ['Query.regularField'],
      });
      const result = await execute('query { regularField longField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(1);
      expect(await metricString('graphql_envelop_execute_resolver')).toContain(
        'graphql_envelop_execute_resolver_count{operationName="Anonymous",operationType="query",fieldName="regularField",typeName="Query",returnType="String!"} 1'
      );
    });
  });

  describe('deprecation', () => {
    it('Should not trace deprecation when not needed', async () => {
      const { execute, metricCount } = prepare({ execute: true, resolvers: true });
      const result = await execute('query { regularField deprecatedField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(2);
      expect(await metricCount('graphql_envelop_deprecated_field', 'count')).toBe(0);
    });

    it('Should trace all deprecated fields times correctly', async () => {
      const { execute, metricCount } = prepare({ execute: true, resolvers: true, deprecatedFields: true });
      const result = await execute('query { regularField deprecatedField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_execute_resolver', 'count')).toBe(2);
      expect(await metricCount('graphql_envelop_deprecated_field')).toBe(1);
    });
  });

  describe('requestCount', () => {
    it('Should not trace requestCount when not needed', async () => {
      const { execute, metricCount } = prepare({ requestCount: false, execute: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_request')).toBe(0);
    });

    it('Should trace all sucessfull requests', async () => {
      const { execute, metricCount } = prepare({ requestCount: true, execute: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_request')).toBe(1);
    });

    it('Should trace all sucessfull requests, with multiple req', async () => {
      const { execute, metricValue } = prepare({ requestCount: true, execute: true });
      const result1 = await execute('query { regularField }');
      const result2 = await execute('query { regularField }');
      assertSingleExecutionValue(result1);
      assertSingleExecutionValue(result2);

      expect(result1.errors).toBeUndefined();
      expect(result2.errors).toBeUndefined();
      expect(await metricValue('graphql_envelop_phase_execute', 'count')).toBe(2);
      expect(await metricValue('graphql_envelop_request')).toBe(2);
    });
  });

  describe('requestSummary', () => {
    it('Should not trace requestSummary when not needed', async () => {
      const { execute, metricCount } = prepare({ requestSummary: false, execute: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_request')).toBe(0);
    });

    it('Should trace all sucessfull requests', async () => {
      const { execute, metricCount } = prepare({ requestSummary: true, execute: true });
      const result = await execute('query { regularField }');
      assertSingleExecutionValue(result);

      expect(result.errors).toBeUndefined();
      expect(await metricCount('graphql_envelop_phase_execute', 'count')).toBe(1);
      expect(await metricCount('graphql_envelop_request_time_summary', 'count')).toBe(1);
    });
  });
});
