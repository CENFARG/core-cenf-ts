import { describe, it, expect } from 'vitest';
import { runInContext, getContext, setContext } from '../context.js';
import type { ContextStore } from '../types.js';

describe('AsyncLocalStorage context', () => {
  it('getContext returns undefined outside of a context run', () => {
    expect(getContext()).toBeUndefined();
  });

  it('getContext returns the context store inside runInContext', () => {
    const ctx: ContextStore = { correlationId: 'test-1' };
    runInContext(ctx, () => {
      const stored = getContext();
      expect(stored).toBeDefined();
      expect(stored!.correlationId).toBe('test-1');
    });
  });

  it('getContext returns undefined after runInContext completes', () => {
    const ctx: ContextStore = { correlationId: 'after-test' };
    runInContext(ctx, () => {
      // context is set here
    });
    expect(getContext()).toBeUndefined();
  });

  it('setContext updates the current context store', () => {
    const ctx: ContextStore = { correlationId: 'original' };
    runInContext(ctx, () => {
      setContext({ tenantId: 'tenant-5' });
      const stored = getContext();
      expect(stored).toBeDefined();
      expect(stored!.correlationId).toBe('original');
      expect(stored!.tenantId).toBe('tenant-5');
    });
  });

  it('setContext overrides specific fields while preserving others', () => {
    const ctx: ContextStore = {
      correlationId: 'orig',
      tenantId: 'old-tenant',
    };
    runInContext(ctx, () => {
      setContext({ correlationId: 'new-correlation' });
      const stored = getContext();
      expect(stored!.correlationId).toBe('new-correlation');
      // tenantId preserved because merge is additive for unspecified fields
      expect(stored!.tenantId).toBe('old-tenant');
    });
  });

  it('nested runInContext contexts are isolated', () => {
    const outer: ContextStore = { correlationId: 'outer' };
    const inner: ContextStore = { correlationId: 'inner' };

    runInContext(outer, () => {
      expect(getContext()!.correlationId).toBe('outer');

      runInContext(inner, () => {
        expect(getContext()!.correlationId).toBe('inner');
      });

      // After inner completes, outer context is restored
      expect(getContext()!.correlationId).toBe('outer');
    });
  });

  it('correlation ID propagates through async operations', async () => {
    const ctx: ContextStore = { correlationId: 'async-test' };

    const result = await runInContext(ctx, async () => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      const stored = getContext();
      expect(stored!.correlationId).toBe('async-test');
      return stored!.correlationId;
    });

    expect(result).toBe('async-test');
    expect(getContext()).toBeUndefined();
  });

  it('setContext throws when called outside a context', () => {
    expect(() => setContext({ tenantId: 'bad' })).toThrow(
      'No active context',
    );
  });
});
