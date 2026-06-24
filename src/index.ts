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
export {
  JsonValue,
  JsonValueBrand,
} from './shared/types.js';
export type {
  JsonObject,
  Result,
  HealthStatus,
  ContextStore,
} from './shared/types.js';

// ---------------------------------------------------------------------------
// Shared: Lifecycle
// ---------------------------------------------------------------------------
export { AsyncLifecycle, LIFECYCLE_VERSION } from './shared/lifecycle.js';

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
export { IConfigManager, CONFIG_PORT_VERSION } from './managers/config/ports.js';
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
export { ILogManager, LOG_PORT_VERSION } from './managers/logging/ports.js';
export {
  LogConfigurationError,
} from './managers/logging/errors.js';
export type { LogLevel, LogFormat, LogEntry } from './managers/logging/types.js';
export { LOG_TYPES_VERSION } from './managers/logging/types.js';
export { PinoLogAdapter } from './managers/logging/adapters/pino.adapter.js';
export {
  MemoryLogAdapter,
} from './managers/logging/adapters/memory.adapter.js';
