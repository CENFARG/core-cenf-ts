/**
 * @cenf/json-serializer — BigInt-safe, Date-aware JSON serialization.
 *
 * @module @cenf/json-serializer
 */

// Port
export { type JsonSerializer, JSON_SERIALIZER_PORT_VERSION } from './ports.js';

// Types
export type { CustomSerializer, SerializerConfig } from './types.js';
export { JSON_SERIALIZER_TYPES_VERSION } from './types.js';

// Adapters
export { NativeJsonSerializer } from './adapters/native.adapter.js';
