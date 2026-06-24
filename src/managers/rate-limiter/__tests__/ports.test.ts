import { describe, it, expect } from 'vitest';
import {
  RATE_LIMITER_PORT_VERSION,
  type RateLimiterManager,
} from '../ports.js';
import type {
  TokenBucket,
  RateLimitConfig,
  RateLimitResult,
} from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// Test implementation of RateLimiterManager for contract verification
// ---------------------------------------------------------------------------

class TestRateLimiterManager implements RateLimiterManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async consume(
    _key: string,
    _tokens?: number,
  ): Promise<RateLimitResult> {
    return { allowed: true, remaining: 99 };
  }

  async getRemaining(_key: string): Promise<number> {
    return 100;
  }

  async reset(_key: string): Promise<void> {}
}

// ---------------------------------------------------------------------------
// RateLimiterManager port contract
// ---------------------------------------------------------------------------

describe('RateLimiterManager port', () => {
  it('exports a runtime version constant', () => {
    expect(RATE_LIMITER_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: RateLimiterManager = new TestRateLimiterManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestRateLimiterManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('consume() returns allowed:true and remaining count', async () => {
    const mgr = new TestRateLimiterManager();
    const result = await mgr.consume('key1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('consume() with explicit tokens parameter', async () => {
    const mgr = new TestRateLimiterManager();
    const result = await mgr.consume('key1', 5);
    expect(result.allowed).toBe(true);
  });

  it('getRemaining() returns token count', async () => {
    const mgr = new TestRateLimiterManager();
    const remaining = await mgr.getRemaining('key1');
    expect(remaining).toBe(100);
  });

  it('reset() does not throw', async () => {
    const mgr = new TestRateLimiterManager();
    await expect(mgr.reset('key1')).resolves.toBeUndefined();
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestRateLimiterManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// RateLimiter types
// ---------------------------------------------------------------------------

describe('RateLimiter types', () => {
  it('TokenBucket has required fields', () => {
    const bucket: TokenBucket = {
      key: 'api:user-1',
      tokens: 50,
      lastRefill: Date.now(),
      capacity: 100,
      refillRate: 10,
    };
    expect(bucket.key).toBe('api:user-1');
    expect(bucket.tokens).toBe(50);
    expect(bucket.capacity).toBe(100);
    expect(bucket.refillRate).toBe(10);
  });

  it('RateLimitConfig with required fields', () => {
    const config: RateLimitConfig = {
      capacity: 100,
      refillRate: 10,
    };
    expect(config.capacity).toBe(100);
    expect(config.refillRate).toBe(10);
  });

  it('RateLimitConfig with optional refillInterval', () => {
    const config: RateLimitConfig = {
      capacity: 200,
      refillRate: 5,
      refillInterval: 500,
    };
    expect(config.refillInterval).toBe(500);
  });

  it('RateLimitResult when allowed', () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 45,
    };
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(45);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it('RateLimitResult when denied with retryAfterMs', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      retryAfterMs: 1000,
    };
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBe(1000);
  });
});
