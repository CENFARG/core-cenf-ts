/**
 * FeatureFlagManager port interface — runtime feature toggles.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/feature-flag/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { FeatureFlag } from './types.js';

/**
 * Feature flag manager port for runtime feature toggling.
 *
 * Provides flag evaluation, user-targeted percentage rollouts,
 * and bulk flag retrieval. Extends `AsyncLifecycle` for uniform
 * orchestration.
 */
export interface FeatureFlagManager extends AsyncLifecycle {
  /**
   * Check whether a feature flag is enabled.
   *
   * For simple boolean flags, returns the flag's `enabled` value.
   * For percentage rollout flags, evaluates without user context
   * (defaults to disabled).
   *
   * @param flag - The flag name to check.
   * @returns `true` if the flag is enabled.
   */
  isEnabled(flag: string): Promise<boolean>;

  /**
   * Check whether a feature flag is enabled for a specific user.
   *
   * For percentage rollout flags, uses a deterministic hash of
   * the flag name + userId to determine if this specific user
   * falls within the rollout percentage.
   *
   * @param flag - The flag name to check.
   * @param userId - The user identifier for percentage rollout evaluation.
   * @returns `true` if the flag is enabled for this user.
   */
  isEnabledForUser(flag: string, userId: string): Promise<boolean>;

  /**
   * Retrieve all defined feature flags.
   *
   * @returns An array of all configured feature flags.
   */
  getAllFlags(): Promise<FeatureFlag[]>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const FEATURE_FLAG_PORT_VERSION = '0.1.0';
