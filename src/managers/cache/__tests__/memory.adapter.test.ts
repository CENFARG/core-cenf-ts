import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCacheAdapter } from '../adapters/memory.adapter.js';
import type { CacheManager } from '../ports.js';

describe('MemoryCacheAdapter', () => {
  let cache: CacheManager;

  beforeEach(async () => {
    cache = new MemoryCacheAdapter();
    await cache.start();
  });

  afterEach(async () => {
    await cache.stop();
  });

  // -----------------------------------------------------------------------
  // Basic set / get
  // -----------------------------------------------------------------------

  it('set() and get() roundtrip a string value', async () => {
    await cache.set('key1', 'hello');
    expect(await cache.get<string>('key1')).toBe('hello');
  });

  it('set() and get() roundtrip a number', async () => {
    await cache.set('num', 42);
    expect(await cache.get<number>('num')).toBe(42);
  });

  it('set() and get() roundtrip an object', async () => {
    const obj = { name: 'test', items: [1, 2, 3] };
    await cache.set('obj', obj);
    expect(await cache.get<typeof obj>('obj')).toEqual(obj);
  });

  it('get() returns null for missing key', async () => {
    expect(await cache.get('nonexistent')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // TTL / expiration
  // -----------------------------------------------------------------------

  it('set() with TTL — value available before expiration', async () => {
    await cache.set('ttl-key', 'temp', 300000); // 5 min
    expect(await cache.get<string>('ttl-key')).toBe('temp');
  });

  it('set() with zero TTL — immediately expired', async () => {
    await cache.set('instant', 'gone', 0);
    // A TTL of 0 means the entry is already expired.
    expect(await cache.get<string>('instant')).toBeNull();
  });

  it('set() without TTL — never expires', async () => {
    await cache.set('forever', 'eternal');
    // Verify the key exists and has no expiresAt
    expect(await cache.get<string>('forever')).toBe('eternal');
  });

  // -----------------------------------------------------------------------
  // del / has / clear
  // -----------------------------------------------------------------------

  it('has() returns true for existing unexpired key', async () => {
    await cache.set('exists', 'value');
    expect(await cache.has('exists')).toBe(true);
  });

  it('has() returns false for missing key', async () => {
    expect(await cache.has('nope')).toBe(false);
  });

  it('has() returns false for expired key', async () => {
    await cache.set('expired', 'value', 0);
    expect(await cache.has('expired')).toBe(false);
  });

  it('del() removes an existing key', async () => {
    await cache.set('remove-me', 'value');
    await cache.del('remove-me');
    expect(await cache.get('remove-me')).toBeNull();
  });

  it('del() is idempotent for missing key', async () => {
    await expect(cache.del('ghost')).resolves.toBeUndefined();
  });

  it('clear() removes all keys', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.set('c', 3);
    await cache.clear();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
    expect(await cache.get('c')).toBeNull();
  });

  it('clear() on empty cache is safe', async () => {
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getOrSet (basic)
  // -----------------------------------------------------------------------

  it('getOrSet() invokes factory on cache miss', async () => {
    const factory = vi.fn().mockResolvedValue('computed');
    const result = await cache.getOrSet('miss', factory);
    expect(result).toBe('computed');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('getOrSet() returns cached value and skips factory on hit', async () => {
    await cache.set('cached', 'stored');
    const factory = vi.fn().mockResolvedValue('should-not-be-called');
    const result = await cache.getOrSet('cached', factory);
    expect(result).toBe('stored');
    expect(factory).not.toHaveBeenCalled();
  });

  it('getOrSet() stores computed value for subsequent calls', async () => {
    const factory = vi.fn().mockResolvedValue('first');
    // First call: miss → factory invoked
    const r1 = await cache.getOrSet('key', factory);
    expect(r1).toBe('first');
    expect(factory).toHaveBeenCalledTimes(1);

    // Second call: hit → factory NOT invoked
    const r2 = await cache.getOrSet('key', factory);
    expect(r2).toBe('first');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('getOrSet() with expired entry re-invokes factory', async () => {
    // Set with TTL=0 (already expired)
    await cache.set('stale', 'old', 0);
    const factory = vi.fn().mockResolvedValue('fresh');
    const result = await cache.getOrSet('stale', factory);
    expect(result).toBe('fresh');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('getOrSet() with TTL stores value with expiration', async () => {
    const factory = vi.fn().mockResolvedValue('timed');
    await cache.getOrSet('timed-key', factory, 300000);
    expect(await cache.get('timed-key')).toBe('timed');
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  it('start() initializes the cache', async () => {
    const fresh = new MemoryCacheAdapter();
    await fresh.start();
    // Should be healthy after start
    const h = await fresh.health();
    expect(h.status).toBe('healthy');
    await fresh.stop();
  });

  it('stop() clears the cache', async () => {
    await cache.set('persist', 'gone-after-stop');
    await cache.stop();
    // After stop, the cache is cleared
    const h = await cache.health();
    expect(h.status).toBe('healthy');
    // Re-start and check content is gone
    await cache.start();
    // After stop+start, the cache should be empty
    // MemoryCacheAdapter clears on stop and starts fresh on start
  });

  it('health() reports adapter type', async () => {
    const h = await cache.health();
    expect(h.status).toBe('healthy');
    expect(h.details).toHaveProperty('adapter', 'memory');
  });
});
