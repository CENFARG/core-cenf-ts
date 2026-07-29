/**
 * @cenf/dependency — dynamic dependency resolution and override registration.
 *
 * @module @cenf/dependency
 */

// Port
export { type DependencyManager, DEPENDENCY_PORT_VERSION } from './ports.js';

// Types
export type { DependencyToken, OverrideEntry } from './types.js';
export { DEPENDENCY_TYPES_VERSION } from './types.js';

// Adapters
export { InMemoryDependencyAdapter } from './adapters/memory.adapter.js';
