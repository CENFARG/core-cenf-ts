import { describe, it, expect } from 'vitest';
import {
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
} from '../errors.js';

const ALL_ERROR_CLASSES = [
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
] as const;

describe('CenfError hierarchy', () => {
  it('CenfError is abstract and cannot be instantiated directly', () => {
    // @ts-expect-error CenfError is abstract
    expect(() => new CenfError('test')).toThrow();
  });

  it('all subclasses are instantiable with a message', () => {
    for (const ErrClass of ALL_ERROR_CLASSES) {
      const instance = new ErrClass('test message');
      expect(instance).toBeInstanceOf(ErrClass);
      expect(instance.message).toBe('test message');
    }
  });

  it('every subclass has a unique, non-empty code', () => {
    const codes = new Set<string>();
    for (const ErrClass of ALL_ERROR_CLASSES) {
      const instance = new ErrClass('test');
      expect(instance.code).toBeTruthy();
      expect(typeof instance.code).toBe('string');
      expect(codes.has(instance.code)).toBe(false);
      codes.add(instance.code);
    }
    expect(codes.size).toBe(ALL_ERROR_CLASSES.length);
  });

  it('all subclasses are instanceof CenfError', () => {
    for (const ErrClass of ALL_ERROR_CLASSES) {
      const instance = new ErrClass('test');
      expect(instance).toBeInstanceOf(CenfError);
    }
  });

  it('all subclasses are instanceof Error', () => {
    for (const ErrClass of ALL_ERROR_CLASSES) {
      const instance = new ErrClass('test');
      expect(instance).toBeInstanceOf(Error);
    }
  });

  it('stack trace is preserved on subclasses', () => {
    for (const ErrClass of ALL_ERROR_CLASSES) {
      const instance = new ErrClass('trace test');
      expect(instance.stack).toBeDefined();
      expect(typeof instance.stack).toBe('string');
      expect(instance.stack).toContain(ErrClass.name);
    }
  });

  it('cause is accessible when provided', () => {
    const cause = new Error('original cause');
    const configErr = new ConfigError('wrapped error', cause);
    expect(configErr.cause).toBe(cause);
  });

  it('name property matches class name for all subclasses', () => {
    for (const ErrClass of ALL_ERROR_CLASSES) {
      const instance = new ErrClass('name test');
      expect(instance.name).toBe(ErrClass.name);
    }
  });
});
