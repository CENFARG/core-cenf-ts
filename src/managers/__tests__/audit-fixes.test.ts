/**
 * Audit remediation tests — F1 through F7.
 *
 * Each test proves a specific bug from the Gemini audit reports exists,
 * then validates the fix. Tests are organized by fix ID.
 *
 * @module managers/__tests__/audit-fixes
 */

import { describe, it, expect, vi } from 'vitest';
import { isCenfError } from '../../shared/utils.js';
import {
  DatabaseQueryError,
  HttpClientError,
  CacheOperationError,
  BootstrapError,
  RateLimitExceededError,
  FeatureFlagError,
  FeatureFlagNotFoundError,
  StoragePresignError,
  CenfError,
} from '../../shared/errors.js';
import { StandardErrorHandlingAdapter } from '../error-handling/adapters/standard.adapter.js';
import { FetchHttpClientAdapter } from '../http-client/adapters/fetch.adapter.js';
import { MemoryDatabaseAdapter } from '../database/adapters/memory.adapter.js';
import { StandardBootstrapAdapter } from '../bootstrap/adapters/standard.adapter.js';
import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { HealthStatus } from '../../shared/types.js';

// ---------------------------------------------------------------------------
// F1: Replace raw new Error() with CenfError subtypes
// ---------------------------------------------------------------------------

describe('F1: raw Error → CenfError subtypes', () => {
  it('MemoryDatabaseAdapter.update() throws DatabaseQueryError for missing entity', async () => {
    const adapter = new MemoryDatabaseAdapter();
    await adapter.start();
    await adapter.execute(
      'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)',
    );

    const repo = adapter.getRepository<{ id?: number; name: string }>('items');

    await expect(
      repo.update(999, { name: 'ghost' }),
    ).rejects.toThrow(DatabaseQueryError);
  });

  it('MemoryDatabaseAdapter.update() error is a CenfError', async () => {
    const adapter = new MemoryDatabaseAdapter();
    await adapter.start();
    await adapter.execute(
      'CREATE TABLE IF NOT EXISTS items2 (id INTEGER PRIMARY KEY, name TEXT)',
    );

    const repo = adapter.getRepository<{ id?: number; name: string }>('items2');

    try {
      await repo.update(999, { name: 'ghost' });
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(isCenfError(error)).toBe(true);
      expect((error as CenfError).code).toBe('ERR_DATABASE_QUERY');
    }
  });
});

// ---------------------------------------------------------------------------
// F2: Fix duplicate HttpClientError class
// ---------------------------------------------------------------------------

describe('F2: duplicate HttpClientError → shared CenfError', () => {
  it('FetchHttpClientAdapter throws shared HttpClientError (isCenfError = true)', async () => {
    const client = new FetchHttpClientAdapter();
    await client.start();

    try {
      await client.get('/api/unregistered');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(isCenfError(error)).toBe(true);
      expect(error).toBeInstanceOf(HttpClientError);
      expect((error as CenfError).code).toBe('ERR_HTTP_CLIENT');
    }

    await client.stop();
  });

  it('FetchHttpClientAdapter error is classifiable by StandardErrorHandlingAdapter', async () => {
    const client = new FetchHttpClientAdapter();
    await client.start();
    const errorHandler = new StandardErrorHandlingAdapter();

    try {
      await client.get('/api/unregistered');
      expect.unreachable('Should have thrown');
    } catch (error) {
      const classification = errorHandler.classify(error);
      expect(classification.category).toBe('network');
      expect(classification.retryable).toBe(true);
    }

    await client.stop();
  });
});

// ---------------------------------------------------------------------------
// F3: Redis silent data loss → throw CenfError
// ---------------------------------------------------------------------------

describe('F3: Redis silent data loss → throw CacheOperationError', () => {
  // These tests use mocked ioredis via the existing redis.adapter.test.ts pattern
  // We test the contract: operations MUST throw on Redis failure, not return null

  it('RedisCacheAdapter.get() throws CacheOperationError when Redis fails', async () => {
    const { RedisCacheAdapter } = await import(
      '../cache/adapters/redis.adapter.js'
    );

    // Create adapter and manually set up a broken state
    const adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });

    // Mock the internal redis instance to simulate a connected but failing Redis
    const mockRedis = {
      get: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
      on: vi.fn(),
      off: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    // Access private field for testing
    (adapter as unknown as Record<string, unknown>)['redis'] = mockRedis;
    (adapter as unknown as Record<string, unknown>)['connected'] = true;

    await expect(adapter.get('test-key')).rejects.toThrow(CacheOperationError);
  });

  it('RedisCacheAdapter.set() throws CacheOperationError when Redis fails', async () => {
    const { RedisCacheAdapter } = await import(
      '../cache/adapters/redis.adapter.js'
    );

    const adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      setex: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
      on: vi.fn(),
      off: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    (adapter as unknown as Record<string, unknown>)['redis'] = mockRedis;
    (adapter as unknown as Record<string, unknown>)['connected'] = true;

    await expect(adapter.set('key', 'value')).rejects.toThrow(
      CacheOperationError,
    );
  });

  it('RedisCacheAdapter.del() throws CacheOperationError when Redis fails', async () => {
    const { RedisCacheAdapter } = await import(
      '../cache/adapters/redis.adapter.js'
    );

    const adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      exists: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
      on: vi.fn(),
      off: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    (adapter as unknown as Record<string, unknown>)['redis'] = mockRedis;
    (adapter as unknown as Record<string, unknown>)['connected'] = true;

    await expect(adapter.del('key')).rejects.toThrow(CacheOperationError);
  });

  it('RedisCacheAdapter.has() throws CacheOperationError when Redis fails', async () => {
    const { RedisCacheAdapter } = await import(
      '../cache/adapters/redis.adapter.js'
    );

    const adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      keys: vi.fn().mockResolvedValue([]),
      on: vi.fn(),
      off: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    (adapter as unknown as Record<string, unknown>)['redis'] = mockRedis;
    (adapter as unknown as Record<string, unknown>)['connected'] = true;

    await expect(adapter.has('key')).rejects.toThrow(CacheOperationError);
  });

  it('RedisCacheAdapter.clear() throws CacheOperationError when Redis fails', async () => {
    const { RedisCacheAdapter } = await import(
      '../cache/adapters/redis.adapter.js'
    );

    const adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockRejectedValue(new Error('ECONNRESET')),
      on: vi.fn(),
      off: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    (adapter as unknown as Record<string, unknown>)['redis'] = mockRedis;
    (adapter as unknown as Record<string, unknown>)['connected'] = true;

    await expect(adapter.clear()).rejects.toThrow(CacheOperationError);
  });
});

// ---------------------------------------------------------------------------
// F4: Add missing error codes to CLASSIFICATION_MAP
// ---------------------------------------------------------------------------

describe('F4: missing CLASSIFICATION_MAP entries', () => {
  const adapter = new StandardErrorHandlingAdapter();

  it('classifies RateLimitExceededError as client, non-retryable', () => {
    const err = new RateLimitExceededError('Too many requests');
    const result = adapter.classify(err);
    expect(result.category).toBe('client');
    expect(result.retryable).toBe(false);
  });

  it('classifies FeatureFlagError as client, non-retryable', () => {
    const err = new FeatureFlagError('Flag disabled');
    const result = adapter.classify(err);
    expect(result.category).toBe('client');
    expect(result.retryable).toBe(false);
  });

  it('classifies FeatureFlagNotFoundError as client, non-retryable', () => {
    const err = new FeatureFlagNotFoundError('Flag not found');
    const result = adapter.classify(err);
    expect(result.category).toBe('client');
    expect(result.retryable).toBe(false);
  });

  it('classifies StoragePresignError as server, non-retryable', () => {
    const err = new StoragePresignError('Presign failed');
    const result = adapter.classify(err);
    expect(result.category).toBe('server');
    expect(result.retryable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F5: S3 getPresignedUrl() error unwrapped — tested in s3.adapter.test.ts
// ---------------------------------------------------------------------------

// S3 tests require module-level vi.mock() for @aws-sdk/client-s3 and
// @aws-sdk/s3-request-presigner. Those tests live in:
// src/managers/storage/adapters/__tests__/s3.adapter.test.ts

// ---------------------------------------------------------------------------
// F5b: S3 list() error wrapping — tested in s3.adapter.test.ts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// F6: BootstrapError loses cause chain
// ---------------------------------------------------------------------------

describe('F6: BootstrapError preserves cause chain', () => {
  it('BootstrapError includes original error as .cause', async () => {
    const bootstrap = new StandardBootstrapAdapter();
    const originalError = new Error('Database connection refused');

    const failingManager: AsyncLifecycle = {
      async start() {
        throw originalError;
      },
      async stop() {},
      async health(): Promise<HealthStatus> {
        return { status: 'healthy', details: {} };
      },
    };

    bootstrap.register(failingManager, { name: 'failing-db', priority: 1 });

    try {
      await bootstrap.start();
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BootstrapError);
      expect((error as BootstrapError).cause).toBe(originalError);
    }
  });
});

// ---------------------------------------------------------------------------
// F7: Bootstrap self-registration guard
// ---------------------------------------------------------------------------

describe('F7: Bootstrap self-registration guard', () => {
  it('register() throws BootstrapError when registering self', () => {
    const bootstrap = new StandardBootstrapAdapter();

    expect(() =>
      bootstrap.register(bootstrap, { name: 'bootstrap', priority: 100 }),
    ).toThrow(BootstrapError);
  });

  it('start() is idempotent — second call does not re-start managers', async () => {
    const bootstrap = new StandardBootstrapAdapter();
    let startCount = 0;

    const manager: AsyncLifecycle = {
      async start() {
        startCount++;
      },
      async stop() {},
      async health(): Promise<HealthStatus> {
        return { status: 'healthy', details: {} };
      },
    };

    bootstrap.register(manager, { name: 'test-mgr', priority: 1 });

    await bootstrap.start();
    expect(startCount).toBe(1);

    // Second start should be idempotent (no-op or throw)
    await bootstrap.start();
    expect(startCount).toBe(1); // Manager NOT started again
  });
});
