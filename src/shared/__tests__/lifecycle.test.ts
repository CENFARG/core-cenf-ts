import { describe, it, expect } from 'vitest';
import { LIFECYCLE_VERSION } from '../lifecycle.js';
import type { AsyncLifecycle } from '../lifecycle.js';
import type { HealthStatus } from '../types.js';

/** Test implementation of AsyncLifecycle for contract verification. */
class TestLifecycle implements AsyncLifecycle {
  public started = false;
  public stopped = false;
  public healthResult: HealthStatus = { status: 'healthy', details: {} };

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  async health(): Promise<HealthStatus> {
    return this.healthResult;
  }
}

describe('AsyncLifecycle interface', () => {
  it('exports a runtime version constant', () => {
    expect(LIFECYCLE_VERSION).toBe('0.1.0');
  });

  it('is implemented by a conformant class', () => {
    const lifecycle: AsyncLifecycle = new TestLifecycle();
    expect(lifecycle).toBeDefined();
  });

  it('start() is callable and returns Promise<void>', async () => {
    const lifecycle = new TestLifecycle();
    await lifecycle.start();
    expect(lifecycle.started).toBe(true);
  });

  it('stop() is callable and returns Promise<void>', async () => {
    const lifecycle = new TestLifecycle();
    await lifecycle.stop();
    expect(lifecycle.stopped).toBe(true);
  });

  it('health() returns a valid HealthStatus', async () => {
    const lifecycle = new TestLifecycle();
    lifecycle.healthResult = {
      status: 'degraded',
      details: { reason: 'test' },
    };
    const result = await lifecycle.health();
    expect(result.status).toBe('degraded');
    expect(result.details).toEqual({ reason: 'test' });
  });

  it('supports full lifecycle: start → health → stop', async () => {
    const lifecycle = new TestLifecycle();
    await lifecycle.start();
    expect(lifecycle.started).toBe(true);

    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');

    await lifecycle.stop();
    expect(lifecycle.stopped).toBe(true);
  });

  it('multiple implementations can coexist', () => {
    class AnotherLifecycle implements AsyncLifecycle {
      async start(): Promise<void> {}
      async stop(): Promise<void> {}
      async health(): Promise<HealthStatus> {
        return { status: 'healthy', details: {} };
      }
    }

    const a = new TestLifecycle();
    const b = new AnotherLifecycle();
    expect(a).not.toBe(b);
  });
});
