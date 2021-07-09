import { format } from 'date-fns';
import { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import tw, { styled } from 'twin.macro';
import Link from 'next/link';

import { Box, Center, Code, Container, Grid, SimpleGrid } from '@chakra-ui/react';
import { buildMDX, CompiledMDX } from '@guild-docs/server';

import { PackageInstall } from '../../components/packageInstall';
import { RemoteGHMarkdown } from '../../components/RemoteGhMarkdown';
import { getPluginsData, PluginWithStats } from '../../lib/pluginsData';

export const SubTitle = styled.h2(() => [tw`mt-0 mb-4 font-bold text-lg md:text-xl`]);
export const Title = styled.h2(() => [tw`mt-0 mb-4 font-bold text-xl md:text-2xl`]);

interface PluginPageProps {
  data: (PluginWithStats & { mdx: CompiledMDX })[];
}

type PluginPageParams = {
  name: string;
};

export const getStaticProps: GetStaticProps<PluginPageProps, PluginPageParams> = async ctx => {
  const pluginName = ctx.params?.name;

  const pluginsData =
    typeof pluginName === 'string'
      ? await getPluginsData({
          idSpecific: pluginName,
        })
      : [];

  const data = await Promise.all(
    pluginsData.map(async plugin => {
      return {
        ...plugin,
        mdx: await buildMDX(plugin.readme || plugin.stats?.collected?.metadata?.readme || ''),
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

export const getStaticPaths: GetStaticPaths<PluginPageParams> = async () => {
  const plugins = await getPluginsData();

  return {
    fallback: 'blocking',
    paths: plugins.map(({ identifier }) => {
      return {
        params: {
          name: identifier,
        },
      };
    }),
  };
};

export default function PluginPageContent({ data }: PluginPageProps) {
  if (!data.length) {
    return (
      <Center h="300px" flexDir={'column'}>
        <SubTitle>404</SubTitle>
        <div>Plugin not found.</div>
      </Center>
    );
  }

  const pluginData = data[0];

  return (
    <section>
      <Container p={'1.5rem'} maxWidth={1200}>
        <Title>
          <Link href="/plugins" passHref>
            <a>Plugin Hub</a>
          </Link>
          {'>'} {pluginData.title}
        </Title>
        <Grid templateColumns={['1fr', '1fr', '1fr 350px']} gap={4}>
          <Box>
            <PackageInstall packageName={pluginData.npmPackage} />
            <RemoteGHMarkdown
              directory={pluginData.stats?.collected?.metadata?.repository?.directory}
              repo={pluginData.stats?.collected?.metadata?.links?.repository}
              content={pluginData.mdx}
            />
          </Box>
          <Box gridRow={['1', '1', 'auto']}>
            <SubTitle>Plugin Details</SubTitle>
            <SimpleGrid columns={2}>
              <div>Identifier</div>
              <div>
                <Code>{pluginData.npmPackage}</Code>
              </div>
              {pluginData.stats?.collected?.metadata?.license ? (
                <>
                  <div>License</div>
                  <div>
                    <Code>{pluginData.stats.collected.metadata.license}</Code>
                  </div>
                </>
              ) : null}
              {pluginData.stats?.collected?.metadata?.version ? (
                <>
                  <div>Version</div>
                  <div>
                    <Code>{pluginData.stats.collected.metadata.version}</Code>
                  </div>
                </>
              ) : null}
              {pluginData.stats?.collected?.metadata?.date ? (
                <>
                  <div>Updated</div>
                  <div>
                    <Code>{format(new Date(pluginData.stats.collected.metadata.date), 'MMM do, yyyy')}</Code>
                  </div>
                </>
              ) : null}
              {pluginData.stats?.collected?.github?.starsCount ? (
                <>
                  <div>Stars</div>
                  <div>
                    <Code>{pluginData.stats.collected.github?.starsCount}</Code>
                  </div>
                </>
              ) : null}
            </SimpleGrid>
          </Box>
        </Grid>
      </Container>
    </section>
  );
}
