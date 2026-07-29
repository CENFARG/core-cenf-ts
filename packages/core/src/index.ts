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
  UpdateCheckError,
  UpdateDownloadError,
  UpdateApplyError,
  UpdateRollbackError,
} from './errors.js';

// Types — JSON types, Result, HealthStatus, ContextStore
export type {
  JsonObject,
  Result,
  HealthStatus,
  ContextStore,
  JsonValueBrand,
} from './types.js';
// JsonValue exported as both type and runtime value (dual-emit pattern)
export { JsonValue } from './types.js';

// Lifecycle — AsyncLifecycle interface
export { type AsyncLifecycle, LIFECYCLE_VERSION } from './lifecycle.js';

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
