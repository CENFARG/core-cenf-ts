import { describe, it, expect } from 'vitest';
import {
  CIRCUIT_BREAKER_PORT_VERSION,
  type CircuitBreakerManager,
} from '../ports.js';
import type { CircuitState, CircuitOptions } from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// Test implementation of CircuitBreakerManager for contract verification
// ---------------------------------------------------------------------------

class TestCircuitBreakerManager implements CircuitBreakerManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async execute<T>(
    fn: () => Promise<T>,
    _options?: CircuitOptions,
  ): Promise<T> {
    return fn();
  }

  getState(): CircuitState {
    return 'CLOSED';
  }

  reset(): void {}
}

// ---------------------------------------------------------------------------
// CircuitBreakerManager port contract tests
// ---------------------------------------------------------------------------

describe('CircuitBreakerManager port', () => {
  it('exports a runtime version constant', () => {
    expect(CIRCUIT_BREAKER_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: CircuitBreakerManager = new TestCircuitBreakerManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestCircuitBreakerManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('execute() passes through function result', async () => {
    const mgr = new TestCircuitBreakerManager();
    const result = await mgr.execute(async () => 42);
    expect(result).toBe(42);
  });

  it('execute() propagates function error', async () => {
    const mgr = new TestCircuitBreakerManager();
    await expect(
      mgr.execute(async () => {
        throw new Error('fn-failed');
      }),
    ).rejects.toThrow('fn-failed');
  });

  it('getState() returns CLOSED by default', () => {
    const mgr = new TestCircuitBreakerManager();
    expect(mgr.getState()).toBe('CLOSED');
  });

  it('reset() is callable', () => {
    const mgr = new TestCircuitBreakerManager();
    expect(() => mgr.reset()).not.toThrow();
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestCircuitBreakerManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker types tests
// ---------------------------------------------------------------------------

describe('Circuit breaker types', () => {
  it('CircuitState can be CLOSED, OPEN, or HALF_OPEN', () => {
    // Type-level verification — if the union doesn't include these,
    // TypeScript compilation would fail.
    const states: CircuitState[] = ['CLOSED', 'OPEN', 'HALF_OPEN'];
    expect(states).toHaveLength(3);
  });

  it('CircuitOptions supports failureThreshold and timeoutMs', () => {
    const opts: CircuitOptions = {
      failureThreshold: 5,
      timeoutMs: 30000,
      halfOpenMaxCalls: 3,
    };
    expect(opts.failureThreshold).toBe(5);
    expect(opts.timeoutMs).toBe(30000);
    expect(opts.halfOpenMaxCalls).toBe(3);
  });

  it('CircuitOptions has sensible defaults', () => {
    const opts: CircuitOptions = {};
    expect(opts.failureThreshold).toBeUndefined();
    expect(opts.timeoutMs).toBeUndefined();
  });
});
