/**
 * @cenf/validation — Zod-based boundary validation.
 *
 * @module @cenf/validation
 */

// Port
export { type IValidationManager, type ValidationError, VALIDATION_PORT_VERSION } from './ports.js';

// Adapters
export { ZodValidationAdapter } from './adapters/zod.adapter.js';
