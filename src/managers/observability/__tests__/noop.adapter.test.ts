import { describe, it, expect } from 'vitest';
import { NoopObservabilityAdapter } from '../adapters/noop.adapter.js';
import type { ObservabilityManager } from '../ports.js';
import type { Span, SpanContext } from '../types.js';

describe('NoopObservabilityAdapter', () => {
  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------
  describe('lifecycle', () => {
    it('start() resolves', async () => {
      const adapter = new NoopObservabilityAdapter();
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves', async () => {
      const adapter = new NoopObservabilityAdapter();
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy', async () => {
      const adapter = new NoopObservabilityAdapter();
      const health = await adapter.health();
      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
    });

    it('health() includes adapter type in details', async () => {
      const adapter = new NoopObservabilityAdapter();
      const health = await adapter.health();
      expect(health.details.adapter).toBe('noop');
    });
  });

  // -----------------------------------------------------------------------
  // createSpan
  // -----------------------------------------------------------------------
  describe('createSpan', () => {
    it('returns a Span with valid context', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test-operation');
      expect(span).toBeDefined();
      expect(span.context).toBeDefined();
      expect(span.context.traceId).toHaveLength(32);
      expect(span.context.spanId).toHaveLength(16);
      expect(typeof span.context.traceFlags).toBe('number');
    });

    it('generates unique trace IDs per call', () => {
      const adapter = new NoopObservabilityAdapter();
      const span1 = adapter.createSpan('op1');
      const span2 = adapter.createSpan('op2');
      expect(span1.context.traceId).not.toBe(span2.context.traceId);
    });

    it('generates unique span IDs per call', () => {
      const adapter = new NoopObservabilityAdapter();
      const span1 = adapter.createSpan('op1');
      const span2 = adapter.createSpan('op2');
      expect(span1.context.spanId).not.toBe(span2.context.spanId);
    });

    it('accepts SpanOptions with attributes', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('http.request', {
        attributes: { 'http.method': 'GET', 'http.status_code': 200 },
        kind: 'SERVER',
      });
      expect(span).toBeDefined();
      expect(span.context).toBeDefined();
    });

    it('span.end() is callable without error', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test');
      expect(() => span.end()).not.toThrow();
    });

    it('span.setStatus() is callable without error', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test');
      expect(() => span.setStatus('OK')).not.toThrow();
      expect(() => span.setStatus('ERROR')).not.toThrow();
    });

    it('span.setAttribute() is callable without error', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test');
      expect(() => span.setAttribute('key', 'value')).not.toThrow();
    });

    it('span.addEvent() is callable without error', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test');
      expect(() => span.addEvent('event', { data: 1 })).not.toThrow();
    });

    it('span.recordException() is callable without error', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test');
      expect(() => span.recordException(new Error('boom'))).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // getActiveSpan
  // -----------------------------------------------------------------------
  describe('getActiveSpan', () => {
    it('returns undefined when no span has been created', () => {
      const adapter = new NoopObservabilityAdapter();
      expect(adapter.getActiveSpan()).toBeUndefined();
    });

    it('returns the last created span', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('active-op');
      expect(adapter.getActiveSpan()).toBe(span);
    });

    it('returns most recent span after multiple createSpan calls', () => {
      const adapter = new NoopObservabilityAdapter();
      adapter.createSpan('first');
      const second = adapter.createSpan('second');
      const third = adapter.createSpan('third');
      expect(adapter.getActiveSpan()).toBe(third);
    });
  });

  // -----------------------------------------------------------------------
  // setAttribute / recordException / addEvent
  // -----------------------------------------------------------------------
  describe('manager-level operations', () => {
    it('setAttribute() does not throw when no span is active', () => {
      const adapter = new NoopObservabilityAdapter();
      expect(() => adapter.setAttribute('key', 'value')).not.toThrow();
    });

    it('recordException() does not throw when no span is active', () => {
      const adapter = new NoopObservabilityAdapter();
      expect(() => adapter.recordException(new Error('test'))).not.toThrow();
    });

    it('addEvent() does not throw when no span is active', () => {
      const adapter = new NoopObservabilityAdapter();
      expect(() => adapter.addEvent('test-event', {})).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Port contract compliance
  // -----------------------------------------------------------------------
  describe('ObservabilityManager contract', () => {
    it('implements ObservabilityManager port', () => {
      const adapter: ObservabilityManager = new NoopObservabilityAdapter();
      expect(adapter).toBeDefined();
    });

    it('createSpan returns a Span with all required methods', () => {
      const adapter = new NoopObservabilityAdapter();
      const span: Span = adapter.createSpan('test');
      expect(typeof span.end).toBe('function');
      expect(typeof span.setStatus).toBe('function');
      expect(typeof span.setAttribute).toBe('function');
      expect(typeof span.addEvent).toBe('function');
      expect(typeof span.recordException).toBe('function');
      expect(span.context).toBeDefined();
      const ctx: SpanContext = span.context;
      expect(typeof ctx.traceId).toBe('string');
      expect(typeof ctx.spanId).toBe('string');
      expect(typeof ctx.traceFlags).toBe('number');
    });

    it('end() is idempotent', () => {
      const adapter = new NoopObservabilityAdapter();
      const span = adapter.createSpan('test');
      expect(() => {
        span.end();
        span.end();
        span.end();
      }).not.toThrow();
    });
  });
});
