/**
 * In-memory cache adapter — Map-based cache with TTL support.
 *
 * Implements the CacheManager port with no external dependencies.
 * Provides O(1) get/set/has/del via a native Map, with optional
 * TTL expiration and XFetch stampede protection in `getOrSet`.
 *
 * @module managers/cache/adapters/memory.adapter
 */

import type { CacheManager } from '../ports.js';
import type { CacheEntry } from '../types.js';
import type { HealthStatus } from '@cenf/core';

/**
 * Options for configuring the MemoryCacheAdapter.
 */
export interface MemoryCacheOptions {
  /**
   * Default TTL in milliseconds applied to all `set()` calls
   * that do not specify their own TTL.
   *
   * When omitted, entries never expire by default.
   */
  defaultTtlMs?: number;

  /**
   * XFetch stampede protection window in milliseconds.
   *
   * When a key is within this many ms of expiry, `getOrSet()`
   * triggers an early recompute to prevent thundering herd
   * on cache miss. Set to 0 to disable.
   *
   * Default: 0 (disabled).
   */
  stampedeWindowMs?: number;
}

// ---------------------------------------------------------------------------
// MemoryCacheAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory cache adapter backed by a native `Map`.
 *
 * Supports optional TTL-based expiration and XFetch stampede
 * protection via `getOrSet`. Designed for testing and single-instance
 * deployments where a shared cache is not required.
 *
 * Use this adapter:
 * - In unit tests where Redis is not available
 * - For single-process applications with no need for shared cache
 * - As a fallback when Redis fails to connect
 */
export class MemoryCacheAdapter implements CacheManager {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number | undefined;
  private readonly stampedeWindowMs: number;

  /** Single-flight pending getOrSet operations to prevent thundering herd. */
  private pendingGets = new Map<string, Promise<unknown>>();

  constructor(options?: MemoryCacheOptions) {
    this.defaultTtlMs = options?.defaultTtlMs;
    this.stampedeWindowMs = options?.stampedeWindowMs ?? 0;
  }

  // -----------------------------------------------------------------------
  // CacheManager — get / set
  // -----------------------------------------------------------------------

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: effectiveTtl !== undefined ? Date.now() + effectiveTtl : undefined,
    });
  }

  // -----------------------------------------------------------------------
  // CacheManager — getOrSet (XFetch stampede protection)
  // -----------------------------------------------------------------------

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    // Check for an existing pending operation (single-flight)
    const pending = this.pendingGets.get(key);
    if (pending !== undefined) {
      return pending as Promise<T>;
    }

    const entry = this.store.get(key);

    // Valid cached value — return it (no factory call needed).
    if (entry && !this.isExpired(entry) && !this.shouldEarlyRecompute(entry)) {
      return entry.value as T;
    }

    // Clean up expired entry
    if (entry && this.isExpired(entry)) {
      this.store.delete(key);
    }

    // Cache miss or expired or early recompute — compute with single-flight
    const promise = this.computeAndStore<T>(key, factory, ttlMs);
    this.pendingGets.set(key, promise);
    try {
      return await promise;
    } finally {
      this.pendingGets.delete(key);
    }
  }

  // -----------------------------------------------------------------------
  // CacheManager — del / has / clear
  // -----------------------------------------------------------------------

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // Re-initialize the store to ensure a clean state on start.
    this.store = new Map<string, CacheEntry<unknown>>();
  }

  async stop(): Promise<void> {
    // Clear the store on stop — all cached data is released.
    this.store.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        keyCount: this.store.size,
        defaultTtlMs: this.defaultTtlMs ?? null,
        stampedeWindowMs: this.stampedeWindowMs,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Check if a cache entry has expired.
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return entry.expiresAt !== undefined && entry.expiresAt <= Date.now();
  }

  /**
   * Determine whether an early recompute should be triggered
   * based on the XFetch stampede window.
   */
  private shouldEarlyRecompute(entry: CacheEntry<unknown>): boolean {
    if (this.stampedeWindowMs <= 0) return false;
    if (entry.expiresAt === undefined) return false;
    const delta = entry.expiresAt - Date.now();
    return delta < this.stampedeWindowMs;
  }

  /**
   * Invoke the factory, store the result, and return it.
   */
  private async computeAndStore<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }
}
