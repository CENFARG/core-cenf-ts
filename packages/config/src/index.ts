/**
 * @cenf/config — typed configuration management with Zod validation.
 *
 * @module @cenf/config
 */

// Port
export { type IConfigManager, CONFIG_PORT_VERSION } from './ports.js';

// Types
export type { ConfigStore, EnvConfigOptions } from './types.js';
export { CONFIG_TYPES_VERSION } from './types.js';

// Errors
export { ConfigValidationError, ConfigNotFoundError } from './errors.js';

// Adapters
export { EnvConfigAdapter } from './adapters/env.adapter.js';
export { MemoryConfigAdapter } from './adapters/memory.adapter.js';
