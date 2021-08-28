import { Plugin, DefaultContext, OnResolverCalledHook, ResolverFn } from '@envelop/types';
import { Path } from 'graphql/jsutils/Path';

type PlainFieldsSet = Set<string>;
type PatternFieldsSet = Set<RegExp>;

export type UseOverrideFieldsOptions<Context = DefaultContext> = {
  fields: Array<string | RegExp>;
  shouldOverride?: (context: Readonly<Context>) => boolean;
  overrideFn?: ResolverFn;
};

const DEFAULT_OPTIONS: Omit<UseOverrideFieldsOptions, 'fields'> = {
  shouldOverride: () => true,
  overrideFn: () => null,
};

export const useOverrideFields = (rawOptions: UseOverrideFieldsOptions): Plugin => {
  const options: UseOverrideFieldsOptions = {
    ...DEFAULT_OPTIONS,
    ...(rawOptions || {}),
  };
  const plainFieldRules: PlainFieldsSet = new Set();
  const patternFieldRules: PatternFieldsSet = new Set();

  for (const field of options.fields) {
    const fieldRulesSet = field instanceof RegExp ? patternFieldRules : plainFieldRules;
    fieldRulesSet.add(field as string & RegExp);
  }

  return {
    onExecute({ args: { contextValue } }) {
      const shouldOverride = options.shouldOverride!(contextValue);

      const onResolverCalled: OnResolverCalledHook | undefined = shouldOverride
        ? ({ replaceResolverFn, info }) => {
            const flattenedFieldPath = flattenPath(info.path);
            const typedFieldName = `${info.parentType}.${info.fieldName}`;

            if (plainFieldRules.has(typedFieldName) || plainFieldRules.has(flattenedFieldPath)) {
              return replaceResolverFn(options.overrideFn!);
            }

            for (const patternRule of patternFieldRules) {
              if (patternRule.test(typedFieldName) || patternRule.test(flattenedFieldPath)) {
                return replaceResolverFn(options.overrideFn!);
              }
            }

            return undefined;
          }
        : undefined;

      return {
        onResolverCalled,
      };
    },
  };
};

function flattenPath(fieldPath: Path, delimiter = '.') {
  let rootType = '';
  const pathArray = [];
  let thisPath: Path | undefined = fieldPath;

  while (thisPath) {
    if (typeof thisPath.key !== 'number') {
      pathArray.push(thisPath.key);
    }
    rootType = thisPath.typename || '';
    thisPath = thisPath.prev;
  }

  return `${rootType}.${pathArray.reverse().join(delimiter)}`;
}
