/**
 * Aggregated health check adapter — collects health from all managers.
 *
 * Implements the HealthManager port by registering `AsyncLifecycle`
 * managers and aggregating their individual health checks into a
 * single `HealthReport`.
 *
 * @module managers/health/adapters/aggregated.adapter
 */

import type { HealthManager } from '../ports.js';
import type { HealthReport, ComponentHealth } from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

/**
 * Aggregated health check adapter for monitoring multiple managers.
 *
 * Features:
 * - Register any `AsyncLifecycle` manager for health monitoring
 * - Aggregate health checks into a single report
 * - Worst-status-wins aggregation (unhealthy > degraded > healthy)
 * - Resilient to individual manager check failures
 * - `isReady()`/`isLive()` convenience methods for K8s probes
 *
 * Use this adapter:
 * - As the system-wide health endpoint
 * - During bootstrap to monitor startup status
 * - For readiness/liveness probes in containerized environments
 */
export class AggregatedHealthCheckAdapter implements HealthManager {
  /** Registered managers (name → manager). */
  private readonly managers = new Map<string, AsyncLifecycle>();

  /** Whether the adapter has been started. */
  private started = false;

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.managers.clear();
    this.started = false;
  }

  async health(): Promise<HealthStatus> {
    const report = await this.check();
    return {
      status: report.status,
      details: {
        adapter: 'aggregated',
        started: this.started,
        managerCount: this.managers.size,
        componentCount: Object.keys(report.components).length,
      },
    };
  }

  // -----------------------------------------------------------------------
  // HealthManager — check
  // -----------------------------------------------------------------------

  async check(): Promise<HealthReport> {
    const components: Record<string, ComponentHealth> = {};
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, manager] of this.managers) {
      let componentHealth: ComponentHealth;

      try {
        const h = await manager.health();
        componentHealth = {
          status: h.status,
          details: h.details,
        };
      } catch (error) {
        componentHealth = {
          status: 'unhealthy',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }

      components[name] = componentHealth;

      // Worst-status-wins aggregation
      if (componentHealth.status === 'unhealthy') {
        overall = 'unhealthy';
      } else if (
        componentHealth.status === 'degraded' &&
        overall !== 'unhealthy'
      ) {
        overall = 'degraded';
      }
    }

    return {
      status: overall,
      components,
      timestamp: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // HealthManager — register
  // -----------------------------------------------------------------------

  register(manager: AsyncLifecycle, name: string): void {
    this.managers.set(name, manager);
  }

  // -----------------------------------------------------------------------
  // HealthManager — isReady / isLive
  // -----------------------------------------------------------------------

  async isReady(): Promise<boolean> {
    const report = await this.check();
    return report.status === 'healthy';
  }

  async isLive(): Promise<boolean> {
    try {
      await this.check();
      return true;
    } catch {
      return false;
    }
  }
}
