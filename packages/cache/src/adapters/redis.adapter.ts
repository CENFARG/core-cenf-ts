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
import type { HealthStatus } from '@cenf/core';
import {
  CacheOperationError,
  CacheConnectionError,
} from '@cenf/core';

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

  /** Single-flight pending getOrSet operations to prevent thundering herd. */
  private pendingGets = new Map<string, Promise<unknown>>();

  /** Stored error handler reference for cleanup in stop(). */
  private errorHandler: ((...args: unknown[]) => void) | null = null;

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
    } catch (error) {
      throw new CacheOperationError(
        `Redis GET failed for key '${key}'`,
        error instanceof Error ? error : undefined,
      );
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
    } catch (error) {
      throw new CacheOperationError(
        `Redis SET failed for key '${key}'`,
        error instanceof Error ? error : undefined,
      );
    }
  }

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

    const promise = this._getOrSetImpl(key, factory, ttlMs);
    this.pendingGets.set(key, promise);
    try {
      return await promise;
    } finally {
      this.pendingGets.delete(key);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.pk(key));
    } catch (error) {
      throw new CacheOperationError(
        `Redis DEL failed for key '${key}'`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const result = await this.redis.exists(this.pk(key));
      return result === 1;
    } catch (error) {
      throw new CacheOperationError(
        `Redis EXISTS failed for key '${key}'`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async clear(): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(this.pk('*'));
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      throw new CacheOperationError(
        'Redis CLEAR failed',
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      this.redis = new Redis(this.url);
      this.errorHandler = () => {
        this.connected = false;
      };
      this.redis.on('error', this.errorHandler);
      this.redis.on('ready', () => {
        this.connected = true;
      });
      await this.redis.ping();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new CacheConnectionError(
        `Failed to connect to Redis at '${this.url}'`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async stop(): Promise<void> {
    if (this.redis) {
      if (this.errorHandler) {
        this.redis.off('error', this.errorHandler);
        this.errorHandler = null;
      }
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

  /**
   * Core getOrSet implementation — check cache first,
   * invoke factory on miss, store result.
   */
  private async _getOrSetImpl<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss — compute and store
    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }
}
