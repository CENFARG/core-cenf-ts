/**
 * In-memory configuration adapter for testing.
 *
 * Stores configuration in a plain `Map`-backed object.
 * No external dependencies or file I/O.
 *
 * @module managers/config/adapters/memory.adapter
 */

import type { ZodSchema } from 'zod';
import type { IConfigManager } from '../ports.js';
import type { HealthStatus } from '../../../shared/types.js';
import { ConfigValidationError } from '../errors.js';

/**
 * In-memory configuration adapter.
 *
 * Useful for unit tests where environment isolation is required.
 * Accepts optional initial data via constructor.
 */
export class MemoryConfigAdapter implements IConfigManager {
  private store: Record<string, unknown>;

  constructor(initial?: Record<string, unknown>) {
    this.store = { ...initial };
  }

  // -----------------------------------------------------------------------
  // IConfigManager
  // -----------------------------------------------------------------------

  async load<T>(schema: ZodSchema<T>): Promise<T> {
    try {
      const parsed = schema.parse(this.store);
      // Update store with parsed (coerced) values
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        this.store[key] = value;
      }
      return parsed;
    } catch (error) {
      throw new ConfigValidationError(
        `Config validation failed: ${(error as Error).message}`,
        error,
      );
    }
  }

  get<T>(key: string): T | undefined {
    return this.store[key] as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.store[key] = value;
  }

  async reload(): Promise<void> {
    // Memory adapter — no external source to reload from.
    // This is a no-op that preserves current state.
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: memory adapter is always ready.
  }

  async stop(): Promise<void> {
    // No-op: no connections to close.
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        keysLoaded: Object.keys(this.store).length,
      },
    };
  }
}
