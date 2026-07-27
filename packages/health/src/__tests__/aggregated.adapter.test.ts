import { describe, it, expect, beforeEach } from 'vitest';
import { AggregatedHealthCheckAdapter } from '../adapters/aggregated.adapter.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

/**
 * Mock manager that implements AsyncLifecycle for health check testing.
 */
class MockManager implements AsyncLifecycle {
  private healthStatus: HealthStatus;

  constructor(status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy') {
    this.healthStatus = {
      status,
      details: { mock: true, status },
    };
  }

  setHealth(status: HealthStatus): void {
    this.healthStatus = status;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return this.healthStatus;
  }
}

/**
 * Mock manager that throws on health check.
 */
class FailingManager implements AsyncLifecycle {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    throw new Error('Health check failure');
  }
}

describe('AggregatedHealthCheckAdapter', () => {
  let adapter: AggregatedHealthCheckAdapter;

  beforeEach(() => {
    adapter = new AggregatedHealthCheckAdapter();
  });

  describe('AsyncLifecycle', () => {
    it('start() resolves successfully', async () => {
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves successfully', async () => {
      await adapter.start();
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns aggregated status', async () => {
      await adapter.start();
      const health = await adapter.health();
      expect(health.status).toBeDefined();
      expect(health.details).toBeDefined();
    });
  });

  describe('check() with no managers', () => {
    it('returns healthy when no managers registered', async () => {
      const report = await adapter.check();
      expect(report.status).toBe('healthy');
      expect(report.components).toEqual({});
      expect(report.timestamp).toBeGreaterThan(0);
    });
  });

  describe('check() with registered managers', () => {
    it('reports single healthy manager', async () => {
      const mgr = new MockManager('healthy');
      adapter.register(mgr, 'config');

      const report = await adapter.check();
      expect(report.status).toBe('healthy');
      expect(report.components.config).toEqual({
        status: 'healthy',
        details: { mock: true, status: 'healthy' },
      });
    });

    it('reports aggregated status — degraded if any degraded', async () => {
      const healthy = new MockManager('healthy');
      const degraded = new MockManager('degraded');
      adapter.register(healthy, 'config');
      adapter.register(degraded, 'cache');

      const report = await adapter.check();
      expect(report.status).toBe('degraded');
    });

    it('reports aggregated status — unhealthy if any unhealthy', async () => {
      const healthy = new MockManager('healthy');
      const unhealthy = new MockManager('unhealthy');
      adapter.register(healthy, 'config');
      adapter.register(unhealthy, 'db');

      const report = await adapter.check();
      expect(report.status).toBe('unhealthy');
    });

    it('unhealthy takes priority over degraded', async () => {
      const degraded = new MockManager('degraded');
      const unhealthy = new MockManager('unhealthy');
      adapter.register(degraded, 'cache');
      adapter.register(unhealthy, 'db');

      const report = await adapter.check();
      expect(report.status).toBe('unhealthy');
    });

    it('reports all components in result', async () => {
      const mgr1 = new MockManager('healthy');
      const mgr2 = new MockManager('healthy');
      adapter.register(mgr1, 'config');
      adapter.register(mgr2, 'logging');

      const report = await adapter.check();
      expect(Object.keys(report.components)).toEqual(['config', 'logging']);
    });
  });

  describe('check() with failing managers', () => {
    it('marks throwing manager as unhealthy', async () => {
      const healthy = new MockManager('healthy');
      const failing = new FailingManager();
      adapter.register(healthy, 'config');
      adapter.register(failing, 'db');

      const report = await adapter.check();
      expect(report.status).toBe('unhealthy');
      expect(report.components.db.status).toBe('unhealthy');
    });

    it('does not block other health checks when one throws', async () => {
      const mgr1 = new MockManager('healthy');
      const failing = new FailingManager();
      adapter.register(mgr1, 'config');
      adapter.register(failing, 'db');

      const report = await adapter.check();
      expect(report.components.config.status).toBe('healthy');
      expect(report.components.db.status).toBe('unhealthy');
    });
  });

  describe('isReady() and isLive()', () => {
    it('isReady returns true when all healthy', async () => {
      const mgr = new MockManager('healthy');
      adapter.register(mgr, 'config');

      const ready = await adapter.isReady();
      expect(ready).toBe(true);
    });

    it('isReady returns false when degraded', async () => {
      const mgr = new MockManager('degraded');
      adapter.register(mgr, 'config');

      const ready = await adapter.isReady();
      expect(ready).toBe(false);
    });

    it('isLive returns true when check succeeds', async () => {
      const mgr = new MockManager('healthy');
      adapter.register(mgr, 'config');

      const live = await adapter.isLive();
      expect(live).toBe(true);
    });

    it('isLive returns true even when managers throw (mechanism is functional)', async () => {
      const failing = new FailingManager();
      adapter.register(failing, 'db');

      // isLive checks if the health mechanism works, not if all managers are healthy.
      // Since check() catches individual manager errors, the mechanism itself functions.
      const live = await adapter.isLive();
      expect(live).toBe(true);
    });
  });

  describe('stop() cleanup', () => {
    it('clears all registered managers on stop', async () => {
      const mgr = new MockManager('healthy');
      await adapter.start();
      adapter.register(mgr, 'config');
      await adapter.stop();

      // After stop, no managers registered — empty check is healthy
      const report = await adapter.check();
      expect(report.components).toEqual({});
    });
  });
});
