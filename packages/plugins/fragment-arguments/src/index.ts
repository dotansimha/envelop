import { Plugin } from '@envelop/types';
import { ParseOptions } from 'graphql/language/parser';
import { Source, DocumentNode } from 'graphql';
import { FragmentArgumentCompatibleParser } from './extended-parser';
import { applySelectionSetFragmentArguments } from './utils';

export function parseWithFragmentArguments(source: string | Source, options?: ParseOptions): DocumentNode {
  const parser = new FragmentArgumentCompatibleParser(source, options);

  return parser.parseDocument();
}

export const useFragmentArguments = (): Plugin => {
  return {
    onParse({ setParseFn }) {
      setParseFn(parseWithFragmentArguments);

      return ({ result, replaceParseResult }) => {
        if (result && 'kind' in result) {
          replaceParseResult(applySelectionSetFragmentArguments(result));
        }
      };
    },
  };
};
