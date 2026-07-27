/**
 * @cenf/logging — structured logging with pino.
 *
 * @module @cenf/logging
 */

// Port
export { type ILogManager, LOG_PORT_VERSION } from './ports.js';

// Types
export type { LogLevel, LogFormat, LogEntry } from './types.js';
export { LOG_TYPES_VERSION } from './types.js';

// Errors
export { LogConfigurationError } from './errors.js';

// Adapters
export { MemoryLogAdapter } from './adapters/memory.adapter.js';
export { PinoLogAdapter, type PinoOptions } from './adapters/pino.adapter.js';
