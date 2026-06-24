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

// Type-only (compile-time verification)
import type { CenfError } from '../index.js';
import type { AsyncLifecycle } from '../index.js';
import type { IConfigManager } from '../index.js';
import type { ILogManager } from '../index.js';
import type { HealthStatus, ContextStore, JsonObject, Result } from '../index.js';

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
});
