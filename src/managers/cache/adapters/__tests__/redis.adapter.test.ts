import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisCacheAdapter } from '../redis.adapter.js';
import { CacheConnectionError } from '../../../../shared/errors.js';
import type { CacheManager } from '../../ports.js';

// ---------------------------------------------------------------------------
// Mock ioredis — using vi.hoisted for hoisted mock factory
// ---------------------------------------------------------------------------

const {
  mockPing,
  mockQuit,
  mockOn,
  mockOff,
  mockGet,
  mockSet,
  mockDel,
  mockExists,
  mockKeys,
  mockSetex,
  mockRedisInstance,
  MockRedis,
} = vi.hoisted(() => {
  const ping = vi.fn().mockResolvedValue('PONG');
  const quitFn = vi.fn().mockResolvedValue('OK');
  const disconnect = vi.fn();
  const on = vi.fn();
  const off = vi.fn();
  const get = vi.fn().mockResolvedValue(null);
  const set = vi.fn().mockResolvedValue('OK');
  const del = vi.fn().mockResolvedValue(1);
  const exists = vi.fn().mockResolvedValue(0);
  const keys = vi.fn().mockResolvedValue([]);
  const setex = vi.fn().mockResolvedValue('OK');
  const instance = {
    ping,
    quit: quitFn,
    disconnect,
    on,
    off,
    get,
    set,
    del,
    exists,
    keys,
    setex,
    status: 'ready' as string,
  };
  const Redis = vi.fn().mockImplementation(() => instance);
  return {
    mockPing: ping,
    mockQuit: quitFn,
    mockDisconnect: disconnect,
    mockOn: on,
    mockOff: off,
    mockGet: get,
    mockSet: set,
    mockDel: del,
    mockExists: exists,
    mockKeys: keys,
    mockSetex: setex,
    mockRedisInstance: instance,
    MockRedis: Redis,
  };
});

vi.mock('ioredis', () => ({
  default: MockRedis,
  Redis: MockRedis,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedisCacheAdapter', () => {
  let adapter: CacheManager & { health(): Promise<unknown> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisInstance.status = 'ready';
    mockPing.mockResolvedValue('PONG');
    mockQuit.mockResolvedValue('OK');
  });

  afterEach(async () => {
    try {
      await adapter?.stop();
    } catch {
      // Ignore stop failures during cleanup
    }
  });

  // -----------------------------------------------------------------------
  // Connection management
  // -----------------------------------------------------------------------

  it('start() connects to Redis successfully', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379');
    expect(mockPing).toHaveBeenCalled();
  });

  it('start() uses default redis://localhost:6379 when no URL provided', async () => {
    adapter = new RedisCacheAdapter();
    await adapter.start();

    expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379');
  });

  it('health() reports connected status when Redis is ready', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const healthResult = (await adapter.health()) as {
      status: string;
      details: Record<string, unknown>;
    };

    expect(healthResult.status).toBe('healthy');
    expect(healthResult.details.connected).toBe(true);
    expect(healthResult.details.adapter).toBe('redis');
  });

  it('health() reports disconnected before start() is called', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    // Do NOT call start() — adapter should report not connected

    const healthResult = (await adapter.health()) as {
      status: string;
      details: Record<string, unknown>;
    };

    expect(healthResult.details.connected).toBe(false);
  });

  it('health() reports disconnected after stop()', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();
    await adapter.stop();

    const healthResult = (await adapter.health()) as {
      status: string;
      details: Record<string, unknown>;
    };

    expect(healthResult.details.connected).toBe(false);
  });

  it('stop() removes error listener via off() (F2 audit fix)', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();
    await adapter.stop();

    expect(mockOff).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('stop() disconnects from Redis', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();
    await adapter.stop();

    expect(mockQuit).toHaveBeenCalled();
  });

  it('connection failure throws CacheConnectionError (F3 audit fix)', async () => {
    mockPing.mockRejectedValue(new Error('Connection refused'));

    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });

    // start() now throws CacheConnectionError — no silent degradation
    await expect(adapter.start()).rejects.toThrow(CacheConnectionError);
  });

  it('start() registers error listener on Redis connection', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  // -----------------------------------------------------------------------
  // CRUD operations — set / get
  // -----------------------------------------------------------------------

  it('set() and get() roundtrip a string value', async () => {
    mockGet.mockResolvedValue('"hello"');
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.set('key1', 'hello');
    const result = await adapter.get<string>('key1');

    expect(mockSet).toHaveBeenCalledWith(
      'core-cenf:cache:key1',
      '"hello"',
    );
    expect(result).toBe('hello');
  });

  it('set() and get() roundtrip a number', async () => {
    mockGet.mockResolvedValue('42');
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.set('num', 42);
    const result = await adapter.get<number>('num');

    expect(result).toBe(42);
  });

  it('set() and get() roundtrip an object', async () => {
    const obj = { name: 'test', items: [1, 2, 3] };
    mockGet.mockResolvedValue(JSON.stringify(obj));
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.set('obj', obj);
    const result = await adapter.get<typeof obj>('obj');

    expect(result).toEqual(obj);
  });

  it('get() returns null for missing key', async () => {
    mockGet.mockResolvedValue(null);
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const result = await adapter.get('nonexistent');

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // TTL / expiration
  // -----------------------------------------------------------------------

  it('set() with TTL uses setex for expiration', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.set('ttl-key', 'temp', 300_000);

    expect(mockSetex).toHaveBeenCalledWith(
      'core-cenf:cache:ttl-key',
      300,
      '"temp"',
    );
  });

  it('set() without TTL uses set (no expiry)', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.set('forever', 'eternal');

    expect(mockSet).toHaveBeenCalledWith(
      'core-cenf:cache:forever',
      '"eternal"',
    );
    expect(mockSetex).not.toHaveBeenCalled();
  });

  it('set() with default TTL uses setex', async () => {
    adapter = new RedisCacheAdapter({
      url: 'redis://localhost:6379',
      defaultTtlMs: 60_000,
    });
    await adapter.start();

    await adapter.set('default-ttl', 'value');

    expect(mockSetex).toHaveBeenCalledWith(
      'core-cenf:cache:default-ttl',
      60,
      '"value"',
    );
  });

  // -----------------------------------------------------------------------
  // del / has / clear
  // -----------------------------------------------------------------------

  it('has() returns true for existing key', async () => {
    mockExists.mockResolvedValue(1);
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const result = await adapter.has('exists');

    expect(result).toBe(true);
    expect(mockExists).toHaveBeenCalledWith('core-cenf:cache:exists');
  });

  it('has() returns false for missing key', async () => {
    mockExists.mockResolvedValue(0);
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const result = await adapter.has('nope');

    expect(result).toBe(false);
  });

  it('del() removes a key', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.del('remove-me');

    expect(mockDel).toHaveBeenCalledWith('core-cenf:cache:remove-me');
  });

  it('clear() deletes all prefixed keys', async () => {
    mockKeys.mockResolvedValue(['core-cenf:cache:a', 'core-cenf:cache:b']);
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.clear();

    expect(mockKeys).toHaveBeenCalledWith('core-cenf:cache:*');
    expect(mockDel).toHaveBeenCalledWith(
      'core-cenf:cache:a',
      'core-cenf:cache:b',
    );
  });

  it('clear() is safe when no keys exist', async () => {
    mockKeys.mockResolvedValue([]);
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await expect(adapter.clear()).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getOrSet — single-flight stampede protection
  // -----------------------------------------------------------------------

  it('getOrSet() invokes factory on cache miss and stores result', async () => {
    mockGet.mockResolvedValue(null); // cache miss
    const factory = vi.fn().mockResolvedValue('computed');
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const result = await adapter.getOrSet('miss', factory);

    expect(result).toBe('computed');
    expect(factory).toHaveBeenCalledTimes(1);
    // Should store the computed value in cache
    expect(mockSet).toHaveBeenCalledWith(
      'core-cenf:cache:miss',
      '"computed"',
    );
  });

  it('getOrSet() returns cached value and skips factory on hit', async () => {
    mockGet.mockResolvedValue('"stored"');
    const factory = vi.fn().mockResolvedValue('should-not-be-called');
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const result = await adapter.getOrSet('cached', factory);

    expect(result).toBe('stored');
    expect(factory).not.toHaveBeenCalled();
  });

  it('getOrSet() single-flight: 10 concurrent callers invoke factory exactly once', async () => {
    let callCount = 0;
    const factory = vi.fn().mockImplementation(async () => {
      callCount++;
      // Small delay to ensure all concurrent callers pile up
      await new Promise((r) => setTimeout(r, 10));
      return 'single-flight-result';
    });
    // First get returns null (cache miss), triggering factory
    mockGet.mockResolvedValue(null);
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    const promises = Array.from({ length: 10 }, () =>
      adapter.getOrSet('concurrent-key', factory),
    );
    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((r) => expect(r).toBe('single-flight-result'));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(1);
  });

  it('getOrSet() with TTL stores value with expiration', async () => {
    mockGet.mockResolvedValue(null);
    const factory = vi.fn().mockResolvedValue('timed');
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await adapter.getOrSet('timed-key', factory, 300_000);

    expect(mockSetex).toHaveBeenCalledWith(
      'core-cenf:cache:timed-key',
      300,
      '"timed"',
    );
  });

  it('getOrSet() grace period: factory failure on miss returns error', async () => {
    mockGet.mockResolvedValue(null);
    const factory = vi.fn().mockRejectedValue(new Error('Factory failed'));
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    await expect(
      adapter.getOrSet('failing-key', factory),
    ).rejects.toThrow('Factory failed');
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
