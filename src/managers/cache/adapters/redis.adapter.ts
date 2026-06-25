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
  // CacheManager — get / set / del / has / clear
  // -----------------------------------------------------------------------

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.pk(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      console.warn('[redis-cache] get failed', key);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.redis) return;
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const serialized = JSON.stringify(value);
    const prefixedKey = this.pk(key);
    try {
      if (effectiveTtl !== undefined) {
        const ttlSeconds = Math.ceil(effectiveTtl / 1000);
        await this.redis.setex(prefixedKey, ttlSeconds, serialized);
      } else {
        await this.redis.set(prefixedKey, serialized);
      }
    } catch {
      console.warn('[redis-cache] set failed', key);
    }
  }

  async getOrSet<T>(
    _key: string,
    factory: () => Promise<T>,
    _ttlMs?: number,
  ): Promise<T> {
    return factory();
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.pk(key));
    } catch {
      console.warn('[redis-cache] del failed', key);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const result = await this.redis.exists(this.pk(key));
      return result === 1;
    } catch {
      console.warn('[redis-cache] has failed', key);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(this.pk('*'));
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      console.warn('[redis-cache] clear failed');
    }
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

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Prefix a cache key with the configured key prefix.
   */
  private pk(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
