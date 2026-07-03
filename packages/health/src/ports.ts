/**
 * HealthManager port interface — aggregated health checks.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/health/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { HealthReport } from './types.js';

/**
 * Health manager port for aggregated component health monitoring.
 *
 * Registers infrastructure managers and aggregates their individual
 * health checks into a single `HealthReport`. Supports readiness
 * and liveness probes for Kubernetes-style health endpoints.
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface HealthManager extends AsyncLifecycle {
  /**
   * Run health checks on all registered managers.
   *
   * Aggregates results: if any manager is unhealthy, the overall
   * status is unhealthy. If any is degraded (and none are unhealthy),
   * the overall status is degraded. Otherwise, healthy.
   *
   * If a manager's health check throws, the manager is marked
   * as unhealthy with the error details.
   *
   * @returns Aggregated health report for all registered managers.
   */
  check(): Promise<HealthReport>;

  /**
   * Register a manager for health monitoring.
   *
   * The manager must implement `AsyncLifecycle` so its `health()`
   * method can be called during `check()`.
   *
   * @param manager - The manager to register for health checks.
   * @param name - A human-readable name for the manager.
   */
  register(manager: AsyncLifecycle, name: string): void;

  /**
   * Check if all registered managers are ready (all healthy).
   *
   * Convenience wrapper around `check()` that returns `true`
   * only when all managers report `healthy`.
   *
   * @returns `true` if all managers are healthy.
   */
  isReady(): Promise<boolean>;

  /**
   * Check if the system is live (health check itself does not throw).
   *
   * Unlike `isReady()`, this only checks that the health check
   * mechanism itself is functional — it does not require all
   * managers to be healthy.
   *
   * @returns `true` if the health check completes without throwing.
   */
  isLive(): Promise<boolean>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const HEALTH_PORT_VERSION = '0.1.0';
