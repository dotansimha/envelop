/* eslint-disable no-console */
import { basename, extname, isAbsolute, resolve } from 'path';
import { readFile } from 'fs/promises';
import { PersistedOperationsStore } from './plugin';

export class JsonFilesStore {
  private stores: Map<string, PersistedOperationsStore> = new Map();
  private paths: string[];

  constructor(jsonFilePaths: string[]) {
    this.paths = jsonFilePaths;
  }

  get(listName = ''): PersistedOperationsStore {
    const useList = this.paths.length === 1 ? 'main' : listName;
    return this.stores.get(useList) || new Map();
  }

  private parseList(listName: string, content: string): void {
    const operationsObject = JSON.parse(content) as { [key: string]: string };
    const listStore = new Map();

    for (const [key, value] of Object.entries(operationsObject)) {
      listStore.set(key, value);
    }

    this.stores.set(this.paths.length === 1 ? 'main' : listName, listStore);
  }

  public load(whitelist: string[] = []): Promise<string[]> {
    const readListPromises = [];

    for (const filePath of this.paths) {
      const extension = extname(filePath);
      const listName = basename(filePath, extension);

      if (extension !== '.json') {
        console.error(`Persisted operations file must be JSON format, received: ${filePath}`);
        continue;
      } else if (whitelist.length && !whitelist.includes(listName)) {
        // in case of whitelist, only process lists whose name is whitelisted
        continue;
      }

      const operationsFile = filePath && (isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath));

      readListPromises.push(
        readFile(operationsFile, 'utf8')
          .then(content => {
            console.info(`Successfully loaded persisted operations from "${listName}"`);
            this.parseList(listName, content);
            return filePath;
          })
          .catch(error => {
            console.error(`Could not load persisted operations from: ${filePath}`);
            return error;
          })
      );
    }

    return Promise.all(readListPromises);
  }
}
