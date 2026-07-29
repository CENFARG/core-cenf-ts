/**
 * @cenf/licence — licence validation and feature gating.
 *
 * @module @cenf/licence
 */

// Port
export { type LicenceManager, LICENCE_PORT_VERSION } from './ports.js';

// Types
export type { Licence, LicenceFeature, LicenceStatus } from './types.js';
export { LICENCE_TYPES_VERSION } from './types.js';

// Adapters
export { InMemoryLicenceAdapter } from './adapters/memory.adapter.js';
