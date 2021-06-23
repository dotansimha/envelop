import { Plugin, DefaultContext } from '@envelop/core';
import { DocumentNode, parse, Source, GraphQLError } from 'graphql';

const contextProperty = 'documentId';

export type PersistedQueriesStoreList = Map<string, { [key: string]: string }>;

export interface PersistedQueriesStore {
  listsMap(): PersistedQueriesStoreList;
  buildStore(): Promise<void>;
}

interface PluginContext {
  [contextProperty]?: string;
}

export type UsePersistedQueriesOptions = {
  store: PersistedQueriesStore;
  onlyPersisted?: boolean;
  setQueryId?: (context: Readonly<DefaultContext>) => string;
  pickSingleList?: (context: Readonly<DefaultContext>) => string;
};

const DEFAULT_OPTIONS: Omit<UsePersistedQueriesOptions, 'store'> = {
  onlyPersisted: false,
};

export const usePersistedQueries = (rawOptions: UsePersistedQueriesOptions): Plugin<PluginContext> => {
  const options: UsePersistedQueriesOptions = {
    ...DEFAULT_OPTIONS,
    ...(rawOptions || {}),
  };
  const store = options.store.listsMap();

  return {
    onParse({ context, params, extendContext, setParsedDocument }) {
      const queryId = options.setQueryId ? options.setQueryId(context) : queryIdFromSource(params.source);
      const pickedListName = options.pickSingleList && options.pickSingleList(context);
      const pickedList = pickedListName ? store.get(pickedListName) : undefined;
      const hasPickedList = Boolean(pickedList);

      // if a list has been picked, check for persisted query within that list
      if (queryId && pickedListName && hasPickedList && pickedList![queryId]) {
        return handleSuccess(setParsedDocument, extendContext, pickedList![queryId], queryId, pickedListName);
      }

      // if no list picked, search throughout all persisted queries lists available
      if (queryId && !pickedListName) {
        // eslint-disable-next-line no-restricted-syntax
        for (const [listName, queries] of store) {
          if (queries[queryId]) {
            return handleSuccess(setParsedDocument, extendContext, queries[queryId], queryId, listName);
          }
        }
      }

      // no match found, if onlyPersisted throw error; otherwise oepration flow can progress
      if (options.onlyPersisted) return handleFailure(queryId, pickedListName, hasPickedList);
    },
  };
};

function queryIdFromSource(source: string | Source): string | undefined {
  return typeof source === 'string' && source.length && source.indexOf('{') === -1 ? source : undefined;
}

function handleSuccess(
  setParsedDocument: (doc: DocumentNode) => void,
  extendContext: (contextExtension: PluginContext) => void,
  rawDocument: string | Source,
  queryId: string,
  listName: string
) {
  console.info(`Persisted query matched in "${listName}", with id "${queryId}"`);

  extendContext({ [contextProperty]: queryId });
  setParsedDocument(parse(rawDocument));
}

function handleFailure(queryId?: string, listName?: string, isListAvailable?: boolean) {
  if (!queryId) {
    console.error('Query id not sent when "onlyPersisted" is set to true, unable to process request');

    throw new GraphQLError('Must provide query id');
  }

  console.error(
    // eslint-disable-next-line no-nested-ternary
    listName
      ? isListAvailable
        ? `Unable to match query with id "${queryId}", within requested list "${listName}"`
        : `Requested persisted queries list not available. List: "${listName}", query id "${queryId}"`
      : `Unable to match query with id "${queryId}", across all provided lists`
  );
  throw new GraphQLError(listName ? 'Unable to match query within requested list' : `Unable to match query with id "${queryId}"`);
}
