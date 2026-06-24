/**
 * SecretManager port interface — secure credential management.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/secret/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';

/**
 * Secure credential manager port.
 *
 * Manages sensitive values (API keys, passwords, tokens) with
 * adapter-based retrieval from env vars, vault, or in-memory stores.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface ISecretManager extends AsyncLifecycle {
  /**
   * Retrieve a secret by name.
   *
   * @param name - The secret name/key.
   * @returns The secret value.
   * @throws SecretNotFoundError if the name does not exist.
   */
  get(name: string): Promise<string>;

  /**
   * Store or update a secret value.
   *
   * @param name - The secret name/key.
   * @param value - The secret value to store.
   */
  set(name: string, value: string): Promise<void>;

  /**
   * Check if a secret exists in the store.
   *
   * @param name - The secret name/key.
   * @returns `true` if the secret exists, `false` otherwise.
   */
  has(name: string): Promise<boolean>;

  /**
   * List all available secret names.
   *
   * Returns only names, never values — safe for logging and debugging.
   *
   * @returns Array of secret names.
   */
  list(): Promise<string[]>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const SECRET_PORT_VERSION = '0.1.0';
