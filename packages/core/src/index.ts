/**
 * @cenf/core — shared foundation for CENF infrastructure.
 *
 * This package provides the core types, errors, lifecycle interface,
 * context propagation, and utility functions used by all CENF managers.
 *
 * @module @cenf/core
 */

// Errors — CenfError hierarchy and all error classes
export {
  CenfError,
  ConfigError,
  ValidationError,
  SecretError,
  AuthError,
  TokenExpiredError,
  TokenInvalidError,
  TokenVerificationError,
  CacheConnectionError,
  CacheOperationError,
  FeatureFlagError,
  FeatureFlagNotFoundError,
  RateLimitExceededError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTransactionError,
  StorageUploadError,
  StorageDownloadError,
  StorageDeleteError,
  StoragePresignError,
  HttpTimeoutError,
  HttpClientError,
  CircuitBreakerOpenError,
  EventBusConnectionError,
  EventBusPublishError,
  EventBusSubscriptionError,
  ObservabilityConfigurationError,
  I18nError,
  BootstrapError,
  ShutdownError,
  JsonSerializationError,
  JsonDeserializationError,
  HealthCheckTimeoutError,
} from './errors.js';

// Types — JSON types, Result, HealthStatus, ContextStore
export type {
  JsonValue,
  JsonObject,
  Result,
  HealthStatus,
  ContextStore,
  JsonValueBrand,
} from './types.js';
export { JsonValue } from './types.js';

// Lifecycle — AsyncLifecycle interface
export { AsyncLifecycle, LIFECYCLE_VERSION } from './lifecycle.js';

// Context — AsyncLocalStorage wrapper
export { runInContext, getContext, setContext } from './context.js';

// Utils — retry, backoff, hashing, error classification
export {
  retry,
  exponentialBackoff,
  sha256Hash,
  isCenfError,
} from './utils.js';
export type { RetryOptions } from './utils.js';
