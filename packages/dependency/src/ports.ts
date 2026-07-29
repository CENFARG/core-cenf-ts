/**
 * DependencyManager port interface — dynamic dependency resolution.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/dependency/ports
 */

import type { DependencyToken } from './types.js';

/**
 * Dependency manager port for dynamic class resolution and
 * dependency override registration.
 *
 * Enables runtime dependency injection where implementations
 * can be registered and resolved dynamically. Supports
 * scoped overrides for environment-specific dependency
 * substitution.
 */
export interface DependencyManager {
  /**
   * Resolve a class/function from a module.
   *
   * First checks registered overrides. If a matching override
   * exists (by scope + name), it is returned. Falls back to
   * dynamic resolution when no override is registered.
   *
   * @param module    - The module name or path.
   * @param className - The class or export name to resolve.
   * @returns The resolved class, function, or instance.
   * @throws If the dependency cannot be resolved.
   */
  resolveClass(module: string, className: string): Promise<any>;

  /**
   * Register an override implementation for a dependency token.
   *
   * Subsequent calls to `resolveClass` with a matching module
   * and class name will return this implementation instead of
   * dynamically resolving it. Replaces any existing override
   * for the same token.
   *
   * @param token         - The dependency token to override.
   * @param implementation - The implementation to substitute.
   */
  registerOverride(
    token: DependencyToken,
    implementation: any,
  ): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const DEPENDENCY_PORT_VERSION = '0.1.0';
