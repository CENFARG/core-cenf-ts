/**
 * In-memory dependency adapter.
 *
 * Implements the DependencyManager port with zero external dependencies.
 * Stores overrides in a Map keyed by scope:name.
 *
 * @module managers/dependency/adapters/memory.adapter
 */

import type { DependencyManager } from '../ports.js';
import type { DependencyToken, OverrideEntry } from '../types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the internal lookup key for an override.
 *
 * Uses `<scope>:<name>` when scope is present, `*:<name>` otherwise,
 * so unscoped overrides act as catch-all defaults.
 */
function overrideKey(token: DependencyToken): string {
  return `${token.scope ?? '*'}:${token.name}`;
}

/**
 * Build the lookup key for a resolution request.
 *
 * Matches against scoped overrides first, then falls back to
 * the unscoped (`*:<name>`) catch-all.
 */
function resolveKey(module: string, className: string): string[] {
  return [`${module}:${className}`, `*:${className}`];
}

// ---------------------------------------------------------------------------
// InMemoryDependencyAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory dependency manager that stores overrides in a Map.
 *
 * Supports both scoped and unscoped tokens. When resolving,
 * a scoped override takes priority over the unscoped fallback.
 *
 * Use this adapter:
 * - In unit tests for dependency injection
 * - For lightweight DI without a full container framework
 * - As a configuration-driven service locator
 */
export class InMemoryDependencyAdapter implements DependencyManager {
  private overrides = new Map<string, unknown>();
  private entries = new Map<string, OverrideEntry>();

  // -----------------------------------------------------------------------
  // DependencyManager — registerOverride
  // -----------------------------------------------------------------------

  async registerOverride(
    token: DependencyToken,
    implementation: unknown,
  ): Promise<void> {
    const key = overrideKey(token);
    this.overrides.set(key, implementation);
    this.entries.set(key, {
      token,
      implementation,
      createdAt: new Date(),
    });
  }

  // -----------------------------------------------------------------------
  // DependencyManager — resolveClass
  // -----------------------------------------------------------------------

  async resolveClass(module: string, className: string): Promise<unknown> {
    const keys = resolveKey(module, className);

    // Try scoped match first, then unscoped fallback
    for (const key of keys) {
      const impl = this.overrides.get(key);
      if (impl !== undefined) return impl;
    }

    throw new Error(
      `No override registered for module="${module}", class="${className}"`,
    );
  }
}
