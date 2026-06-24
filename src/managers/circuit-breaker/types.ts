/**
 * CircuitBreakerManager-specific types.
 *
 * Types for circuit state, configuration, and options.
 *
 * @module managers/circuit-breaker/types
 */

// ---------------------------------------------------------------------------
// CircuitState — the three states of the circuit breaker pattern
// ---------------------------------------------------------------------------

/**
 * The current state of the circuit breaker.
 *
 * - `CLOSED`: Normal operation — calls pass through.
 * - `OPEN`: Failure threshold exceeded — calls fail fast.
 * - `HALF_OPEN`: Trial period — limited calls allowed to test recovery.
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// ---------------------------------------------------------------------------
// CircuitOptions — per-call or per-breaker configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for the circuit breaker.
 *
 * Controls failure thresholds, timeout durations,
 * and half-open trial behavior.
 */
export interface CircuitOptions {
  /**
   * Number of consecutive failures before opening the circuit.
   *
   * Default: 5.
   */
  failureThreshold?: number;

  /**
   * Time in milliseconds the circuit stays OPEN before transitioning
   * to HALF_OPEN.
   *
   * Default: 30000 (30 seconds).
   */
  timeoutMs?: number;

  /**
   * Maximum number of calls allowed in HALF_OPEN state before
   * deciding whether to close or re-open the circuit.
   *
   * Default: 1.
   */
  halfOpenMaxCalls?: number;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const CIRCUIT_BREAKER_TYPES_VERSION = '0.1.0';
