/**
 * DynamicPromptingManager-specific types.
 *
 * Types for prompt blocks, context, and conditional assembly.
 *
 * @module managers/dynamic-prompting/types
 */

// ---------------------------------------------------------------------------
// PromptBlock — a named, optionally-conditional template block
// ---------------------------------------------------------------------------

/**
 * A single prompt block with an optional condition guard.
 *
 * Each block has a `name` for registry lookup, a `template` string
 * that supports `{variable}` interpolation, and optional `conditions`
 * that control whether the block is included during assembly.
 *
 * When `conditions` is present, ALL conditions must match the
 * `PromptContext` for the block to be included (AND logic).
 */
export interface PromptBlock {
  /** Unique name for this block (used for registry and overwrite). */
  name: string;

  /** Template string with `{variable}` placeholders for interpolation. */
  template: string;

  /**
   * Optional conditions that control block inclusion.
   *
   * Each key-value pair must match `PromptContext` exactly
   * for the block to be included. Dict equality semantics.
   */
  conditions?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// PromptContext — key-value pairs for interpolation and condition evaluation
// ---------------------------------------------------------------------------

/**
 * Context variables used during prompt assembly.
 *
 * Provides values for `{variable}` interpolation in block templates
 * and serves as the data source for condition evaluation.
 *
 * All values are strings to keep the interface simple and serializable.
 */
export type PromptContext = Record<string, string>;

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const DYNAMIC_PROMPTING_TYPES_VERSION = '0.1.0';
