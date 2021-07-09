import { Link } from '@chakra-ui/react';
import { MDX } from '@guild-docs/client';

import type { ComponentProps } from 'react';
import type { CompiledMDX } from '@guild-docs/server';

export const extraComponents = {
  a(props: ComponentProps<'a'>) {
    return (
      <Link
        display="inline"
        color="#2f77c9"
        _hover={{
          textDecoration: 'underline',
        }}
        target="_blank"
        {...props}
      />
    );
  },
};

export const Markdown = ({ content }: { content: CompiledMDX }) => {
  return <MDX mdx={content.mdx} extraComponents={extraComponents} />;
};
