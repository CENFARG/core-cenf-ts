/**
 * ConfigManager port interface — typed configuration management.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/config/ports
 */

import type { ZodSchema } from 'zod';
import type { AsyncLifecycle } from '../../shared/lifecycle.js';

/**
 * Typed configuration manager port.
 *
 * All config adapters (env, file, memory) implement this interface.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface IConfigManager extends AsyncLifecycle {
  /**
   * Load and validate configuration against a Zod schema.
   *
   * Reads from the configured source (env vars, files, etc.),
   * validates against the provided schema, and populates the
   * internal store. Subsequent `get()` calls return typed values.
   *
   * @param schema - Zod schema to validate against.
   * @returns The parsed and typed configuration object.
   * @throws ConfigError if validation fails.
   */
  load<T>(schema: ZodSchema<T>): Promise<T>;

  /**
   * Get a typed configuration value by key.
   *
   * @param key - The configuration key.
   * @returns The typed value, or `undefined` if not found.
   */
  get<T>(key: string): T | undefined;

  /**
   * Set a configuration value at runtime.
   *
   * Overrides the stored value without modifying the source
   * (e.g., `process.env` is NOT mutated).
   *
   * @param key - The configuration key.
   * @param value - The value to store.
   */
  set<T>(key: string, value: T): void;

  /**
   * Reload configuration from the source.
   *
   * Re-reads the configuration source and updates the
   * internal store. Existing runtime overrides via `set()`
   * are preserved.
   */
  reload(): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const CONFIG_PORT_VERSION = '0.1.0';
