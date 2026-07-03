/**
 * HealthManager-specific types.
 *
 * Types for health reports, component health, and check results.
 *
 * @module managers/health/types
 */

// ---------------------------------------------------------------------------
// ComponentHealth — per-manager health status
// ---------------------------------------------------------------------------

/**
 * Health status for a single registered manager component.
 */
export interface ComponentHealth {
  /** Component health status: healthy, degraded, or unhealthy. */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Arbitrary details about the component's health. */
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// HealthReport — aggregated health check result
// ---------------------------------------------------------------------------

/**
 * Aggregated health report from `HealthManager.check()`.
 *
 * Includes per-component health status and an overall
 * status derived from the worst component status.
 */
export interface HealthReport {
  /**
   * Overall health status:
   * - `healthy`: all components are healthy
   * - `degraded`: at least one component is degraded (and none unhealthy)
   * - `unhealthy`: at least one component is unhealthy
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Per-component health statuses, keyed by name. */
  components: Record<string, ComponentHealth>;

  /** Unix timestamp (ms) when the check was performed. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const HEALTH_TYPES_VERSION = '0.1.0';
