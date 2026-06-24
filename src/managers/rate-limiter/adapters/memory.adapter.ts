/**
 * In-memory rate limiter adapter — token bucket algorithm.
 *
 * Implements the RateLimiterManager port with zero external dependencies.
 * Uses a per-key token bucket with configurable capacity and refill rate.
 *
 * @module managers/rate-limiter/adapters/memory.adapter
 */

import type { RateLimiterManager } from '../ports.js';
import type {
  TokenBucket,
  RateLimitConfig,
  RateLimitResult,
} from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// MemoryRateLimiterAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory rate limiter using the token bucket algorithm.
 *
 * Each key gets an independent bucket. Tokens are refilled
 * based on elapsed time and the configured refill rate.
 * Consumption is atomic per key.
 *
 * Use this adapter:
 * - In unit tests where a real rate limiter backend is not available
 * - For single-process rate limiting with no need for shared state
 * - As a fallback when the distributed rate limiter is unavailable
 */
export class MemoryRateLimiterAdapter implements RateLimiterManager {
  private buckets = new Map<string, TokenBucket>();
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillIntervalMs: number;
  private readonly tokensPerMs: number;

  constructor(config: RateLimitConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.refillIntervalMs = config.refillInterval ?? 1000;
    // Tokens added per millisecond of elapsed time.
    // Uses refillInterval so that fractional-interval configs
    // (e.g., refillRate=1, refillInterval=500) produce correct
    // token accumulation over elapsed time.
    this.tokensPerMs = config.refillRate / this.refillIntervalMs;
  }

  // -----------------------------------------------------------------------
  // RateLimiterManager — consume
  // -----------------------------------------------------------------------

  async consume(key: string, tokens: number = 1): Promise<RateLimitResult> {
    const bucket = this.getOrCreateBucket(key);
    this.refill(bucket);

    // Defensive: treat negative/zero tokens as no-op.
    const requested = Math.max(0, tokens);

    if (requested <= 0) {
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
      };
    }

    if (bucket.tokens >= requested) {
      bucket.tokens -= requested;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
      };
    }

    // Not enough tokens — deny without consuming.
    const needed = requested - bucket.tokens;
    const retryAfterMs = this.estimateRetryMs(needed);

    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs,
    };
  }

  // -----------------------------------------------------------------------
  // RateLimiterManager — getRemaining / reset
  // -----------------------------------------------------------------------

  async getRemaining(key: string): Promise<number> {
    const bucket = this.getOrCreateBucket(key);
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // Initialize the bucket store to a clean state.
    this.buckets = new Map<string, TokenBucket>();
  }

  async stop(): Promise<void> {
    // Release all bucket state.
    this.buckets.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        capacity: this.capacity,
        refillRate: this.refillRate,
        refillIntervalMs: this.refillIntervalMs,
        activeBuckets: this.buckets.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Retrieve or lazily create a token bucket for the given key.
   */
  private getOrCreateBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        tokens: this.capacity,
        lastRefill: Date.now(),
        capacity: this.capacity,
        refillRate: this.refillRate,
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Refill the bucket based on elapsed time since the last refill.
   *
   * Tokens are added at `refillRate` per second, capped at `capacity`.
   */
  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;

    if (elapsedMs <= 0) return;

    const tokensToAdd = elapsedMs * this.tokensPerMs;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Estimate how many milliseconds before the requested tokens
   * will be available at the configured refill rate.
   */
  private estimateRetryMs(needed: number): number {
    // Tokens needed per tokens-per-second → seconds → milliseconds.
    const seconds = Math.ceil(needed / this.refillRate);
    return Math.max(1, seconds * 1000);
  }
}
