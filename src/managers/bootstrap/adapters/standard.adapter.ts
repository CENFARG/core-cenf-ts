/**
 * Standard bootstrap orchestrator — priority-ordered lifecycle.
 *
 * Implements the BootstrapOrchestrator port with:
 * - Priority-ordered sequential start
 * - Reverse-order sequential stop
 * - Rollback on start failure
 * - Resilient shutdown (errors collected, all managers attempted)
 *
 * @module managers/bootstrap/adapters/standard.adapter
 */

import type { BootstrapOrchestrator } from '../ports.js';
import type { BootstrapOptions } from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';
import { BootstrapError } from '../../../shared/errors.js';

/** Default priority when none is specified. */
const DEFAULT_PRIORITY = 100;

/**
 * Internal registry entry for a registered manager.
 */
interface RegistryEntry {
  manager: AsyncLifecycle;
  name: string;
  priority: number;
}

/**
 * Standard bootstrap orchestrator with priority-ordered lifecycle.
 *
 * Features:
 * - Register managers with named priorities
 * - Start in ascending priority order
 * - Stop in reverse priority order
 * - Rollback on start failure (stop already-started managers)
 * - Resilient shutdown (errors collected, all managers attempted)
 * - Duplicate name detection
 *
 * Priority order (CENF convention):
 * 1=Config → 2=Logger → 3=Secret → 4=Error → 5=Observability →
 * 6=Validation → 7=Auth → 8=Cache → 9=FeatureFlag → 10=RateLimiter →
 * 11=Database → 12=Storage → 13=HttpClient → 14=CircuitBreaker →
 * 15=EventBus → 16=I18n → 17=JsonSerializer → 18=Health
 */
export class StandardBootstrapAdapter implements BootstrapOrchestrator {
  /** Registered managers sorted by priority (ascending). */
  private readonly registry: RegistryEntry[] = [];

  /** Managers that were successfully started (for rollback). */
  private started: AsyncLifecycle[] = [];

  /** Whether the orchestrator has been started. */
  private isStarted = false;

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.isStarted) return; // Idempotent — already started

    this.started = [];

    // Sort by priority (ascending: lower number = earlier start)
    const sorted = [...this.registry].sort((a, b) => a.priority - b.priority);

    for (const entry of sorted) {
      try {
        await entry.manager.start();
        this.started.push(entry.manager);
      } catch (error) {
        // Rollback: stop already-started managers in reverse order
        const toRollback = [...this.started].reverse();
        for (const mgr of toRollback) {
          try {
            await mgr.stop();
          } catch {
            // Swallow rollback errors — the original failure is more important
          }
        }
        this.started = [];
        throw new BootstrapError(
          `Failed to start manager '${entry.name}': ${error instanceof Error ? error.message : String(error)}`,
          error,
        );
      }
    }

    this.isStarted = true;
  }

  async stop(): Promise<void> {
    // Stop in reverse priority order
    const reversed = [...this.registry].sort(
      (a, b) => b.priority - a.priority,
    );

    for (const entry of reversed) {
      try {
        await entry.manager.stop();
      } catch {
        // Shutdown errors are collected but do not block
        // other managers from being stopped. At shutdown time,
        // there is nothing to do about individual failures.
      }
    }

    this.started = [];
    this.isStarted = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: this.isStarted ? 'healthy' : 'degraded',
      details: {
        started: this.isStarted,
        registeredManagers: this.registry.map((e) => ({
          name: e.name,
          priority: e.priority,
        })),
      },
    };
  }

  // -----------------------------------------------------------------------
  // BootstrapOrchestrator — register
  // -----------------------------------------------------------------------

  register(manager: AsyncLifecycle, options?: BootstrapOptions): void {
    // Guard: prevent self-registration (would cause infinite recursion)
    if (manager === this) {
      throw new BootstrapError(
        'The bootstrap orchestrator cannot register itself.',
      );
    }

    const name = options?.name ?? manager.constructor.name;
    const priority = options?.priority ?? DEFAULT_PRIORITY;

    // Check for duplicate names
    if (this.registry.some((entry) => entry.name === name)) {
      throw new BootstrapError(
        `Manager '${name}' is already registered. Each manager must have a unique name.`,
      );
    }

    this.registry.push({ manager, name, priority });

    // Keep sorted by priority for efficient iteration
    this.registry.sort((a, b) => a.priority - b.priority);
  }
}
