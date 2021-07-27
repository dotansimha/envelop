/* eslint-disable no-console */
import { basename, extname, isAbsolute, resolve } from 'path';
import { readFile } from 'fs/promises';
import { PersistedOperationsStore } from './plugin';

export class JsonFilesStore {
  private store: PersistedOperationsStore = new Map();
  private paths: string[];

  constructor(jsonFilePaths: string[]) {
    this.paths = jsonFilePaths;
  }

  get(): PersistedOperationsStore {
    return this.store;
  }

  private parseList(content: string): void {
    const operationsObject = JSON.parse(content) as { [key: string]: string };

    for (const [key, value] of Object.entries(operationsObject)) {
      this.store.set(key, value);
    }
  }

  public load(): Promise<string[]> {
    const readListPromises = [];

    for (const filePath of this.paths) {
      const extension = extname(filePath);
      const listName = basename(filePath, extension);

      if (extension !== '.json') {
        console.error(`Persisted operations file must be JSON format, received: ${filePath}`);
        continue;
      }

      const operationsFile = filePath && (isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath));

      readListPromises.push(
        readFile(operationsFile, 'utf8')
          .then(content => {
            console.info(`Successfully loaded persisted operations from "${listName}"`);
            this.parseList(content);
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
