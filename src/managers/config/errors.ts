/**
 * ConfigManager-specific error types.
 *
 * Extends the CenfError hierarchy with configuration-related errors.
 *
 * @module managers/config/errors
 */

import { CenfError } from '../../shared/errors.js';

/**
 * Configuration validation failure.
 *
 * Thrown when a Zod schema validation fails during `load()`
 * or when a required configuration key is missing.
 */
export class ConfigValidationError extends CenfError {
  readonly code = 'ERR_CONFIG_VALIDATION';

  constructor(
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/**
 * Configuration key not found.
 *
 * Thrown when a requested configuration key is not present
 * in the loaded configuration store and no default is provided.
 */
export class ConfigNotFoundError extends CenfError {
  readonly code = 'ERR_CONFIG_NOT_FOUND';

  constructor(
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}
