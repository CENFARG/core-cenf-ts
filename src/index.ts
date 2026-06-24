/**
 * CENF Core Infrastructure (TypeScript) — Public API
 *
 * Depend on ports, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module core-cenf-ts
 */

// ---------------------------------------------------------------------------
// Package meta
// ---------------------------------------------------------------------------
export const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Shared: Errors
// ---------------------------------------------------------------------------
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
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTransactionError,
  StorageUploadError,
  StorageDownloadError,
  StorageDeleteError,
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
} from './shared/errors.js';

// ---------------------------------------------------------------------------
// Shared: Types
// ---------------------------------------------------------------------------
export { JsonValue } from './shared/types.js';
export type { JsonValueBrand } from './shared/types.js';
export type {
  JsonObject,
  Result,
  HealthStatus,
  ContextStore,
} from './shared/types.js';

// ---------------------------------------------------------------------------
// Shared: Lifecycle
// ---------------------------------------------------------------------------
export type { AsyncLifecycle } from './shared/lifecycle.js';
export { LIFECYCLE_VERSION } from './shared/lifecycle.js';

// ---------------------------------------------------------------------------
// Shared: Context
// ---------------------------------------------------------------------------
export { runInContext, getContext, setContext } from './shared/context.js';

// ---------------------------------------------------------------------------
// Shared: Utils
// ---------------------------------------------------------------------------
export {
  retry,
  exponentialBackoff,
  sha256Hash,
  isCenfError,
} from './shared/utils.js';
export type { RetryOptions } from './shared/utils.js';

// ---------------------------------------------------------------------------
// ConfigManager
// ---------------------------------------------------------------------------
export type { IConfigManager } from './managers/config/ports.js';
export { CONFIG_PORT_VERSION } from './managers/config/ports.js';
export {
  ConfigValidationError,
  ConfigNotFoundError,
} from './managers/config/errors.js';
export type { ConfigStore, EnvConfigOptions } from './managers/config/types.js';
export { CONFIG_TYPES_VERSION } from './managers/config/types.js';
export { EnvConfigAdapter } from './managers/config/adapters/env.adapter.js';
export {
  MemoryConfigAdapter,
} from './managers/config/adapters/memory.adapter.js';

// ---------------------------------------------------------------------------
// LogManager
// ---------------------------------------------------------------------------
export type { ILogManager } from './managers/logging/ports.js';
export { LOG_PORT_VERSION } from './managers/logging/ports.js';
export {
  LogConfigurationError,
} from './managers/logging/errors.js';
export type { LogLevel, LogFormat, LogEntry } from './managers/logging/types.js';
export { LOG_TYPES_VERSION } from './managers/logging/types.js';
export { PinoLogAdapter } from './managers/logging/adapters/pino.adapter.js';
export {
  MemoryLogAdapter,
} from './managers/logging/adapters/memory.adapter.js';

// ---------------------------------------------------------------------------
// SecretManager
// ---------------------------------------------------------------------------
export type { ISecretManager } from './managers/secret/ports.js';
export { SECRET_PORT_VERSION } from './managers/secret/ports.js';
export { SecretNotFoundError } from './managers/secret/errors.js';
export { EnvSecretAdapter } from './managers/secret/adapters/env.adapter.js';
export {
  MemorySecretAdapter,
} from './managers/secret/adapters/memory.adapter.js';

// ---------------------------------------------------------------------------
// ErrorHandlingManager
// ---------------------------------------------------------------------------
export type { IErrorHandlingManager } from './managers/error-handling/ports.js';
export {
  ERROR_HANDLING_PORT_VERSION,
} from './managers/error-handling/ports.js';
export type {
  ErrorCategory,
  ErrorClassification,
  ErrorContext,
  ErrorReport,
} from './managers/error-handling/types.js';
export { ERROR_HANDLING_TYPES_VERSION } from './managers/error-handling/types.js';
export {
  StandardErrorHandlingAdapter,
} from './managers/error-handling/adapters/standard.adapter.js';

// ---------------------------------------------------------------------------
// ValidationManager
// ---------------------------------------------------------------------------
export type { IValidationManager } from './managers/validation/ports.js';
export type { ValidationError as ValidationFailure } from './managers/validation/ports.js';
export { VALIDATION_PORT_VERSION } from './managers/validation/ports.js';
export {
  ZodValidationAdapter,
} from './managers/validation/adapters/zod.adapter.js';

// ---------------------------------------------------------------------------
// ObservabilityManager
// ---------------------------------------------------------------------------
export type { ObservabilityManager } from './managers/observability/ports.js';
export {
  OBSERVABILITY_PORT_VERSION,
} from './managers/observability/ports.js';
export type {
  Span,
  SpanContext,
  SpanKind,
  SpanStatus,
  SpanAttributeValue,
  SpanOptions,
} from './managers/observability/types.js';
export {
  OBSERVABILITY_TYPES_VERSION,
} from './managers/observability/types.js';
export {
  NoopObservabilityAdapter,
} from './managers/observability/adapters/noop.adapter.js';

// ---------------------------------------------------------------------------
// AuthManager
// ---------------------------------------------------------------------------
export type { AuthManager } from './managers/auth/ports.js';
export { AUTH_PORT_VERSION } from './managers/auth/ports.js';
export type { JwtPayload, TokenConfig } from './managers/auth/types.js';
export { AUTH_TYPES_VERSION } from './managers/auth/types.js';
export {
  MemoryAuthAdapter,
} from './managers/auth/adapters/memory.adapter.js';
export {
  JoseJwtAdapter,
} from './managers/auth/adapters/jose.adapter.js';

// ---------------------------------------------------------------------------
// CacheManager
// ---------------------------------------------------------------------------
export type { CacheManager } from './managers/cache/ports.js';
export { CACHE_PORT_VERSION } from './managers/cache/ports.js';
export type { CacheEntry, CacheOptions } from './managers/cache/types.js';
export { CACHE_TYPES_VERSION } from './managers/cache/types.js';
export {
  MemoryCacheAdapter,
} from './managers/cache/adapters/memory.adapter.js';
export type { MemoryCacheOptions } from './managers/cache/adapters/memory.adapter.js';

// ---------------------------------------------------------------------------
// FeatureFlagManager
// ---------------------------------------------------------------------------
export type { FeatureFlagManager } from './managers/feature-flag/ports.js';
export { FEATURE_FLAG_PORT_VERSION } from './managers/feature-flag/ports.js';
export type { FeatureFlag, FlagConfig } from './managers/feature-flag/types.js';
export { FEATURE_FLAG_TYPES_VERSION } from './managers/feature-flag/types.js';
export {
  MemoryFeatureFlagAdapter,
} from './managers/feature-flag/adapters/memory.adapter.js';

// ---------------------------------------------------------------------------
// RateLimiterManager
// ---------------------------------------------------------------------------
export type { RateLimiterManager } from './managers/rate-limiter/ports.js';
export { RATE_LIMITER_PORT_VERSION } from './managers/rate-limiter/ports.js';
export type {
  TokenBucket,
  RateLimitConfig,
  RateLimitResult,
} from './managers/rate-limiter/types.js';
export { RATE_LIMITER_TYPES_VERSION } from './managers/rate-limiter/types.js';
export {
  MemoryRateLimiterAdapter,
} from './managers/rate-limiter/adapters/memory.adapter.js';

// ---------------------------------------------------------------------------
// New error classes (PR #4)
// ---------------------------------------------------------------------------
export {
  FeatureFlagError,
  FeatureFlagNotFoundError,
  RateLimitExceededError,
} from './shared/errors.js';
