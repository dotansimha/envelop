import type { ExecutionResult } from 'graphql';
import type { CacheEntityRecord } from '@envelop/response-cache';
import { buildEntityKey, buildOperationKey } from './cache-key.js';
import type { KvCacheConfig } from './index.js';

export async function set(
  /** id/hash of the operation */
  id: string,
  /** the result that should be cached */
  data: ExecutionResult,
  /** array of entity records that were collected during execution */
  entities: Iterable<CacheEntityRecord>,
  /** how long the operation should be cached (in milliseconds) */
  ttl: number,
  config: KvCacheConfig,
): Promise<void> {
  const ttlInSeconds = Math.max(Math.floor(ttl / 1000), 60); // KV TTL must be at least 60 seconds
  const operationKey = buildOperationKey(id, config.keyPrefix);
  const operationKeyWithoutPrefix = buildOperationKey(id);
  const kvPromises: Promise<unknown>[] = []; // Collecting all the KV operations so we can await them all at once

  kvPromises.push(
    config.KV.put(operationKey, JSON.stringify(data), {
      expirationTtl: ttlInSeconds,
      metadata: { operationKey },
    }),
  );

  // Store connections between the entities and the operation key
  // E.g if the entities are User:1 and User:2, we need to know that the operation key is connected to both of them
  for (const entity of entities) {
    const entityKey = buildEntityKey(entity.typename, entity.id, config.keyPrefix);
    kvPromises.push(
      config.KV.put(`${entityKey}:${operationKeyWithoutPrefix}`, operationKey, {
        expirationTtl: ttlInSeconds,
        metadata: { operationKey },
      }),
    );
  }

  await Promise.allSettled(kvPromises);
}
