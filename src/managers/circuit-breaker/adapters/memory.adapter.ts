/**
 * In-memory circuit breaker adapter — state machine for testing.
 *
 * Implements the CircuitBreakerManager port with a CLOSED → OPEN → HALF_OPEN
 * state machine. Tracks consecutive failures and transitions based on
 * configurable thresholds.
 *
 * @module managers/circuit-breaker/adapters/memory.adapter
 */

import type { CircuitBreakerManager } from '../ports.js';
import type { CircuitState, CircuitOptions } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';
import { CircuitBreakerOpenError } from '../../../shared/errors.js';

/** Default circuit breaker configuration. */
const DEFAULTS: Required<CircuitOptions> = {
  failureThreshold: 5,
  timeoutMs: 30000,
  halfOpenMaxCalls: 1,
};

/**
 * In-memory circuit breaker adapter using a state machine.
 *
 * States:
 * - CLOSED: calls pass through. Consecutive failures increment a counter.
 *   When the counter reaches `failureThreshold`, transitions to OPEN.
 * - OPEN: all calls fail fast with `CircuitBreakerOpenError`.
 *   After `timeoutMs`, transitions to HALF_OPEN.
 * - HALF_OPEN: allows up to `halfOpenMaxCalls` trial calls.
 *   Any success → transition to CLOSED (reset failure count).
 *   All fail → transition back to OPEN.
 *
 * Use this adapter:
 * - In unit tests where a real circuit breaker is not available
 * - For prototyping fault-tolerance patterns
 * - As a reference implementation for the CircuitBreakerManager port
 */
export class MemoryCircuitBreakerAdapter implements CircuitBreakerManager {
  /** Current circuit state. */
  private state: CircuitState = 'CLOSED';

  /** Consecutive failure count in CLOSED state. */
  private failureCount = 0;

  /** Timestamp (ms) when the circuit transitioned to OPEN. */
  private openedAt = 0;

  /** Number of trial calls made in HALF_OPEN state. */
  private halfOpenCalls = 0;

  /** Merged configuration with defaults. */
  private readonly config: Required<CircuitOptions>;

  constructor(options?: CircuitOptions) {
    this.config = { ...DEFAULTS, ...options };
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.openedAt = 0;
    this.halfOpenCalls = 0;
  }

  async stop(): Promise<void> {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.openedAt = 0;
    this.halfOpenCalls = 0;
  }

  async health(): Promise<HealthStatus> {
    this.checkStateTransition();
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        state: this.state,
        failureCount: this.failureCount,
        failureThreshold: this.config.failureThreshold,
        timeoutMs: this.config.timeoutMs,
      },
    };
  }

  // -----------------------------------------------------------------------
  // CircuitBreakerManager — execute
  // -----------------------------------------------------------------------

  async execute<T>(
    fn: () => Promise<T>,
    _options?: CircuitOptions,
  ): Promise<T> {
    this.checkStateTransition();

    if (this.state === 'OPEN') {
      throw new CircuitBreakerOpenError(
        `Circuit is OPEN — ${this.failureCount} consecutive failures. ` +
        `Retry after ${this.config.timeoutMs}ms timeout.`,
      );
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new CircuitBreakerOpenError(
          `Circuit is HALF_OPEN — max trial calls (${this.config.halfOpenMaxCalls}) exceeded.`,
        );
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // CircuitBreakerManager — getState / reset
  // -----------------------------------------------------------------------

  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.openedAt = 0;
    this.halfOpenCalls = 0;
  }

  // -----------------------------------------------------------------------
  // Private: state transitions
  // -----------------------------------------------------------------------

  /**
   * Check if the circuit should transition from OPEN to HALF_OPEN
   * based on the timeout.
   */
  private checkStateTransition(): void {
    if (this.state === 'OPEN' && this.openedAt > 0) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.timeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
      }
    }
  }

  /**
   * Handle a successful execution.
   *
   * In CLOSED: reset failure count.
   * In HALF_OPEN: any success immediately transitions to CLOSED.
   */
  private onSuccess(): void {
    if (this.state === 'CLOSED') {
      this.failureCount = 0;
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.halfOpenCalls = 0;
    }
  }

  /**
   * Handle a failed execution.
   *
   * In CLOSED: increment failure count; if threshold reached, open the circuit.
   * In HALF_OPEN: each failed trial call transitions back to OPEN.
   */
  private onFailure(): void {
    if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
      }
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
