/**
 * AsyncLifecycle interface — standard lifecycle contract for all managers.
 *
 * Every manager in core-cenf-ts implements this interface,
 * enabling uniform `start()`, `stop()`, and `health()` orchestration
 * via the BootstrapOrchestrator.
 *
 * @module shared/lifecycle
 */

import type { HealthStatus } from './types.js';

/**
 * Standard lifecycle contract for infrastructure managers.
 *
 * Every manager MUST implement `start()`, `stop()`, and `health()`.
 * This enables uniform orchestration, graceful shutdown,
 * and health aggregation across all 19 managers.
 */
export interface AsyncLifecycle {
  /** Initialize the manager. Called once before use. */
  start(): Promise<void>;

  /** Gracefully shut down the manager. Cleanup resources. */
  stop(): Promise<void>;

  /** Return the current health status of the manager. */
  health(): Promise<HealthStatus>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const LIFECYCLE_VERSION = '0.1.0';
