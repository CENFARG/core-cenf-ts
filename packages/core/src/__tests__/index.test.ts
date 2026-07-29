/**
 * Barrel export verification tests for @cenf/core.
 *
 * Ensures all public exports are accessible and properly typed.
 */

import { describe, it, expect } from 'vitest';
import {
  // Errors
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
  // Types (runtime)
  JsonValue,
  // Lifecycle
  LIFECYCLE_VERSION,
  // Context
  runInContext,
  getContext,
  setContext,
  // Utils
  retry,
  exponentialBackoff,
  sha256Hash,
  isCenfError,
} from '../index.js';

describe('@cenf/core barrel exports', () => {
  it('exports all error classes', () => {
    expect(CenfError).toBeDefined();
    expect(ConfigError).toBeDefined();
    expect(ValidationError).toBeDefined();
    expect(SecretError).toBeDefined();
    expect(AuthError).toBeDefined();
    expect(TokenExpiredError).toBeDefined();
    expect(TokenInvalidError).toBeDefined();
    expect(TokenVerificationError).toBeDefined();
    expect(CacheConnectionError).toBeDefined();
    expect(CacheOperationError).toBeDefined();
    expect(FeatureFlagError).toBeDefined();
    expect(FeatureFlagNotFoundError).toBeDefined();
    expect(RateLimitExceededError).toBeDefined();
    expect(DatabaseConnectionError).toBeDefined();
    expect(DatabaseQueryError).toBeDefined();
    expect(DatabaseTransactionError).toBeDefined();
    expect(StorageUploadError).toBeDefined();
    expect(StorageDownloadError).toBeDefined();
    expect(StorageDeleteError).toBeDefined();
    expect(StoragePresignError).toBeDefined();
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
    expect(UpdateCheckError).toBeDefined();
    expect(UpdateDownloadError).toBeDefined();
    expect(UpdateApplyError).toBeDefined();
    expect(UpdateRollbackError).toBeDefined();
  });

  it('exports runtime type brand', () => {
    expect(JsonValue).toBeDefined();
  });

  it('exports lifecycle version', () => {
    expect(LIFECYCLE_VERSION).toBe('0.1.0');
  });

  it('exports context functions', () => {
    expect(runInContext).toBeTypeOf('function');
    expect(getContext).toBeTypeOf('function');
    expect(setContext).toBeTypeOf('function');
  });

  it('exports utility functions', () => {
    expect(retry).toBeTypeOf('function');
    expect(exponentialBackoff).toBeTypeOf('function');
    expect(sha256Hash).toBeTypeOf('function');
    expect(isCenfError).toBeTypeOf('function');
  });

  it('error classes extend CenfError', () => {
    const error = new ConfigError('test');
    expect(error).toBeInstanceOf(CenfError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('ERR_CONFIG');
  });
});
