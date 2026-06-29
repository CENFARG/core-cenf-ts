/**
 * Environment-based configuration adapter.
 *
 * Reads configuration from `process.env` with native `process.loadEnvFile`
 * (Node >=21.7.0) for `.env` file loading, and validates against a Zod schema.
 *
 * @module managers/config/adapters/env.adapter
 */

import type { ZodSchema } from 'zod';
import type { IConfigManager } from '../ports.js';
import type { HealthStatus } from '../../../shared/types.js';
import type { EnvConfigOptions } from '../types.js';
import { ConfigValidationError } from '../errors.js';

/**
 * Configuration adapter that reads from environment variables.
 *
 * Uses native `process.loadEnvFile()` for `.env` file loading
 * and Zod for schema validation.
 * Runtime overrides via `set()` do NOT mutate `process.env`.
 */
export class EnvConfigAdapter implements IConfigManager {
  private store: Record<string, unknown> = {};
  private readonly options: EnvConfigOptions;

  constructor(options: EnvConfigOptions = {}) {
    this.options = options;
  }

  // -----------------------------------------------------------------------
  // IConfigManager
  // -----------------------------------------------------------------------

  async load<T>(schema: ZodSchema<T>): Promise<T> {
    try {
      const raw: Record<string, unknown> = { ...process.env };
      const parsed = schema.parse(raw);
      // Only store schema-validated keys — prevents leaking secrets
      // that exist in process.env but are not part of the config schema.
      this.store = { ...(parsed as Record<string, unknown>) };
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
    // Re-read .env using native process.loadEnvFile
    const envPath = this.options.dotenvPath;
    try {
      if (envPath) {
        process.loadEnvFile(envPath);
      } else {
        process.loadEnvFile();
      }
    } catch {
      // File doesn't exist — continue with existing process.env values
    }
    // Reload only updates existing store keys from process.env —
    // does NOT add new keys that weren't in the original schema.
    for (const key of Object.keys(this.store)) {
      if (key in process.env) {
        this.store[key] = process.env[key];
      }
    }
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // Load .env file using native process.loadEnvFile (Node >=21.7.0)
    const envPath = this.options.dotenvPath;
    try {
      if (envPath) {
        process.loadEnvFile(envPath);
      } else {
        process.loadEnvFile();
      }
    } catch {
      // File doesn't exist — continue with existing process.env values
    }
  }

  async stop(): Promise<void> {
    // No-op: config is read-only after load
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        env: process.env['NODE_ENV'] ?? process.env['CENF_ENV'] ?? 'unknown',
        keysLoaded: Object.keys(this.store).length,
      },
    };
  }
}
