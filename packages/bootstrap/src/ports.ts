/**
 * BootstrapOrchestrator port interface — startup/shutdown orchestration.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/bootstrap/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { BootstrapOptions } from './types.js';

/**
 * Bootstrap orchestrator port for lifecycle management of all managers.
 *
 * Registers `AsyncLifecycle` managers in priority order, starts them
 * sequentially, and shuts them down in reverse order. If any manager
 * fails to start, already-started managers are rolled back (stopped)
 * in reverse order.
 *
 * Extends `AsyncLifecycle` for uniform orchestration — the bootstrap
 * orchestrator itself is a managed component.
 */
export interface BootstrapOrchestrator extends AsyncLifecycle {
  /**
   * Register a manager for lifecycle orchestration.
   *
   * Managers are started in ascending priority order (lower number = earlier)
   * and stopped in reverse order. Duplicate names are rejected.
   *
   * @param manager - The manager to register (must implement `AsyncLifecycle`).
   * @param options - Optional configuration (priority, name).
   */
  register(manager: AsyncLifecycle, options?: BootstrapOptions): void;
}

/** Runtime version constant — ensures module existence for TDD. */
export const BOOTSTRAP_PORT_VERSION = '0.1.0';
