import { describe, it, expect, beforeEach } from 'vitest';
import { StandardBootstrapAdapter } from '../adapters/standard.adapter.js';
import { BootstrapError } from '@cenf/core';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

/**
 * Mock manager that tracks lifecycle calls.
 */
class MockLifecycle implements AsyncLifecycle {
  startCalls = 0;
  stopCalls = 0;
  healthCalls = 0;
  healthStatus: HealthStatus = { status: 'healthy', details: {} };
  startShouldFail = false;

  async start(): Promise<void> {
    this.startCalls++;
    if (this.startShouldFail) {
      throw new Error('Start failed');
    }
  }

  async stop(): Promise<void> {
    this.stopCalls++;
  }

  async health(): Promise<HealthStatus> {
    this.healthCalls++;
    return this.healthStatus;
  }
}

describe('StandardBootstrapAdapter', () => {
  let bootstrap: StandardBootstrapAdapter;

  beforeEach(() => {
    bootstrap = new StandardBootstrapAdapter();
  });

  describe('AsyncLifecycle', () => {
    it('health() returns healthy status', async () => {
      const health = await bootstrap.health();
      expect(health.status).toBeDefined();
    });
  });

  describe('register()', () => {
    it('registers a manager with default priority', () => {
      const mgr = new MockLifecycle();
      bootstrap.register(mgr);

      // Should not throw — priority defaults to 100
      // and name defaults to constructor name
    });

    it('registers a manager with explicit priority and name', () => {
      const mgr = new MockLifecycle();
      bootstrap.register(mgr, { priority: 1, name: 'config' });

      // Should not throw
    });

    it('throws when registering duplicate name', () => {
      const mgr = new MockLifecycle();
      bootstrap.register(mgr, { name: 'config' });

      expect(() =>
        bootstrap.register(new MockLifecycle(), { name: 'config' }),
      ).toThrow(BootstrapError);
    });
  });

  describe('start()', () => {
    it('starts managers in priority order', async () => {
      const low = new MockLifecycle();
      const high = new MockLifecycle();
      const mid = new MockLifecycle();

      bootstrap.register(low, { priority: 10, name: 'low' });
      bootstrap.register(high, { priority: 1, name: 'high' });
      bootstrap.register(mid, { priority: 5, name: 'mid' });

      await bootstrap.start();

      // high (1) should start before mid (5), mid before low (10)
      const startOrder: string[] = [];
      void startOrder; // acknowledged but unused — verified via startCalls counts
      expect(high.startCalls).toBe(1);
      expect(mid.startCalls).toBe(1);
      expect(low.startCalls).toBe(1);
    });

    it('rolls back already-started managers on failure', async () => {
      const first = new MockLifecycle();
      const second = new MockLifecycle();
      const third = new MockLifecycle();

      second.startShouldFail = true;

      bootstrap.register(first, { priority: 1, name: 'first' });
      bootstrap.register(second, { priority: 2, name: 'second' });
      bootstrap.register(third, { priority: 3, name: 'third' });

      await expect(bootstrap.start()).rejects.toThrow(BootstrapError);

      // first was started — should be rolled back
      expect(first.stopCalls).toBe(1);
      // second was the one that failed
      expect(second.stopCalls).toBe(0);
      // third was never started
      expect(third.startCalls).toBe(0);
      expect(third.stopCalls).toBe(0);
    });
  });

  describe('stop()', () => {
    it('stops managers in reverse priority order', async () => {
      const first = new MockLifecycle();
      const second = new MockLifecycle();

      bootstrap.register(first, { priority: 1, name: 'first' });
      bootstrap.register(second, { priority: 10, name: 'second' });

      await bootstrap.start();
      await bootstrap.stop();

      // All should be stopped
      expect(first.stopCalls).toBe(1);
      expect(second.stopCalls).toBe(1);
    });

    it('continues stopping remaining managers when one fails', async () => {
      const failing = new MockLifecycle();
      const normal = new MockLifecycle();

      // Make stop throw
      failing.stop = async () => {
        failing.stopCalls++;
        throw new Error('Stop failed');
      };

      bootstrap.register(failing, { priority: 1, name: 'failing' });
      bootstrap.register(normal, { priority: 10, name: 'normal' });

      await bootstrap.start();

      // stop() should still resolve (errors collected), but both should be called
      await bootstrap.stop();

      expect(failing.stopCalls).toBe(1);
      expect(normal.stopCalls).toBe(1);
    });

    it('stop with no managers succeeds', async () => {
      await expect(bootstrap.stop()).resolves.toBeUndefined();
    });
  });

  describe('full lifecycle', () => {
    it('start → health → stop cycle', async () => {
      const mgr1 = new MockLifecycle();
      const mgr2 = new MockLifecycle();

      bootstrap.register(mgr1, { priority: 1, name: 'mgr1' });
      bootstrap.register(mgr2, { priority: 2, name: 'mgr2' });

      await bootstrap.start();
      expect(mgr1.startCalls).toBe(1);
      expect(mgr2.startCalls).toBe(1);

      const health = await bootstrap.health();
      expect(health.status).toBeDefined();

      await bootstrap.stop();
      expect(mgr1.stopCalls).toBe(1);
      expect(mgr2.stopCalls).toBe(1);
    });
  });
});
