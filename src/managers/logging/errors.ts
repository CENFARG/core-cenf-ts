/**
 * LogManager-specific error types.
 *
 * Extends the CenfError hierarchy with logging-related errors.
 *
 * @module managers/logging/errors
 */

import { CenfError } from '../../shared/errors.js';

/**
 * Logging configuration failure.
 *
 * Thrown when log level, format, or transport configuration
 * is invalid or incompatible.
 */
export class LogConfigurationError extends CenfError {
  readonly code = 'ERR_LOG_CONFIGURATION';

  constructor(
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}
