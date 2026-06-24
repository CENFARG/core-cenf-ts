/**
 * Environment-based secret adapter.
 *
 * Reads secrets from `process.env` with an in-memory override layer.
 * Runtime `set()` calls do NOT mutate `process.env` — overrides are
 * stored in-memory and take precedence over env values.
 *
 * @module managers/secret/adapters/env.adapter
 */

import type { HealthStatus } from '../../../shared/types.js';
import type { ISecretManager } from '../ports.js';
import { SecretNotFoundError } from '../errors.js';

/**
 * Secret adapter that reads from environment variables.
 *
 * On `get()`, checks the in-memory override layer first,
 * then falls back to `process.env`. This allows runtime
 * overrides without polluting the global environment.
 */
export class EnvSecretAdapter implements ISecretManager {
  private readonly overrides = new Map<string, string>();

  // -------------------------------------------------------------------
  // ISecretManager
  // -------------------------------------------------------------------

  async get(name: string): Promise<string> {
    // Check in-memory overrides first
    if (this.overrides.has(name)) {
      return this.overrides.get(name)!;
    }

    // Fall back to process.env
    const value = process.env[name];
    if (value === undefined) {
      throw new SecretNotFoundError(
        `Secret "${name}" not found in environment`,
      );
    }
    return value;
  }

  async set(name: string, value: string): Promise<void> {
    // Store in-memory only — never mutate process.env
    this.overrides.set(name, value);
  }

  async has(name: string): Promise<boolean> {
    return (
      this.overrides.has(name) || process.env[name] !== undefined
    );
  }

  async list(): Promise<string[]> {
    const names = new Set<string>();

    // Add env var names
    for (const key of Object.keys(process.env)) {
      names.add(key);
    }

    // Add override names
    for (const key of this.overrides.keys()) {
      names.add(key);
    }

    return Array.from(names);
  }

  // -------------------------------------------------------------------
  // AsyncLifecycle
  // -------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: env adapter is always ready.
  }

  async stop(): Promise<void> {
    // Clear in-memory overrides on shutdown.
    this.overrides.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        source: 'env',
        available: true,
      },
    };
  }
}
