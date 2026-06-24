import { describe, it, expect } from 'vitest';
import {
  OBSERVABILITY_PORT_VERSION,
  type ObservabilityManager,
} from '../ports.js';
import type {
  Span,
  SpanContext,
  SpanKind,
  SpanStatus,
  SpanAttributeValue,
  SpanOptions,
} from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

/** No-op Span for testing the Span contract. */
class NoopSpan implements Span {
  readonly context: SpanContext = {
    traceId: '00000000000000000000000000000000',
    spanId: '0000000000000000',
    traceFlags: 0,
  };

  end(): void {}
  setStatus(_status: SpanStatus): void {}
  setAttribute(_key: string, _value: SpanAttributeValue): void {}
  addEvent(_name: string, _attributes?: Record<string, SpanAttributeValue>): void {}
  recordException(_error: unknown): void {}
}

/** Test implementation of ObservabilityManager for contract verification. */
class TestObservabilityManager implements ObservabilityManager {
  private spans: Span[] = [];
  private activeSpan: Span | undefined;

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  createSpan(name: string, options?: SpanOptions): Span {
    const span = new NoopSpan();
    this.spans.push(span);
    this.activeSpan = span;
    return span;
  }

  getActiveSpan(): Span | undefined {
    return this.activeSpan;
  }

  setAttribute(_key: string, _value: SpanAttributeValue): void {
    // No-op: attribute on active span
  }

  recordException(_error: unknown): void {
    // No-op: record on active span
  }

  addEvent(_name: string, _attributes?: Record<string, SpanAttributeValue>): void {
    // No-op: add event to active span
  }
}

// ---------------------------------------------------------------------------
// ObservabilityManager port contract
// ---------------------------------------------------------------------------
describe('ObservabilityManager port', () => {
  it('exports a runtime version constant', () => {
    expect(OBSERVABILITY_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: ObservabilityManager = new TestObservabilityManager();
    // TypeScript structural: compiles only if ObservabilityManager extends AsyncLifecycle
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestObservabilityManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('createSpan() returns a Span with context', () => {
    const mgr = new TestObservabilityManager();
    const span = mgr.createSpan('test-operation');
    expect(span).toBeDefined();
    expect(span.context).toBeDefined();
    expect(span.context.traceId).toBeDefined();
    expect(span.context.spanId).toBeDefined();
    expect(typeof span.context.traceFlags).toBe('number');
  });

  it('createSpan() accepts optional SpanOptions', () => {
    const mgr = new TestObservabilityManager();
    const span = mgr.createSpan('test-op', {
      attributes: { 'service.name': 'test' },
      kind: 'CLIENT' as SpanKind,
    });
    expect(span).toBeDefined();
    expect(span.context).toBeDefined();
  });

  it('getActiveSpan() returns active span after createSpan', () => {
    const mgr = new TestObservabilityManager();
    const span = mgr.createSpan('active-op');
    const active = mgr.getActiveSpan();
    expect(active).toBe(span);
  });

  it('getActiveSpan() returns undefined when no span is active', () => {
    const mgr = new TestObservabilityManager();
    // No span created — should be undefined
    expect(mgr.getActiveSpan()).toBeUndefined();
  });

  it('setAttribute() does not throw', () => {
    const mgr = new TestObservabilityManager();
    expect(() => mgr.setAttribute('key', 'value')).not.toThrow();
  });

  it('recordException() does not throw', () => {
    const mgr = new TestObservabilityManager();
    expect(() => mgr.recordException(new Error('test error'))).not.toThrow();
  });

  it('addEvent() does not throw', () => {
    const mgr = new TestObservabilityManager();
    expect(() =>
      mgr.addEvent('cache.hit', { key: 'user:123' }),
    ).not.toThrow();
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestObservabilityManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Span contract
// ---------------------------------------------------------------------------
describe('Span contract', () => {
  it('Span has context with traceId and spanId', () => {
    const span = new NoopSpan();
    expect(span.context.traceId).toBe('00000000000000000000000000000000');
    expect(span.context.spanId).toBe('0000000000000000');
    expect(span.context.traceFlags).toBe(0);
  });

  it('Span.end() is callable', () => {
    const span = new NoopSpan();
    expect(() => span.end()).not.toThrow();
  });

  it('Span.setStatus() is callable', () => {
    const span = new NoopSpan();
    expect(() => span.setStatus('OK' as SpanStatus)).not.toThrow();
    expect(() => span.setStatus('ERROR' as SpanStatus)).not.toThrow();
  });

  it('Span.setAttribute() is callable', () => {
    const span = new NoopSpan();
    expect(() => span.setAttribute('http.method', 'GET')).not.toThrow();
  });

  it('Span.addEvent() is callable', () => {
    const span = new NoopSpan();
    expect(() => span.addEvent('retry', { attempt: 3 })).not.toThrow();
  });

  it('Span.recordException() is callable', () => {
    const span = new NoopSpan();
    expect(() => span.recordException(new Error('boom'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Type-level checks (compile-time)
// ---------------------------------------------------------------------------
describe('Observability types', () => {
  it('SpanContext is structurally valid', () => {
    const ctx: SpanContext = {
      traceId: 'abc',
      spanId: 'def',
      traceFlags: 1,
    };
    expect(ctx.traceId).toBe('abc');
    expect(ctx.spanId).toBe('def');
    expect(ctx.traceFlags).toBe(1);
  });

  it('SpanKind values are assignable', () => {
    const kinds: SpanKind[] = ['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'];
    expect(kinds).toHaveLength(5);
  });

  it('SpanStatus values are assignable', () => {
    const statuses: SpanStatus[] = ['UNSET', 'OK', 'ERROR'];
    expect(statuses).toHaveLength(3);
  });

  it('SpanAttributeValue accepts string, number, boolean', () => {
    const str: SpanAttributeValue = 'hello';
    const num: SpanAttributeValue = 42;
    const bool: SpanAttributeValue = true;
    expect(str).toBe('hello');
    expect(num).toBe(42);
    expect(bool).toBe(true);
  });
});
