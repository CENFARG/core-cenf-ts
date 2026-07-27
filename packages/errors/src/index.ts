/**
 * @cenf/errors — unified error processing and classification.
 *
 * @module @cenf/errors
 */

// Port
export { type IErrorHandlingManager, ERROR_HANDLING_PORT_VERSION } from './ports.js';

// Types
export type { ErrorCategory, ErrorClassification, ErrorContext, ErrorReport } from './types.js';
export { ERROR_HANDLING_TYPES_VERSION } from './types.js';

// Adapters
export { StandardErrorHandlingAdapter } from './adapters/standard.adapter.js';
