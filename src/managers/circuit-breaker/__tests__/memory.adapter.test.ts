import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCircuitBreakerAdapter } from '../adapters/memory.adapter.js';
import { CircuitBreakerOpenError } from '../../../shared/errors.js';

describe('MemoryCircuitBreakerAdapter', () => {
  let cb: MemoryCircuitBreakerAdapter;

  beforeEach(async () => {
    cb = new MemoryCircuitBreakerAdapter({
      failureThreshold: 3,
      timeoutMs: 100,
      halfOpenMaxCalls: 2,
    });
    await cb.start();
  });

  afterEach(async () => {
    await cb.stop();
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  it('start() initializes in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
  });

  it('health() reports state and failure count', async () => {
    const h = await cb.health();
    expect(h.status).toBe('healthy');
    expect(h.details.adapter).toBe('memory');
    expect(h.details.state).toBe('CLOSED');
    expect(h.details.failureCount).toBe(0);
  });

  it('stop() resets state', async () => {
    await cb.stop();
    const h = await cb.health();
    expect(h.details.state).toBe('CLOSED');
    expect(h.details.failureCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // CLOSED state — normal operation
  // -----------------------------------------------------------------------

  it('execute() passes through function result when CLOSED', async () => {
    const result = await cb.execute(async () => 'success');
    expect(result).toBe('success');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('execute() counts failures but stays CLOSED below threshold', async () => {
    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(cb.getState()).toBe('CLOSED');

    await expect(
      cb.execute(async () => {
        throw new Error('fail again');
      }),
    ).rejects.toThrow('fail again');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('execute() transitions to OPEN after reaching failureThreshold', async () => {
    for (let i = 0; i < 2; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe('CLOSED'); // still below threshold (2 < 3)

    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN'); // threshold reached
  });

  it('execute() resets failure count on success', async () => {
    // Two failures
    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    // One success resets count
    await cb.execute(async () => 'recovered');
    // Should still be CLOSED
    expect(cb.getState()).toBe('CLOSED');

    // Two more failures won't open it (count was reset)
    await expect(
      cb.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(cb.getState()).toBe('CLOSED');
  });

  // -----------------------------------------------------------------------
  // OPEN state — fail fast
  // -----------------------------------------------------------------------

  it('execute() throws CircuitBreakerOpenError when OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe('OPEN');

    // Now calls fail fast
    await expect(cb.execute(async () => 'should not run')).rejects.toThrow(
      CircuitBreakerOpenError,
    );
  });

  it('execute() does NOT execute fn when OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }

    let wasCalled = false;
    await expect(
      cb.execute(async () => {
        wasCalled = true;
        return 'ok';
      }),
    ).rejects.toThrow(CircuitBreakerOpenError);
    expect(wasCalled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // HALF_OPEN state — trial period
  // -----------------------------------------------------------------------

  it('transitions from OPEN to HALF_OPEN after timeoutMs', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe('OPEN');

    // Wait for timeout
    await new Promise((r) => setTimeout(r, 150));

    // State should transition to HALF_OPEN on check
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('HALF_OPEN: success transitions to CLOSED', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }

    // Wait for timeout → HALF_OPEN
    await new Promise((r) => setTimeout(r, 150));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Successful call should close the circuit
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('HALF_OPEN: failure transitions back to OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }

    // Wait for HALF_OPEN
    await new Promise((r) => setTimeout(r, 150));

    // Half-open trial call fails → back to OPEN
    await expect(
      cb.execute(async () => {
        throw new Error('trial fail');
      }),
    ).rejects.toThrow('trial fail');

    expect(cb.getState()).toBe('OPEN');
  });

  it('HALF_OPEN respects halfOpenMaxCalls limit', async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }

    // Wait for HALF_OPEN
    await new Promise((r) => setTimeout(r, 150));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Two trial calls succeed → close (halfOpenMaxCalls = 2)
    await cb.execute(async () => 'ok1');
    await cb.execute(async () => 'ok2');
    expect(cb.getState()).toBe('CLOSED');
  });

  // -----------------------------------------------------------------------
  // reset()
  // -----------------------------------------------------------------------

  it('reset() returns circuit to CLOSED from OPEN', async () => {
    // Open via rapid failures
    const cbFast = new MemoryCircuitBreakerAdapter({
      failureThreshold: 1,
      timeoutMs: 1000,
    });
    await cbFast.start();

    await expect(
      cbFast.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(cbFast.getState()).toBe('OPEN');

    cbFast.reset();
    expect(cbFast.getState()).toBe('CLOSED');

    await cbFast.stop();
  });

  it('reset() returns circuit to CLOSED from HALF_OPEN', async () => {
    const cbFast = new MemoryCircuitBreakerAdapter({
      failureThreshold: 1,
      timeoutMs: 10,
    });
    await cbFast.start();

    // Open the circuit with one failure
    await expect(
      cbFast.execute(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    // Wait enough for timeout to transition to HALF_OPEN
    await new Promise((r) => setTimeout(r, 20));

    cbFast.reset();
    expect(cbFast.getState()).toBe('CLOSED');

    await cbFast.stop();
  });

  // -----------------------------------------------------------------------
  // Default options
  // -----------------------------------------------------------------------

  it('uses sensible defaults when no options provided', async () => {
    const defaultCb = new MemoryCircuitBreakerAdapter();
    await defaultCb.start();

    expect(defaultCb.getState()).toBe('CLOSED');

    // Default threshold should be 5
    for (let i = 0; i < 4; i++) {
      await expect(
        defaultCb.execute(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
    }
    expect(defaultCb.getState()).toBe('CLOSED'); // 4 failures < 5 threshold

    await defaultCb.stop();
  });
});
