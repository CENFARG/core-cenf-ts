import { describe, it, expect } from 'vitest';
import {
  CACHE_PORT_VERSION,
  type CacheManager,
} from '../ports.js';
import type { CacheEntry, CacheOptions } from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of CacheManager for contract verification
// ---------------------------------------------------------------------------

class TestCacheManager implements CacheManager {
  private store = new Map<string, CacheEntry<unknown>>();

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttlMs?: number): Promise<void> {}

  async getOrSet<T>(
    _key: string,
    factory: () => Promise<T>,
    _ttlMs?: number,
  ): Promise<T> {
    return factory();
  }

  async del(_key: string): Promise<void> {}

  async has(_key: string): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// CacheManager port contract
// ---------------------------------------------------------------------------

describe('CacheManager port', () => {
  it('exports a runtime version constant', () => {
    expect(CACHE_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: CacheManager = new TestCacheManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestCacheManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('get() returns null by default', async () => {
    const mgr = new TestCacheManager();
    const result = await mgr.get('nonexistent');
    expect(result).toBeNull();
  });

  it('set() does not throw', async () => {
    const mgr = new TestCacheManager();
    await expect(mgr.set('key', 'value', 60000)).resolves.toBeUndefined();
  });

  it('set() without ttl does not throw', async () => {
    const mgr = new TestCacheManager();
    await expect(mgr.set('key', 'value')).resolves.toBeUndefined();
  });

  it('getOrSet() invokes factory on miss', async () => {
    const mgr = new TestCacheManager();
    const value = await mgr.getOrSet('key', async () => 'computed');
    expect(value).toBe('computed');
  });

  it('del() does not throw', async () => {
    const mgr = new TestCacheManager();
    await expect(mgr.del('key')).resolves.toBeUndefined();
  });

  it('has() returns false by default', async () => {
    const mgr = new TestCacheManager();
    const exists = await mgr.has('key');
    expect(exists).toBe(false);
  });

  it('clear() does not throw', async () => {
    const mgr = new TestCacheManager();
    await expect(mgr.clear()).resolves.toBeUndefined();
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestCacheManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Cache types
// ---------------------------------------------------------------------------

describe('Cache types', () => {
  it('CacheEntry has value and optional expiresAt', () => {
    const entry: CacheEntry<string> = {
      value: 'hello',
      expiresAt: Date.now() + 300000,
    };
    expect(entry.value).toBe('hello');
    expect(entry.expiresAt).toBeGreaterThan(0);
  });

  it('CacheEntry without expiresAt is valid', () => {
    const entry: CacheEntry<number> = { value: 42 };
    expect(entry.value).toBe(42);
    expect(entry.expiresAt).toBeUndefined();
  });

  it('CacheOptions accepts ttlMs and stampedeOpts', () => {
    const opts: CacheOptions = {
      ttlMs: 60000,
      stampedeWindowMs: 10000,
    };
    expect(opts.ttlMs).toBe(60000);
    expect(opts.stampedeWindowMs).toBe(10000);
  });
});
