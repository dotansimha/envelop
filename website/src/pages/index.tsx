import Head from 'next/head';
import { FeatureList, HeroGradient, HeroIllustration, HeroMarketplace, InfoList } from '@theguild/components';
import { handlePushRoute } from '@guild-docs/client';

export default function Index() {
  return (
    <>
      <Head>
        <title>Envelop</title>
      </Head>
      <HeroGradient
        title="Envelop: The missing GraphQL plugin system"
        description={`Develop and share plugins that are usable with any GraphQL server framework or schema.`}
        link={{
          href: '/docs',
          children: 'Get Started',
          title: 'Learn more about GraphQL Envelop',
          onClick: e => handlePushRoute('/docs', e),
        }}
        version={
          <a href="https://www.npmjs.com/package/@envelop/core" target="_blank">
            <img src="https://badge.fury.io/js/%40envelop%2Fcore.svg" alt="npm version" height="18" />
          </a>
        }
        colors={['#FF34AE', '#1CC8EE']}
        image={{
          src: '/assets/home-claw.png',
          alt: 'Illustration',
        }}
      />
      <FeatureList
        title="What is Envelop?"
        items={[
          {
            image: {
              alt: 'Pluggable',
              src: '/assets/features-pluggable.png',
            },
            title: 'Pluggable',
            description: 'Powerful plugin system that wraps the entire GraphQL execution pipeline.',
          },
          {
            image: {
              alt: 'Flexible',
              src: '/assets/features-modern.png',
            },
            title: 'Flexible',
            description: 'Use any HTTP server, and any GraphQL schema (code-first or schema-first).',
          },
          {
            image: {
              alt: 'Develop Faster',
              src: '/assets/features-performant.png',
            },
            title: 'Develop Faster',
            description: `You don't have to reinvent the wheel for every feature. Write or reuse existing plugins.`,
          },
        ]}
      />
      {/* <HeroVideo
        title="Easy Installation"
        description=""
        link={{
          href: '/docs',
          children: 'Documentation',
          title: 'Read the documentation',
          onClick: e => handleRoute('/docs', e, router),
        }}
        video={{
          src: '//',
          placeholder: '/assets/video-placeholder.png',
        }}
        flipped
      /> */}
      <HeroIllustration
        title="How does it work?"
        description={`Envelop providers a low-level hook-based plugin API for developers. By combining plugins, you can compose your own GraphQL "framework", and get a modified version of GraphQL with the capabilities you need.`}
        image={{
          src: '/assets/home-communication.png',
          alt: 'Illustration',
        }}
        flipped
      />
      <HeroMarketplace
        title="Plugin Hub"
        description="Find, explore, try and test plugins for Envelop."
        link={{
          href: '/plugins',
          children: 'Explore plugins',
          title: 'Learn more about the Plugin Hub',
          onClick: e => handlePushRoute('/plugins', e),
        }}
      />
      <InfoList
        title="Learn More"
        items={[
          {
            title: 'The envelop approach',
            description: 'Learn more about Envelop core and how it works',
            link: {
              href: '/docs',
              children: 'Documentation',
              title: 'Read the documentation',
              onClick: e => handlePushRoute('/docs', e),
            },
          },
          {
            title: 'Integrations',
            description: 'Integrate envelop with your existing setup quickly, based on usage examples.',
            link: {
              href: '/docs/integrations',
              children: 'Integrations & Examples',
              title: 'Read the documentation',
              onClick: e => handlePushRoute('/docs/integrations', e),
            },
          },
          {
            title: 'Custom Plugins',
            description: 'Learn how to plan, build and share envelop plugins.',
            link: {
              href: '/docs/plugins',
              children: 'API Reference',
              title: 'Read the documentation',
              onClick: e => handlePushRoute('/docs/plugins', e),
            },
          },
          // {
          //   title: 'Envelop tutorial',
          //   description: 'Learn how to create a NodeJS (optionally TypeScript) server from scratch, based on Envelop.',
          //   link: {
          //     href: '/docs/plugins',
          //     children: 'Start with the tutorial',
          //     title: 'Start with the tutorial',
          //   },
          // },
        ]}
      />
    </>
  );
}
