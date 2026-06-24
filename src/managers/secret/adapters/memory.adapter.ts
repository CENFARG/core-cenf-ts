/**
 * In-memory secret adapter for testing.
 *
 * Stores secrets in a private `Map` with full isolation
 * between instances. No external dependencies or I/O.
 *
 * @module managers/secret/adapters/memory.adapter
 */

import type { HealthStatus } from '../../../shared/types.js';
import type { ISecretManager } from '../ports.js';
import { SecretNotFoundError } from '../errors.js';

/**
 * In-memory secret store for isolated unit testing.
 *
 * Secrets are stored in a private `Map<string, string>`.
 * Each instance has its own store — no shared state.
 */
export class MemorySecretAdapter implements ISecretManager {
  private readonly store = new Map<string, string>();

  // -------------------------------------------------------------------
  // ISecretManager
  // -------------------------------------------------------------------

  async get(name: string): Promise<string> {
    const value = this.store.get(name);
    if (value === undefined) {
      throw new SecretNotFoundError(
        `Secret "${name}" not found in memory store`,
      );
    }
    return value;
  }

  async set(name: string, value: string): Promise<void> {
    this.store.set(name, value);
  }

  async has(name: string): Promise<boolean> {
    return this.store.has(name);
  }

  async list(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  // -------------------------------------------------------------------
  // AsyncLifecycle
  // -------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: memory adapter is always ready.
  }

  async stop(): Promise<void> {
    // No-op: no connections to close.
    this.store.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        source: 'memory',
        available: true,
      },
    };
  }
}
