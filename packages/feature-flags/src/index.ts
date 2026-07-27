/**
 * @cenf/feature-flags — runtime feature toggles with percentage rollout.
 *
 * @module @cenf/feature-flags
 */

// Port
export { type FeatureFlagManager, FEATURE_FLAG_PORT_VERSION } from './ports.js';

// Types
export type { FeatureFlag, FlagConfig } from './types.js';
export { FEATURE_FLAG_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryFeatureFlagAdapter } from './adapters/memory.adapter.js';
