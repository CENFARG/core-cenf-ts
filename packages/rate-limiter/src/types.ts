/**
 * RateLimiterManager-specific types.
 *
 * Types for token bucket configuration, state, and consumption results.
 *
 * @module managers/rate-limiter/types
 */

// ---------------------------------------------------------------------------
// TokenBucket — per-key bucket state
// ---------------------------------------------------------------------------

/**
 * State of a single token bucket identified by key.
 *
 * Tracks current token count, last refill timestamp,
 * and the configured capacity and refill rate.
 */
export interface TokenBucket {
  /** The bucket key (e.g., "api:user-1"). */
  key: string;

  /** Current token count. */
  tokens: number;

  /** Unix timestamp (ms) of the last refill. */
  lastRefill: number;

  /** Maximum tokens the bucket can hold. */
  capacity: number;

  /** Tokens added per second during refill. */
  refillRate: number;
}

// ---------------------------------------------------------------------------
// RateLimitConfig — configuration for the rate limiter
// ---------------------------------------------------------------------------

/**
 * Configuration for the rate limiter.
 *
 * Controls bucket capacity, refill rate, and the interval
 * at which refills are processed.
 */
export interface RateLimitConfig {
  /** Maximum tokens per bucket. */
  capacity: number;

  /** Number of tokens added per second. */
  refillRate: number;

  /**
   * Refill interval in milliseconds.
   *
   * How often the bucket is refilled. Default: 1000ms (1 second).
   * Shorter intervals produce smoother refills.
   */
  refillInterval?: number;
}

// ---------------------------------------------------------------------------
// RateLimitResult — result of a consume() call
// ---------------------------------------------------------------------------

/**
 * Result of a token consumption attempt.
 *
 * When `allowed` is `true`, the requested tokens were consumed.
 * When `allowed` is `false`, the request was denied and
 * `retryAfterMs` indicates when tokens are expected to be available.
 */
export interface RateLimitResult {
  /** Whether the consumption was allowed. */
  allowed: boolean;

  /** Tokens remaining AFTER consumption (if allowed). */
  remaining: number;

  /**
   * Estimated time in milliseconds before tokens become available.
   *
   * Present only when `allowed` is `false`. This is a best-effort
   * estimate based on the configured refill rate.
   */
  retryAfterMs?: number;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const RATE_LIMITER_TYPES_VERSION = '0.1.0';
