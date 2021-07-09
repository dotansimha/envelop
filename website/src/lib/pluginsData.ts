import Lru from 'tiny-lru';
import { NpmsIO, PackageInfo } from 'npms.io';
import { pluginsArr, RawPlugin } from './plugins';

const npmsIO = new NpmsIO();
const cache = Lru(100, 3.6e6); // 1h

export type PluginWithStats = RawPlugin & {
  stats: PackageInfo;
};

async function getPackageStats(name: string): Promise<PackageInfo | null> {
  try {
    return await npmsIO.api.package.packageInfo(name);
  } catch (e) {
    return null;
  }
}

export interface GetPluginsOptions {
  idSpecific?: string | null;
}

export async function getPluginsData({ idSpecific }: GetPluginsOptions = {}) {
  let plugins = pluginsArr;

  if (idSpecific) {
    const rawPlugin = pluginsArr.find(t => t.identifier === idSpecific);

    if (!rawPlugin) return [];

    plugins = [rawPlugin];
  }

  const allPlugins = await Promise.all(
    plugins.map(async rawPlugin => {
      const stats = cache.get(rawPlugin.title) || (await getPackageStats(rawPlugin.npmPackage));

      if (rawPlugin && !cache.has(rawPlugin.title)) {
        cache.set(rawPlugin.title, stats);
      }

      return {
        ...rawPlugin,
        stats,
      };
    })
  );

  return allPlugins;
}
