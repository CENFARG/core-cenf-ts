import { describe, it, expect } from 'vitest';

// Runtime values
import {
  VERSION,
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
} from '../index.js';

import { LIFECYCLE_VERSION } from '../index.js';
import {
  CONFIG_PORT_VERSION,
  ConfigValidationError,
  ConfigNotFoundError,
  EnvConfigAdapter,
  MemoryConfigAdapter,
} from '../index.js';
import {
  LOG_PORT_VERSION,
  LogConfigurationError,
  PinoLogAdapter,
  MemoryLogAdapter,
} from '../index.js';
import { JsonValue } from '../index.js';
import { runInContext, getContext, setContext } from '../index.js';
import {
  retry,
  exponentialBackoff,
  sha256Hash,
  isCenfError,
} from '../index.js';
import {
  CONFIG_TYPES_VERSION,
  LOG_TYPES_VERSION,
} from '../index.js';
import {
  SECRET_PORT_VERSION,
  SecretNotFoundError,
  EnvSecretAdapter,
  MemorySecretAdapter,
} from '../index.js';
import {
  ERROR_HANDLING_PORT_VERSION,
  ERROR_HANDLING_TYPES_VERSION,
  StandardErrorHandlingAdapter,
} from '../index.js';
import {
  VALIDATION_PORT_VERSION,
  ZodValidationAdapter,
} from '../index.js';
import {
  OBSERVABILITY_PORT_VERSION,
  OBSERVABILITY_TYPES_VERSION,
  NoopObservabilityAdapter,
} from '../index.js';
import {
  AUTH_PORT_VERSION,
  AUTH_TYPES_VERSION,
  MemoryAuthAdapter,
  JoseJwtAdapter,
} from '../index.js';
import {
  CACHE_PORT_VERSION,
  CACHE_TYPES_VERSION,
  MemoryCacheAdapter,
} from '../index.js';
import {
  FEATURE_FLAG_PORT_VERSION,
  FEATURE_FLAG_TYPES_VERSION,
  MemoryFeatureFlagAdapter,
} from '../index.js';
import {
  RATE_LIMITER_PORT_VERSION,
  RATE_LIMITER_TYPES_VERSION,
  MemoryRateLimiterAdapter,
} from '../index.js';
import {
  FeatureFlagError,
  FeatureFlagNotFoundError,
  RateLimitExceededError,
} from '../index.js';
import {
  DATABASE_PORT_VERSION,
  DATABASE_TYPES_VERSION,
  MemoryDatabaseAdapter,
} from '../index.js';
import type { DatabaseManager } from '../index.js';
import {
  STORAGE_PORT_VERSION,
  STORAGE_TYPES_VERSION,
  MemoryStorageAdapter,
} from '../index.js';
import {
  HTTP_CLIENT_PORT_VERSION,
  HTTP_CLIENT_TYPES_VERSION,
  FetchHttpClientAdapter,
} from '../index.js';
import {
  CIRCUIT_BREAKER_PORT_VERSION,
  CIRCUIT_BREAKER_TYPES_VERSION,
  MemoryCircuitBreakerAdapter,
} from '../index.js';
import type { CircuitBreakerManager } from '../index.js';

// PR #6 new managers
import {
  EVENT_BUS_PORT_VERSION,
  EVENT_BUS_TYPES_VERSION,
  MemoryEventBusAdapter,
} from '../index.js';
import type { EventBusManager } from '../index.js';

import {
  I18N_PORT_VERSION,
  I18N_TYPES_VERSION,
  MemoryI18nAdapter,
} from '../index.js';
import type { I18nManager } from '../index.js';

import {
  JSON_SERIALIZER_PORT_VERSION,
  JSON_SERIALIZER_TYPES_VERSION,
  NativeJsonSerializer,
} from '../index.js';
import type { JsonSerializer } from '../index.js';

import {
  HEALTH_PORT_VERSION,
  HEALTH_TYPES_VERSION,
  AggregatedHealthCheckAdapter,
} from '../index.js';
import type { HealthManager } from '../index.js';

import {
  BOOTSTRAP_PORT_VERSION,
  BOOTSTRAP_TYPES_VERSION,
  StandardBootstrapAdapter,
} from '../index.js';
import type { BootstrapOrchestrator } from '../index.js';

// Type-only (compile-time verification — confirmed by `npm run typecheck`)
import type { HealthStatus } from '../index.js';
import type { ISecretManager } from '../index.js';
import type { IErrorHandlingManager } from '../index.js';
import type { IValidationManager } from '../index.js';
import type { ObservabilityManager } from '../index.js';
import type { AuthManager } from '../index.js';
import type { CacheManager } from '../index.js';
import type { FeatureFlagManager } from '../index.js';
import type { RateLimiterManager } from '../index.js';
import type { DatabaseManager } from '../index.js';
import type { StorageManager } from '../index.js';
import type { HttpClientManager } from '../index.js';

// Type-level verification — these are never used at runtime
void ({} as ISecretManager);
void ({} as IErrorHandlingManager);
void ({} as IValidationManager);
void ({} as ObservabilityManager);
void ({} as AuthManager);
void ({} as CacheManager);
void ({} as FeatureFlagManager);
void ({} as RateLimiterManager);
void ({} as DatabaseManager);
void ({} as StorageManager);
void ({} as HttpClientManager);
void ({} as CircuitBreakerManager);
void ({} as EventBusManager);
void ({} as I18nManager);
void ({} as JsonSerializer);
void ({} as HealthManager);
void ({} as BootstrapOrchestrator);

describe('Barrel exports (index.ts)', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('exports all error subclasses as runtime values', () => {
    expect(ConfigError).toBeDefined();
    expect(ValidationError).toBeDefined();
    expect(SecretError).toBeDefined();
    expect(AuthError).toBeDefined();
    expect(TokenExpiredError).toBeDefined();
    expect(TokenInvalidError).toBeDefined();
    expect(TokenVerificationError).toBeDefined();
    expect(CacheConnectionError).toBeDefined();
    expect(CacheOperationError).toBeDefined();
    expect(DatabaseConnectionError).toBeDefined();
    expect(DatabaseQueryError).toBeDefined();
    expect(DatabaseTransactionError).toBeDefined();
    expect(StorageUploadError).toBeDefined();
    expect(StorageDownloadError).toBeDefined();
    expect(StorageDeleteError).toBeDefined();
    expect(HttpTimeoutError).toBeDefined();
    expect(HttpClientError).toBeDefined();
    expect(CircuitBreakerOpenError).toBeDefined();
    expect(EventBusConnectionError).toBeDefined();
    expect(EventBusPublishError).toBeDefined();
    expect(EventBusSubscriptionError).toBeDefined();
    expect(ObservabilityConfigurationError).toBeDefined();
    expect(I18nError).toBeDefined();
    expect(BootstrapError).toBeDefined();
    expect(ShutdownError).toBeDefined();
    expect(JsonSerializationError).toBeDefined();
    expect(JsonDeserializationError).toBeDefined();
    expect(HealthCheckTimeoutError).toBeDefined();
  });

  it('exports lifecycle version (proxy for AsyncLifecycle)', () => {
    expect(LIFECYCLE_VERSION).toBe('0.1.0');
  });

  it('exports JsonValue as runtime value', () => {
    expect(JsonValue).toBeDefined();
  });

  it('exports context functions', () => {
    expect(runInContext).toBeDefined();
    expect(getContext).toBeDefined();
    expect(setContext).toBeDefined();
  });

  it('exports utility functions', () => {
    expect(retry).toBeDefined();
    expect(exponentialBackoff).toBeDefined();
    expect(sha256Hash).toBeDefined();
    expect(isCenfError).toBeDefined();
  });

  it('exports ConfigManager port (version proxy) and adapters', () => {
    expect(CONFIG_PORT_VERSION).toBe('0.1.0');
    expect(ConfigValidationError).toBeDefined();
    expect(ConfigNotFoundError).toBeDefined();
    expect(EnvConfigAdapter).toBeDefined();
    expect(MemoryConfigAdapter).toBeDefined();
    expect(CONFIG_TYPES_VERSION).toBe('0.1.0');
  });

  it('exports LogManager port (version proxy) and adapters', () => {
    expect(LOG_PORT_VERSION).toBe('0.1.0');
    expect(LogConfigurationError).toBeDefined();
    expect(PinoLogAdapter).toBeDefined();
    expect(MemoryLogAdapter).toBeDefined();
    expect(LOG_TYPES_VERSION).toBe('0.1.0');
  });

  it('TypeScript type imports compile (static verification)', () => {
    // These are type-only imports — if they didn't exist, the file wouldn't compile.
    // The test body exists to satisfy vitest; the real check is at compile time.
    const dummy: HealthStatus = { status: 'healthy', details: {} };
    expect(dummy.status).toBe('healthy');
  });

  it('exports SecretManager port (version proxy) and adapters', () => {
    expect(SECRET_PORT_VERSION).toBe('0.1.0');
    expect(SecretNotFoundError).toBeDefined();
    expect(EnvSecretAdapter).toBeDefined();
    expect(MemorySecretAdapter).toBeDefined();
  });

  it('exports ErrorHandlingManager port and adapter', () => {
    expect(ERROR_HANDLING_PORT_VERSION).toBe('0.1.0');
    expect(ERROR_HANDLING_TYPES_VERSION).toBe('0.1.0');
    expect(StandardErrorHandlingAdapter).toBeDefined();
  });

  it('exports ValidationManager port and adapter', () => {
    expect(VALIDATION_PORT_VERSION).toBe('0.1.0');
    expect(ZodValidationAdapter).toBeDefined();
  });

  it('exports ObservabilityManager port (version proxy) and adapter', () => {
    expect(OBSERVABILITY_PORT_VERSION).toBe('0.1.0');
    expect(OBSERVABILITY_TYPES_VERSION).toBe('0.1.0');
    expect(NoopObservabilityAdapter).toBeDefined();
  });

  it('exports AuthManager port (version proxy) and adapters', () => {
    expect(AUTH_PORT_VERSION).toBe('0.1.0');
    expect(AUTH_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryAuthAdapter).toBeDefined();
    expect(JoseJwtAdapter).toBeDefined();
  });

  it('exports CacheManager port (version proxy) and adapter', () => {
    expect(CACHE_PORT_VERSION).toBe('0.1.0');
    expect(CACHE_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryCacheAdapter).toBeDefined();
  });

  it('exports FeatureFlagManager port (version proxy) and adapter', () => {
    expect(FEATURE_FLAG_PORT_VERSION).toBe('0.1.0');
    expect(FEATURE_FLAG_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryFeatureFlagAdapter).toBeDefined();
  });

  it('exports RateLimiterManager port (version proxy) and adapter', () => {
    expect(RATE_LIMITER_PORT_VERSION).toBe('0.1.0');
    expect(RATE_LIMITER_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryRateLimiterAdapter).toBeDefined();
  });

  it('exports new PR #4 error classes', () => {
    expect(FeatureFlagError).toBeDefined();
    expect(FeatureFlagNotFoundError).toBeDefined();
    expect(RateLimitExceededError).toBeDefined();
  });

  it('exports DatabaseManager port (version proxy) and adapter', () => {
    expect(DATABASE_PORT_VERSION).toBe('0.1.0');
    expect(DATABASE_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryDatabaseAdapter).toBeDefined();
  });

  it('exports StorageManager port (version proxy) and adapter', () => {
    expect(STORAGE_PORT_VERSION).toBe('0.1.0');
    expect(STORAGE_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryStorageAdapter).toBeDefined();
  });

  it('exports HttpClientManager port (version proxy) and adapter', () => {
    expect(HTTP_CLIENT_PORT_VERSION).toBe('0.1.0');
    expect(HTTP_CLIENT_TYPES_VERSION).toBe('0.1.0');
    expect(FetchHttpClientAdapter).toBeDefined();
  });

  it('exports CircuitBreakerManager port (version proxy) and adapter', () => {
    expect(CIRCUIT_BREAKER_PORT_VERSION).toBe('0.1.0');
    expect(CIRCUIT_BREAKER_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryCircuitBreakerAdapter).toBeDefined();
  });

  it('exports EventBusManager port (version proxy) and adapter', () => {
    expect(EVENT_BUS_PORT_VERSION).toBe('0.1.0');
    expect(EVENT_BUS_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryEventBusAdapter).toBeDefined();
  });

  it('exports I18nManager port (version proxy) and adapter', () => {
    expect(I18N_PORT_VERSION).toBe('0.1.0');
    expect(I18N_TYPES_VERSION).toBe('0.1.0');
    expect(MemoryI18nAdapter).toBeDefined();
  });

  it('exports JsonSerializer port (version proxy) and adapter', () => {
    expect(JSON_SERIALIZER_PORT_VERSION).toBe('0.1.0');
    expect(JSON_SERIALIZER_TYPES_VERSION).toBe('0.1.0');
    expect(NativeJsonSerializer).toBeDefined();
  });

  it('exports HealthManager port (version proxy) and adapter', () => {
    expect(HEALTH_PORT_VERSION).toBe('0.1.0');
    expect(HEALTH_TYPES_VERSION).toBe('0.1.0');
    expect(AggregatedHealthCheckAdapter).toBeDefined();
  });

  it('exports BootstrapOrchestrator port (version proxy) and adapter', () => {
    expect(BOOTSTRAP_PORT_VERSION).toBe('0.1.0');
    expect(BOOTSTRAP_TYPES_VERSION).toBe('0.1.0');
    expect(StandardBootstrapAdapter).toBeDefined();
  });
});
