import { compareDesc } from 'date-fns';
import Head from 'next/head';
import React from 'react';

import { handlePushRoute, PackageInstall, RemoteGHMarkdown } from '@guild-docs/client';
import { buildMultipleMDX, CompiledMDX } from '@guild-docs/server';
import { getPackagesData, PackageWithStats } from '@guild-docs/server/npm';
import { MarketplaceSearch } from '@theguild/components';
import { IMarketplaceItemProps } from '@theguild/components/dist/types/components';
import type { Package } from '@guild-docs/server/npm';

import { Markdown } from '../../components/Markdown';
import { ALL_TAGS, pluginsArr as packageList } from '../../lib/plugins';

import type { GetStaticProps } from 'next';
interface MarketplaceProps {
  data: (PackageWithStats & { description: CompiledMDX; content: CompiledMDX })[];
}

export const getStaticProps: GetStaticProps<MarketplaceProps> = async () => {
  const pluginsData = await getPackagesData({
    packageList,
  });

  const data = await Promise.all(
    pluginsData.map(async plugin => {
      const [description, content] = await buildMultipleMDX([
        `${plugin.stats?.collected?.metadata?.version || ''}\n\n${plugin.stats?.collected?.metadata?.description || ''}`,
        plugin.readme || plugin.stats?.collected?.metadata?.readme || '',
      ]);

      return {
        ...plugin,
        description,
        content,
      };
    })
  );

  return {
    props: {
      data,
    },
    // Revalidate at most once every 1 hour
    revalidate: 60 * 60,
  };
};

export default function Marketplace({ data }: MarketplaceProps) {
  const marketplaceItems: Array<IMarketplaceItemProps & { raw: PackageWithStats }> = React.useMemo(() => {
    if (data && data.length > 0) {
      return data.map<IMarketplaceItemProps & { raw: PackageWithStats }>(rawPlugin => {
        const linkHref = `/plugins/${rawPlugin.identifier}`;
        return {
          raw: rawPlugin,
          tags: rawPlugin.tags,
          title: rawPlugin.title,
          link: {
            href: linkHref,
            title: `${rawPlugin.title} plugin details`,
            onClick: ev => handlePushRoute(linkHref, ev),
          },
          description: <Markdown content={rawPlugin.description} />,
          modal: {
            header: {
              image: rawPlugin.iconUrl
                ? {
                    src: rawPlugin.iconUrl,
                    alt: rawPlugin.title,
                  }
                : undefined,
              description: {
                href: `https://www.npmjs.com/package/${rawPlugin.npmPackage}`,
                children: `${rawPlugin.npmPackage} on npm`,
                title: `${rawPlugin.npmPackage} on NPM`,
                target: '_blank',
                rel: 'noopener noreferrer',
              },
            },
            content: (
              <>
                <PackageInstall packages={rawPlugin.npmPackage} />
                <RemoteGHMarkdown
                  directory={rawPlugin.stats?.collected?.metadata?.repository?.directory}
                  repo={rawPlugin.stats?.collected?.metadata?.links?.repository}
                  content={rawPlugin.content}
                />
              </>
            ),
          },
          update: rawPlugin.stats?.collected?.metadata?.date || new Date().toISOString(),
          image: rawPlugin.iconUrl
            ? {
                height: 60,
                width: 60,
                src: rawPlugin.iconUrl,
                alt: rawPlugin.title,
              }
            : undefined,
        };
      });
    }

    return [];
  }, [data]);

  const recentlyUpdatedItems = React.useMemo(() => {
    if (marketplaceItems && marketplaceItems.length > 0) {
      return [...marketplaceItems].sort((a, b) => {
        return compareDesc(new Date(a.update), new Date(b.update));
      });
    }

    return [];
  }, [marketplaceItems]);

  const trendingItems = React.useMemo(() => {
    if (marketplaceItems && marketplaceItems.length > 0) {
      return [...marketplaceItems]
        .filter(i => i.raw.stats?.collected?.npm.downloads && i.raw.npmPackage !== '@envelop/core')
        .sort((a, b) => {
          const aMonthlyDownloads = a.raw.stats?.collected.npm.downloads[2].count || 0;
          const bMonthlyDownloads = b.raw.stats?.collected.npm.downloads[2].count || 0;

          return bMonthlyDownloads - aMonthlyDownloads;
        });
    }

    return [];
  }, [marketplaceItems]);

  // const randomThirdParty = React.useMemo(() => {
  //   if (marketplaceItems && marketplaceItems.length > 0) {
  //     return [...marketplaceItems]
  //       .filter(item => item.raw.npmPackage !== '@envelop/core')
  //       .sort(() => 0.5 - Math.random())
  //       .slice(0, 3);
  //   }

  //   return [];
  // }, [marketplaceItems]);

  return (
    <>
      <Head>
        <title>Plugin Hub</title>
      </Head>

      {/* <CardsColorful
            cards={randomThirdParty.map(item => ({
              title: item.title,
              description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
              category: 'Discover new Envelop plugins!',
              link: {
                href: `https://www.npmjs.com/package/${item.raw.npmPackage}`,
                target: '_blank',
                rel: 'noopener norefereer',
                title: 'Learn more',
              },
              color: '#3547E5',
            }))}
          /> */}
      <MarketplaceSearch
        title="Explore Plugin Hub"
        tagsFilter={ALL_TAGS as any as string[]}
        placeholder="Find plugins..."
        primaryList={{
          title: 'Trending',
          items: trendingItems,
          placeholder: '0 items',
          pagination: 8,
        }}
        secondaryList={{
          title: 'Recently Updated',
          items: recentlyUpdatedItems,
          placeholder: '0 items',
          pagination: 8,
        }}
        queryList={{
          title: 'Search Results',
          items: marketplaceItems,
          placeholder: 'No results for {query}',
          pagination: 8,
        }}
      />
    </>
  );
}
