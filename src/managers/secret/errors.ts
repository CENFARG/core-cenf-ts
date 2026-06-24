/**
 * SecretManager-specific error types.
 *
 * Extends the CenfError hierarchy with secret-related errors.
 *
 * @module managers/secret/errors
 */

import { SecretError } from '../../shared/errors.js';

/**
 * Requested secret name does not exist in the configured source.
 *
 * Thrown when `get()` or `has()` is called with a name
 * that is not present in the secret store.
 */
export class SecretNotFoundError extends SecretError {
  override readonly code = 'ERR_SECRET_NOT_FOUND';

  constructor(
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}
