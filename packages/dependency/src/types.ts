/**
 * DependencyManager-specific types.
 *
 * Defines the DependencyToken and OverrideEntry types for
 * dynamic dependency resolution and override registration.
 *
 * @module managers/dependency/types
 */

// ---------------------------------------------------------------------------
// DependencyToken — unique key for a dependency
// ---------------------------------------------------------------------------

/**
 * A token that uniquely identifies a dependency.
 *
 * The `name` identifies the dependency (e.g., "Database", "Logger").
 * The optional `scope` groups dependencies by context
 * (e.g., "app", "infra", "workers").
 */
export interface DependencyToken {
  /** The dependency name (e.g., "Database", "Logger"). */
  readonly name: string;

  /**
   * Optional scope qualifier.
   *
   * When provided, the override only applies to resolutions
   * with a matching module name.
   */
  readonly scope?: string;
}

// ---------------------------------------------------------------------------
// OverrideEntry — recorded override with metadata
// ---------------------------------------------------------------------------

/**
 * A recorded override entry with creation timestamp.
 *
 * Used internally by adapters to track when overrides were
 * registered and the associated token information.
 */
export interface OverrideEntry {
  /** The token this override applies to. */
  readonly token: DependencyToken;

  /** The implementation provided as the override. */
  readonly implementation: unknown;

  /** Timestamp when the override was registered. */
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const DEPENDENCY_TYPES_VERSION = '0.1.0';
