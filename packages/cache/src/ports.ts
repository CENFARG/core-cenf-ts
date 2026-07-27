/**
 * CacheManager port interface — key-value caching with TTL and stampede protection.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/cache/ports
 */

import type { AsyncLifecycle } from '@cenf/core';

/**
 * Cache manager port for key-value caching operations.
 *
 * Provides get/set/del/has/clear operations with TTL support
 * and XFetch-based cache stampede protection via `getOrSet`.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface CacheManager extends AsyncLifecycle {
  /**
   * Retrieve a cached value by key.
   *
   * Returns `null` if the key does not exist or has expired.
   *
   * @param key - The cache key.
   * @returns The cached value, or `null` if not found / expired.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in the cache with an optional TTL.
   *
   * @param key - The cache key.
   * @param value - The value to store.
   * @param ttlMs - Time-to-live in milliseconds. Omit for no expiration.
   */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

  /**
   * Get a cached value, or compute and store it if missing or expired.
   *
   * Implements XFetch probabilistic early recompute to prevent
   * thundering herd when hot keys approach expiry.
   *
   * @param key - The cache key.
   * @param factory - Async function to compute the value on cache miss.
   * @param ttlMs - Time-to-live in milliseconds for the stored value.
   * @returns The cached or freshly computed value.
   */
  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T>;

  /**
   * Delete a cached key.
   *
   * No-op if the key does not exist.
   *
   * @param key - The cache key to remove.
   */
  del(key: string): Promise<void>;

  /**
   * Check whether a key exists (and is not expired) in the cache.
   *
   * @param key - The cache key.
   * @returns `true` if the key exists and has not expired.
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all entries from the cache.
   */
  clear(): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const CACHE_PORT_VERSION = '0.1.0';
