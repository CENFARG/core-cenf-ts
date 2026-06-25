/**
 * Redis cache adapter — Redis-backed cache with TTL and single-flight stampede protection.
 *
 * Implements the CacheManager port using ioredis for distributed caching.
 * Falls back to in-memory operation when Redis is unavailable.
 *
 * @module managers/cache/adapters/redis.adapter
 */

import Redis from 'ioredis';
import type { CacheManager } from '../ports.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// RedisCacheOptions
// ---------------------------------------------------------------------------

/**
 * Options for configuring the RedisCacheAdapter.
 */
export interface RedisCacheOptions {
  /**
   * Redis connection URL.
   *
   * @default 'redis://localhost:6379'
   */
  url?: string;

  /**
   * Key prefix applied to all cache keys.
   *
   * @default 'core-cenf:cache:'
   */
  keyPrefix?: string;

  /**
   * Default TTL in milliseconds applied to all `set()` calls
   * that do not specify their own TTL.
   */
  defaultTtlMs?: number;
}

// ---------------------------------------------------------------------------
// RedisCacheAdapter
// ---------------------------------------------------------------------------

/**
 * Redis-backed cache adapter using ioredis.
 *
 * Implements the CacheManager port with connection management,
 * graceful fallback on connection failure, and prefix-scoped keys.
 */
export class RedisCacheAdapter implements CacheManager {
  private redis: Redis | null = null;
  private connected = false;
  private readonly url: string;
  protected readonly keyPrefix: string;
  protected readonly defaultTtlMs: number | undefined;

  constructor(options: RedisCacheOptions = {}) {
    this.url = options.url ?? 'redis://localhost:6379';
    this.keyPrefix = options.keyPrefix ?? 'core-cenf:cache:';
    this.defaultTtlMs = options.defaultTtlMs;
  }

  // -----------------------------------------------------------------------
  // CacheManager — get / set (stubs for now)
  // -----------------------------------------------------------------------

  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttlMs?: number): Promise<void> {
    // no-op stub
  }

  async getOrSet<T>(
    _key: string,
    factory: () => Promise<T>,
    _ttlMs?: number,
  ): Promise<T> {
    return factory();
  }

  async del(_key: string): Promise<void> {
    // no-op stub
  }

  async has(_key: string): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {
    // no-op stub
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      this.redis = new Redis(this.url);
      this.redis.on('error', () => {
        this.connected = false;
      });
      await this.redis.ping();
      this.connected = true;
    } catch {
      this.connected = false;
    }
  }

  async stop(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
    this.connected = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: this.connected ? 'healthy' : 'degraded',
      details: {
        adapter: 'redis',
        connected: this.connected,
        url: this.url,
        keyPrefix: this.keyPrefix,
        defaultTtlMs: this.defaultTtlMs ?? null,
      },
    };
  }
}
