/**
 * ConfigManager-specific error types.
 *
 * @module @cenf/config/errors
 */

import { CenfError } from '@cenf/core';

/** Configuration validation failure. */
export class ConfigValidationError extends CenfError {
  readonly code = 'ERR_CONFIG_VALIDATION';

  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/** Configuration key not found. */
export class ConfigNotFoundError extends CenfError {
  readonly code = 'ERR_CONFIG_NOT_FOUND';

  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}
