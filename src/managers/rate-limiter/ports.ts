/**
 * RateLimiterManager port interface — token bucket rate limiting.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/rate-limiter/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { RateLimitResult } from './types.js';

/**
 * Rate limiter manager port for token bucket consumption.
 *
 * Protects APIs and resources by controlling request throughput
 * per key. Uses a token bucket algorithm with configurable
 * capacity and refill rate.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface RateLimiterManager extends AsyncLifecycle {
  /**
   * Attempt to consume tokens from a bucket.
   *
   * If enough tokens are available, they are consumed and the
   * result indicates `allowed: true` with the remaining count.
   * If insufficient tokens are available, no tokens are consumed
   * and `retryAfterMs` estimates when tokens will be available.
   *
   * @param key - The bucket key (e.g., "api:user-1").
   * @param tokens - Number of tokens to consume. Defaults to 1.
   * @returns The consumption result.
   */
  consume(key: string, tokens?: number): Promise<RateLimitResult>;

  /**
   * Get the current number of tokens remaining in a bucket.
   *
   * Includes any tokens that have been refilled since the last
   * consumption. Does not consume any tokens.
   *
   * @param key - The bucket key.
   * @returns The current token count.
   */
  getRemaining(key: string): Promise<number>;

  /**
   * Reset a bucket to its full capacity.
   *
   * @param key - The bucket key to reset.
   */
  reset(key: string): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const RATE_LIMITER_PORT_VERSION = '0.1.0';
