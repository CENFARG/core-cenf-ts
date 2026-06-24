/**
 * CenfError hierarchy — abstract base class for all CENF infrastructure errors.
 *
 * Every error in the core-cenf-ts ecosystem extends CenfError,
 * providing a stable `code` identifier for error classification,
 * handling, and cross-system serialization.
 *
 * @module shared/errors
 */

/**
 * Abstract base class for all CENF errors.
 *
 * Extends the native `Error` to preserve stack traces and
 * adds a stable `code` string for programmatic classification.
 */
export abstract class CenfError extends Error {
  /** Stable error code for classification and handling. */
  abstract readonly code: string;

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Runtime guard: prevent direct instantiation of the abstract base class.
    if (this.constructor === CenfError) {
      throw new TypeError(
        'CenfError is abstract and cannot be instantiated directly.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Foundation errors (PR #1)
// ---------------------------------------------------------------------------

/** Configuration validation or loading failure. */
export class ConfigError extends CenfError {
  readonly code = 'ERR_CONFIG';
}

/** Validation failure at input boundaries. */
export class ValidationError extends CenfError {
  readonly code = 'ERR_VALIDATION';
}

// ---------------------------------------------------------------------------
// Security errors (PR #2)
// ---------------------------------------------------------------------------

/** Secret retrieval, storage, or rotation failure. */
export class SecretError extends CenfError {
  readonly code = 'ERR_SECRET';
}

/** Authentication failure (general). */
export class AuthError extends CenfError {
  readonly code = 'ERR_AUTH';
}

/** JWT / token has expired. */
export class TokenExpiredError extends CenfError {
  readonly code = 'ERR_TOKEN_EXPIRED';
}

/** JWT / token is structurally invalid. */
export class TokenInvalidError extends CenfError {
  readonly code = 'ERR_TOKEN_INVALID';
}

/** JWT / token signature or audience verification failed. */
export class TokenVerificationError extends CenfError {
  readonly code = 'ERR_TOKEN_VERIFICATION';
}

// ---------------------------------------------------------------------------
// Cache errors (PR #3 / #4)
// ---------------------------------------------------------------------------

/** Cache connection failure (e.g., Redis unreachable). */
export class CacheConnectionError extends CenfError {
  readonly code = 'ERR_CACHE_CONNECTION';
}

/** Cache operation failure (get/set/del). */
export class CacheOperationError extends CenfError {
  readonly code = 'ERR_CACHE_OPERATION';
}

// ---------------------------------------------------------------------------
// Database errors (PR #4 / #5)
// ---------------------------------------------------------------------------

/** Database connection failure. */
export class DatabaseConnectionError extends CenfError {
  readonly code = 'ERR_DATABASE_CONNECTION';
}

/** Database query execution failure. */
export class DatabaseQueryError extends CenfError {
  readonly code = 'ERR_DATABASE_QUERY';
}

/** Database transaction failure. */
export class DatabaseTransactionError extends CenfError {
  readonly code = 'ERR_DATABASE_TRANSACTION';
}

// ---------------------------------------------------------------------------
// Storage errors (PR #5)
// ---------------------------------------------------------------------------

/** File / object upload failure. */
export class StorageUploadError extends CenfError {
  readonly code = 'ERR_STORAGE_UPLOAD';
}

/** File / object download failure. */
export class StorageDownloadError extends CenfError {
  readonly code = 'ERR_STORAGE_DOWNLOAD';
}

/** File / object deletion failure. */
export class StorageDeleteError extends CenfError {
  readonly code = 'ERR_STORAGE_DELETE';
}

// ---------------------------------------------------------------------------
// HTTP / network errors (PR #5)
// ---------------------------------------------------------------------------

/** HTTP request timed out. */
export class HttpTimeoutError extends CenfError {
  readonly code = 'ERR_HTTP_TIMEOUT';
}

/** HTTP client error (4xx/5xx, connection, etc.). */
export class HttpClientError extends CenfError {
  readonly code = 'ERR_HTTP_CLIENT';
}

/** Circuit breaker is open — request blocked. */
export class CircuitBreakerOpenError extends CenfError {
  readonly code = 'ERR_CIRCUIT_BREAKER_OPEN';
}

// ---------------------------------------------------------------------------
// Event bus errors (PR #6)
// ---------------------------------------------------------------------------

/** Event bus connection failure. */
export class EventBusConnectionError extends CenfError {
  readonly code = 'ERR_EVENT_BUS_CONNECTION';
}

/** Event publishing failure. */
export class EventBusPublishError extends CenfError {
  readonly code = 'ERR_EVENT_BUS_PUBLISH';
}

/** Event subscription failure. */
export class EventBusSubscriptionError extends CenfError {
  readonly code = 'ERR_EVENT_BUS_SUBSCRIPTION';
}

// ---------------------------------------------------------------------------
// Observability errors (PR #3)
// ---------------------------------------------------------------------------

/** Observability / OpenTelemetry configuration failure. */
export class ObservabilityConfigurationError extends CenfError {
  readonly code = 'ERR_OBSERVABILITY_CONFIG';
}

// ---------------------------------------------------------------------------
// i18n errors (PR #6)
// ---------------------------------------------------------------------------

/** Internationalization failure (missing key, load error). */
export class I18nError extends CenfError {
  readonly code = 'ERR_I18N';
}

// ---------------------------------------------------------------------------
// Bootstrap / lifecycle errors (PR #6)
// ---------------------------------------------------------------------------

/** Bootstrap orchestration failure. */
export class BootstrapError extends CenfError {
  readonly code = 'ERR_BOOTSTRAP';
}

/** Graceful shutdown failure. */
export class ShutdownError extends CenfError {
  readonly code = 'ERR_SHUTDOWN';
}

// ---------------------------------------------------------------------------
// Serialization errors (PR #6)
// ---------------------------------------------------------------------------

/** JSON serialization failure. */
export class JsonSerializationError extends CenfError {
  readonly code = 'ERR_JSON_SERIALIZATION';
}

/** JSON deserialization failure. */
export class JsonDeserializationError extends CenfError {
  readonly code = 'ERR_JSON_DESERIALIZATION';
}

// ---------------------------------------------------------------------------
// Health check errors (PR #6)
// ---------------------------------------------------------------------------

/** Health check timed out. */
export class HealthCheckTimeoutError extends CenfError {
  readonly code = 'ERR_HEALTH_CHECK_TIMEOUT';
}
