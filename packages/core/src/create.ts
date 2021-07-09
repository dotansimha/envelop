import { GetEnvelopedFn, ComposeContext, Plugin, ArbitraryObject } from '@envelop/types';
import { createEnvelopOrchestrator, EnvelopOrchestrator } from './orchestrator';
import { traceOrchestrator } from './traced-orchestrator';

export function envelop<PluginsType extends Plugin<any>[]>(options: {
  plugins: PluginsType;
  enableInternalTracing?: boolean;
}): GetEnvelopedFn<ComposeContext<PluginsType>> {
  let orchestrator = createEnvelopOrchestrator<ComposeContext<PluginsType>>(options.plugins as any);

  if (options.enableInternalTracing) {
    orchestrator = traceOrchestrator(orchestrator);
  }

  const getEnveloped = <TInitialContext extends ArbitraryObject>(initialContext: TInitialContext = {} as TInitialContext) => {
    const typedOrchestrator = orchestrator as EnvelopOrchestrator<TInitialContext, ComposeContext<PluginsType>>;

    return {
      parse: typedOrchestrator.parse(initialContext),
      validate: typedOrchestrator.validate(initialContext),
      contextFactory: typedOrchestrator.contextFactory(initialContext),
      execute: typedOrchestrator.execute,
      subscribe: typedOrchestrator.subscribe,
      schema: typedOrchestrator.schema!,
    };
  };

  getEnveloped._plugins = options.plugins;

  return getEnveloped as any;
}
