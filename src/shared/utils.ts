/**
 * Shared utility functions for core-cenf-ts.
 *
 * Provides retry logic, exponential backoff, hashing, and
 * error classification helpers used across all managers.
 *
 * @module shared/utils
 */

import { createHash } from 'node:crypto';
import { CenfError } from './errors.js';

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/** Options for the `retry()` function. */
export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff. Default: 100. */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds. Default: 30_000 (30s). */
  maxDelayMs?: number;
}

/**
 * Retry an async function with exponential backoff on failure.
 *
 * Attempts the function up to `maxAttempts` times. Between attempts,
 * waits for an exponentially increasing delay. If all attempts fail,
 * throws the last error encountered.
 *
 * @param fn - The async function to retry.
 * @param options - Retry configuration.
 * @returns The resolved value of `fn` on success.
 * @throws The last error if all attempts fail.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delay = exponentialBackoff(attempt, baseDelayMs, maxDelayMs);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Exponential backoff
// ---------------------------------------------------------------------------

/**
 * Calculate delay for exponential backoff.
 *
 * Formula: `baseDelay * 2^attempt`, capped at `maxDelay`.
 *
 * @param attempt - Zero-based attempt number (0 = first retry).
 * @param baseDelayMs - Base delay in milliseconds.
 * @param maxDelayMs - Maximum delay cap in milliseconds. Default: 30_000.
 * @returns Delay in milliseconds.
 */
export function exponentialBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs = 30_000,
): number {
  const safeAttempt = Math.max(0, attempt);
  const raw = baseDelayMs * 2 ** safeAttempt;
  return Math.min(raw, maxDelayMs);
}

// ---------------------------------------------------------------------------
// SHA-256 hashing
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of a string.
 *
 * Uses Node.js built-in `crypto` module — zero dependencies.
 *
 * @param input - The string to hash.
 * @returns 64-character lowercase hex digest.
 */
export function sha256Hash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Check whether an error is a `CenfError` instance.
 *
 * Useful for classification, handling, and cross-boundary error serialization.
 *
 * @param error - The value to check.
 * @returns `true` if `error` is an instance of `CenfError`.
 */
export function isCenfError(error: unknown): error is CenfError {
  return error instanceof CenfError;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Promise-based sleep for use in retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
