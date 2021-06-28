/* eslint-disable no-console */
import { basename, extname, isAbsolute, resolve } from 'path';
import { readFile } from 'fs/promises';
import { PersistedQueriesStore, PersistedQueriesStoreList } from './plugin';

export class JsonFilesStore implements PersistedQueriesStore {
  private store: PersistedQueriesStoreList = new Map();
  private paths: string[];

  constructor(jsonFilePaths: string[]) {
    this.paths = jsonFilePaths;
  }

  get(): PersistedQueriesStoreList {
    return this.store;
  }

  public load(whitelist: string[] = []): Promise<string[]> {
    const readListPromises = [];

    for (const filePath of this.paths) {
      const extension = extname(filePath);
      const listName = basename(filePath, extension);

      if (extension !== '.json') {
        console.error(`Persisted query file must be JSON format, received: ${filePath}`);
        continue;
      } else if (whitelist.length && !whitelist.includes(listName)) {
        // in case of whitelist (most likely to update existing store), only process lists whose name is whitelisted
        continue;
      }

      const queriesFile = filePath && (isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath));

      readListPromises.push(
        readFile(queriesFile, 'utf8')
          .then(content => {
            console.info(`Successfully loaded persisted queries from "${listName}"`);
            this.store.set(listName, JSON.parse(content));
            return filePath;
          })
          .catch(error => {
            console.error(`Could not load persisted queries from: ${filePath}`);
            return error;
          })
      );
    }

    return Promise.all(readListPromises);
  }
}
