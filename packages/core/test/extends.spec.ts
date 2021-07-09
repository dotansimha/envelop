import { createSpiedPlugin, createTestkit } from '@envelop/testing';
import { envelop, useExtendContext, useLogger, useSchema } from '../src';
import { useEnvelop } from '../src/plugins/use-envelop';
import { schema, query } from './common';

describe('extending envelops', () => {
  it('should allow to extend envelops', async () => {
    const spiedPlugin = createSpiedPlugin();

    const baseEnvelop = envelop({
      plugins: [useLogger(), spiedPlugin.plugin],
    });

    const onExecuteChildSpy = jest.fn();

    const instance = envelop({
      plugins: [
        useEnvelop(baseEnvelop),
        useSchema(schema),
        {
          onExecute: onExecuteChildSpy,
        },
      ],
    });

    const teskit = createTestkit(instance);
    await teskit.execute(query, {});
    expect(onExecuteChildSpy).toHaveBeenCalledTimes(1);
    expect(spiedPlugin.spies.beforeExecute).toHaveBeenCalledTimes(1);
    expect(spiedPlugin.spies.afterExecute).toHaveBeenCalledTimes(1);
  });
});
