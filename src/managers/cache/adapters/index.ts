/**
 * Cache adapters barrel — re-exports all cache adapter implementations.
 *
 * @module managers/cache/adapters
 */

export { MemoryCacheAdapter } from './memory.adapter.js';
export type { MemoryCacheOptions } from './memory.adapter.js';
export { RedisCacheAdapter } from './redis.adapter.js';
export type { RedisCacheOptions } from './redis.adapter.js';
