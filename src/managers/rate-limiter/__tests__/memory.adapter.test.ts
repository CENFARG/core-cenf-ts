import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRateLimiterAdapter } from '../adapters/memory.adapter.js';
import type { RateLimiterManager } from '../ports.js';
import type { RateLimitConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<RateLimitConfig>): RateLimitConfig {
  return {
    capacity: 10,
    refillRate: 2, // 2 tokens per second
    refillInterval: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MemoryRateLimiterAdapter
// ---------------------------------------------------------------------------

describe('MemoryRateLimiterAdapter', () => {
  let limiter: RateLimiterManager;

  describe('basic consumption', () => {
    beforeEach(async () => {
      limiter = new MemoryRateLimiterAdapter(makeConfig());
      await limiter.start();
    });

    afterEach(async () => {
      await limiter.stop();
    });

    it('consume() within capacity returns allowed:true', async () => {
      const result = await limiter.consume('key1', 1);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('consume() default tokens is 1', async () => {
      const result = await limiter.consume('key1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('consume() multiple tokens', async () => {
      const result = await limiter.consume('key1', 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('consume() exhausts the bucket', async () => {
      const r1 = await limiter.consume('key1', 10);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(0);

      const r2 = await limiter.consume('key1', 1);
      expect(r2.allowed).toBe(false);
      expect(r2.remaining).toBe(0);
    });

    it('consume() exceeds available returns allowed:false with retryAfterMs', async () => {
      await limiter.consume('key1', 8); // 2 remaining
      const result = await limiter.consume('key1', 5);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(2); // untouched
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('consume() restricted by current available, not capacity', async () => {
      // Start with 10, consume 8 → 2 remaining
      await limiter.consume('key1', 8);
      // Try to consume 3 with only 2 available
      const result = await limiter.consume('key1', 3);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Key isolation
  // -----------------------------------------------------------------------

  describe('key isolation', () => {
    beforeEach(async () => {
      limiter = new MemoryRateLimiterAdapter(makeConfig());
      await limiter.start();
    });

    afterEach(async () => {
      await limiter.stop();
    });

    it('different keys have independent buckets', async () => {
      await limiter.consume('user-a', 5); // 5 remaining
      await limiter.consume('user-b', 3); // 7 remaining

      expect((await limiter.consume('user-a', 1)).remaining).toBe(4);
      expect((await limiter.consume('user-b', 1)).remaining).toBe(6);
    });

    it('reset() only affects the specified key', async () => {
      await limiter.consume('user-a', 9); // 1 remaining
      await limiter.consume('user-b', 9); // 1 remaining
      await limiter.reset('user-a');

      const a = await limiter.getRemaining('user-a');
      const b = await limiter.getRemaining('user-b');
      expect(a).toBe(10); // reset to capacity
      expect(b).toBe(1);  // unchanged
    });
  });

  // -----------------------------------------------------------------------
  // Refill over time
  // -----------------------------------------------------------------------

  describe('token refill over time', () => {
    it('refill restores tokens after elapsed time', async () => {
      // Use fake timers for deterministic refill testing
      vi.useFakeTimers();
      try {
        limiter = new MemoryRateLimiterAdapter(makeConfig());
        await limiter.start();

        // Consume all tokens
        await limiter.consume('key', 10);
        expect(await limiter.getRemaining('key')).toBe(0);

        // Advance time by 3 seconds (refillRate=2/s → 6 tokens)
        vi.advanceTimersByTime(3000);

        expect(await limiter.getRemaining('key')).toBe(6);
      } finally {
        vi.useRealTimers();
      }
    });

    it('refill caps at capacity', async () => {
      vi.useFakeTimers();
      try {
        limiter = new MemoryRateLimiterAdapter(makeConfig());
        await limiter.start();

        await limiter.consume('key', 2); // 8 remaining
        // Advance 5 seconds → 10 tokens (refillRate=2/s)
        // But capped at capacity=10
        vi.advanceTimersByTime(5000);

        expect(await limiter.getRemaining('key')).toBe(10);
      } finally {
        vi.useRealTimers();
      }
    });

    it('consume() after refill allows more tokens', async () => {
      vi.useFakeTimers();
      try {
        limiter = new MemoryRateLimiterAdapter(makeConfig());
        await limiter.start();

        await limiter.consume('key', 10); // exhausted
        vi.advanceTimersByTime(2000); // 4 tokens refilled

        const result = await limiter.consume('key', 3);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // getRemaining / reset
  // -----------------------------------------------------------------------

  describe('getRemaining and reset', () => {
    beforeEach(async () => {
      limiter = new MemoryRateLimiterAdapter(makeConfig());
      await limiter.start();
    });

    afterEach(async () => {
      await limiter.stop();
    });

    it('getRemaining() returns capacity for new key', async () => {
      expect(await limiter.getRemaining('new-key')).toBe(10);
    });

    it('getRemaining() reflects consumption', async () => {
      await limiter.consume('key', 3);
      expect(await limiter.getRemaining('key')).toBe(7);
    });

    it('getRemaining() does not consume tokens', async () => {
      await limiter.getRemaining('key');
      await limiter.getRemaining('key');
      const result = await limiter.consume('key', 10);
      expect(result.allowed).toBe(true); // still full capacity
    });

    it('reset() refills to capacity', async () => {
      await limiter.consume('key', 9); // 1 remaining
      await limiter.reset('key');
      expect(await limiter.getRemaining('key')).toBe(10);
    });

    it('reset() on nonexistent key creates a full bucket', async () => {
      await limiter.reset('ghost');
      expect(await limiter.getRemaining('ghost')).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // Configurable capacity and refill
  // -----------------------------------------------------------------------

  describe('configurable parameters', () => {
    it('respects custom capacity', async () => {
      const custom = new MemoryRateLimiterAdapter(
        makeConfig({ capacity: 5, refillRate: 1 }),
      );
      await custom.start();
      const result = await custom.consume('key', 5);
      expect(result.allowed).toBe(true);
      expect(await custom.getRemaining('key')).toBe(0);
      await custom.stop();
    });

    it('respects custom refillInterval', async () => {
      vi.useFakeTimers();
      try {
        const custom = new MemoryRateLimiterAdapter(
          makeConfig({ capacity: 10, refillRate: 1, refillInterval: 500 }),
        );
        await custom.start();
        await custom.consume('key', 10);

        // 1s → 2 refill cycles at 500ms interval, 1 token each = 2 tokens
        vi.advanceTimersByTime(1000);
        expect(await custom.getRemaining('key')).toBe(2);
        await custom.stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    beforeEach(async () => {
      limiter = new MemoryRateLimiterAdapter(makeConfig());
      await limiter.start();
    });

    afterEach(async () => {
      await limiter.stop();
    });

    it('consume() with 0 tokens does not reduce count', async () => {
      const result = await limiter.consume('key', 0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('consume() with negative tokens is treated as 0', async () => {
      const result = await limiter.consume('key', -1);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('burst consumption — consume many then check refill', async () => {
      vi.useFakeTimers();
      try {
        await limiter.consume('key1', 3);
        vi.advanceTimersByTime(500);
        await limiter.consume('key1', 2);
        vi.advanceTimersByTime(500);
        await limiter.consume('key1', 1);
        // Total consumed: 6, elapsed: 1s → refilled 2
        // Remaining: 10 - 6 + 2 = 6
        expect(await limiter.getRemaining('key1')).toBe(6);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() prepares empty state', async () => {
      const fresh = new MemoryRateLimiterAdapter(makeConfig());
      await fresh.start();
      const h = await fresh.health();
      expect(h.status).toBe('healthy');
      await fresh.stop();
    });

    it('stop() clears all buckets', async () => {
      const fresh = new MemoryRateLimiterAdapter(makeConfig());
      await fresh.start();
      await fresh.consume('key', 5);
      await fresh.stop();
      // After stop, should be clean
      const h = await fresh.health();
      expect(h.status).toBe('healthy');
    });

    it('health() reports config and active buckets', async () => {
      await limiter.consume('a', 2);
      await limiter.consume('b', 3);
      const h = await limiter.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('capacity', 10);
      expect(h.details).toHaveProperty('activeBuckets', 2);
    });
  });
});
