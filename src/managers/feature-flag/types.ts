/**
 * FeatureFlagManager-specific types.
 *
 * Types for feature flags, flag configuration, and percentage rollout.
 *
 * @module managers/feature-flag/types
 */

// ---------------------------------------------------------------------------
// FeatureFlag — a single feature toggle
// ---------------------------------------------------------------------------

/**
 * A single feature flag definition.
 *
 * Each flag has a unique name, an enabled state, and optional metadata
 * for rollout strategies (percentage, description).
 */
export interface FeatureFlag {
  /** Unique flag identifier (e.g., "newDashboard", "betaFeature"). */
  name: string;

  /** Whether the flag is enabled. */
  enabled: boolean;

  /** Optional human-readable description of what this flag controls. */
  description?: string;

  /**
   * Percentage rollout (0-100).
   *
   * When set, the flag is only enabled for a deterministic percentage
   * of users based on a hash of the flag name + userId.
   * If omitted, the flag is either fully on or fully off based on `enabled`.
   */
  rolloutPercentage?: number;
}

// ---------------------------------------------------------------------------
// FlagConfig — complete flag configuration
// ---------------------------------------------------------------------------

/**
 * Complete feature flag configuration.
 *
 * Holds all defined flags and an optional default for flags
 * that are queried but not defined.
 */
export interface FlagConfig {
  /** All feature flags in the configuration. */
  flags: FeatureFlag[];

  /**
   * Default value for flags that are queried but not defined.
   *
   * When a flag is requested that does not exist in `flags`,
   * this default is returned. When omitted, defaults to `false`.
   */
  defaultEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const FEATURE_FLAG_TYPES_VERSION = '0.1.0';
