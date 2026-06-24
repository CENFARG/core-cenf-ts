/**
 * CircuitBreakerManager port interface — fault-tolerance pattern.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/circuit-breaker/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { CircuitState, CircuitOptions } from './types.js';

/**
 * Circuit breaker manager port for fault-tolerant execution.
 *
 * Wraps async function calls with a circuit breaker pattern:
 * - CLOSED: normal operation, calls pass through
 * - OPEN: after failure threshold exceeded, calls fail fast
 * - HALF_OPEN: after timeout, limited trial calls to test recovery
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface CircuitBreakerManager extends AsyncLifecycle {
  /**
   * Execute an async function through the circuit breaker.
   *
   * If the circuit is CLOSED (or HALF_OPEN with capacity), the function
   * is executed. Failures increment the failure count; success resets it.
   * If the circuit is OPEN, throws `CircuitBreakerOpenError` immediately
   * without executing the function.
   *
   * @param fn - The async function to protect.
   * @param options - Optional per-call circuit configuration.
   * @returns The result of `fn` if the circuit is closed.
   */
  execute<T>(fn: () => Promise<T>, options?: CircuitOptions): Promise<T>;

  /**
   * Get the current state of the circuit breaker.
   *
   * @returns The current `CircuitState`.
   */
  getState(): CircuitState;

  /**
   * Reset the circuit breaker to CLOSED state.
   *
   * Clears the failure count and state; useful for manual recovery
   * or testing.
   */
  reset(): void;
}

/** Runtime version constant — ensures module existence for TDD. */
export const CIRCUIT_BREAKER_PORT_VERSION = '0.1.0';
