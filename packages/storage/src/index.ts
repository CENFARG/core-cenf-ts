/**
 * @cenf/storage — object storage abstraction.
 *
 * @module @cenf/storage
 */

// Port
export { type StorageManager, STORAGE_PORT_VERSION } from './ports.js';

// Types
export type { StorageObject, StorageMetadata, S3StorageOptions } from './types.js';
export { STORAGE_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryStorageAdapter } from './adapters/memory.adapter.js';
export { S3StorageAdapter } from './adapters/s3.adapter.js';
