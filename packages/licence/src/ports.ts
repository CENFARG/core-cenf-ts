/**
 * LicenceManager port interface — licence validation and feature gating.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/licence/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { Licence, LicenceFeature } from './types.js';

/**
 * Licence manager port for software licence validation and feature gating.
 *
 * Provides licence loading, validation, feature enumeration, and
 * expiry checking. Supports multiple licence statuses including
 * valid, expired, invalid, and trial.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface LicenceManager extends AsyncLifecycle {
  /**
   * Load a licence by its key.
   *
   * Retrieves the full licence document including its status,
   * validity period, features, and holder information.
   *
   * @param key - The unique licence key to load.
   * @returns The full licence document.
   */
  loadLicence(key: string): Promise<Licence>;

  /**
   * Validate the currently loaded licence.
   *
   * Returns `true` if the licence is currently valid
   * (not expired, not invalid). The loaded licence must
   * be valid both in status and temporally.
   *
   * @returns `true` if the licence is valid.
   */
  validateLicence(): Promise<boolean>;

  /**
   * Retrieve all features granted by the currently loaded licence.
   *
   * Returns an empty array if no licence has been loaded.
   *
   * @returns An array of licensed features.
   */
  getFeatures(): Promise<LicenceFeature[]>;

  /**
   * Check if the currently loaded licence has expired.
   *
   * Compares the current date against the licence's expiry date.
   * Returns `true` if no licence is loaded.
   *
   * @returns `true` if the licence has expired.
   */
  isExpired(): Promise<boolean>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const LICENCE_PORT_VERSION = '0.1.0';
