/**
 * @cenf/cache — key-value caching with TTL and stampede protection.
 *
 * @module @cenf/cache
 */

// Port
export { type CacheManager, CACHE_PORT_VERSION } from './ports.js';

// Types
export type { CacheEntry, CacheOptions } from './types.js';
export { CACHE_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryCacheAdapter, type MemoryCacheOptions } from './adapters/memory.adapter.js';
export { RedisCacheAdapter, type RedisCacheOptions } from './adapters/redis.adapter.js';
