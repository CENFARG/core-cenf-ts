/**
 * CacheManager-specific types.
 *
 * Types for cache entries, configuration, and expiration tracking.
 *
 * @module managers/cache/types
 */

// ---------------------------------------------------------------------------
// CacheEntry — a stored value with optional expiration
// ---------------------------------------------------------------------------

/**
 * A single cache entry containing the stored value and optional expiration.
 *
 * When `expiresAt` is omitted or in the future, the entry is considered valid.
 * When `expiresAt` is in the past, the entry is expired and MUST NOT be returned.
 */
export interface CacheEntry<T> {
  /** The cached value. */
  value: T;
  /**
   * Unix timestamp (ms) when this entry expires.
   *
   * Omitted for entries that never expire. When present and in the past,
   * the entry is considered expired.
   */
  expiresAt?: number;
}

// ---------------------------------------------------------------------------
// CacheOptions — configuration for cache operations
// ---------------------------------------------------------------------------

/**
 * Options for configuring cache operations.
 *
 * Used by `set()` and `getOrSet()` to control TTL and stampede protection.
 */
export interface CacheOptions {
  /**
   * Time-to-live in milliseconds.
   *
   * After this duration, the cached entry is considered expired.
   * Default: no expiration (lives until evicted or cleared).
   */
  ttlMs?: number;

  /**
   * XFetch stampede protection window in milliseconds.
   *
   * When a key is within this many milliseconds of expiry,
   * `getOrSet()` probabilistically triggers early recompute
   * to prevent thundering herd on cache miss.
   *
   * Default: 0 (disabled).
   */
  stampedeWindowMs?: number;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const CACHE_TYPES_VERSION = '0.1.0';
