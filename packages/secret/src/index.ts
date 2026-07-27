/**
 * @cenf/secret — secure credential management.
 *
 * @module @cenf/secret
 */

// Port
export { type ISecretManager, SECRET_PORT_VERSION } from './ports.js';

// Errors
export { SecretNotFoundError } from './errors.js';

// Adapters
export { EnvSecretAdapter } from './adapters/env.adapter.js';
export { MemorySecretAdapter } from './adapters/memory.adapter.js';
