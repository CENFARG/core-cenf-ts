import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisCacheAdapter } from '../redis.adapter.js';
import type { CacheManager } from '../../ports.js';

// ---------------------------------------------------------------------------
// Mock ioredis — using vi.hoisted for hoisted mock factory
// ---------------------------------------------------------------------------

const {
  mockPing,
  mockQuit,
  mockDisconnect,
  mockOn,
  mockRedisInstance,
  MockRedis,
} = vi.hoisted(() => {
  const ping = vi.fn().mockResolvedValue('PONG');
  const quit = vi.fn().mockResolvedValue('OK');
  const disconnect = vi.fn();
  const on = vi.fn();
  const instance = {
    ping,
    quit,
    disconnect,
    on,
    status: 'ready' as string,
  };
  const Redis = vi.fn().mockImplementation(() => instance);
  return { mockPing: ping, mockQuit: quit, mockDisconnect: disconnect, mockOn: on, mockRedisInstance: instance, MockRedis: Redis };
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

  it('stop() disconnects from Redis', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();
    await adapter.stop();

    expect(mockQuit).toHaveBeenCalled();
  });

  it('connection failure sets up memory fallback', async () => {
    mockPing.mockRejectedValue(new Error('Connection refused'));

    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });

    // start() should NOT throw — it falls back gracefully
    await expect(adapter.start()).resolves.toBeUndefined();

    const healthResult = (await adapter.health()) as {
      status: string;
      details: Record<string, unknown>;
    };

    expect(healthResult.details.connected).toBe(false);
  });

  it('start() registers error listener on Redis connection', async () => {
    adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
    await adapter.start();

    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
