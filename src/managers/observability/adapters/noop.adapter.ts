/**
 * No-op observability adapter — testing default and graceful degradation.
 *
 * Implements the ObservabilityManager port with no external dependencies.
 * All spans are purely in-memory no-ops with no export or side effects.
 *
 * @module managers/observability/adapters/noop.adapter
 */

import { randomUUID } from 'node:crypto';
import type { ObservabilityManager } from '../ports.js';
import type {
  Span,
  SpanContext,
  SpanStatus,
  SpanAttributeValue,
  SpanOptions,
} from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// NoopSpan — in-memory no-op span
// ---------------------------------------------------------------------------

/**
 * In-memory no-op span implementation.
 *
 * All methods are safe no-ops. The span carries a valid context
 * with generated trace/span IDs.
 */
class NoopSpanImpl implements Span {
  readonly context: SpanContext;

  constructor(
    traceId: string,
    spanId: string,
    traceFlags: number = 1,
  ) {
    this.context = { traceId, spanId, traceFlags };
  }

  end(): void {
    // No-op: no export or duration recording.
  }

  setStatus(_status: SpanStatus): void {
    // No-op: status is not persisted.
  }

  setAttribute(_key: string, _value: SpanAttributeValue): void {
    // No-op: attributes are not persisted.
  }

  addEvent(
    _name: string,
    _attributes?: Record<string, SpanAttributeValue>,
  ): void {
    // No-op: events are not persisted.
  }

  recordException(_error: unknown): void {
    // No-op: exceptions are not persisted.
  }
}

// ---------------------------------------------------------------------------
// NoopObservabilityAdapter
// ---------------------------------------------------------------------------

/**
 * No-op observability adapter for testing and graceful degradation.
 *
 * Creates in-memory no-op spans with generated trace/span IDs.
 * Maintains a reference to the last created span as the "active" span.
 * All span operations are safe no-ops with zero side effects.
 *
 * Use this adapter:
 * - In unit tests where real OTel is not available
 * - As the default when `CENF_OTEL_ENABLED=false`
 * - For graceful degradation when the OTel SDK fails to initialize
 */
export class NoopObservabilityAdapter implements ObservabilityManager {
  private activeSpan: Span | undefined;

  // -----------------------------------------------------------------------
  // ObservabilityManager
  // -----------------------------------------------------------------------

  createSpan(name: string, options?: SpanOptions): Span {
    const traceId = randomUUID().replace(/-/g, '');
    const spanId = randomUUID().replace(/-/g, '').slice(0, 16);
    const span = new NoopSpanImpl(traceId, spanId);
    void name; // acknowledged but unused in no-op
    void options; // acknowledged but unused in no-op
    this.activeSpan = span;
    return span;
  }

  getActiveSpan(): Span | undefined {
    return this.activeSpan;
  }

  setAttribute(_key: string, _value: SpanAttributeValue): void {
    // No-op: no active span required.
  }

  recordException(_error: unknown): void {
    // No-op: no active span required.
  }

  addEvent(
    _name: string,
    _attributes?: Record<string, SpanAttributeValue>,
  ): void {
    // No-op: no active span required.
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: no connections or providers to initialize.
  }

  async stop(): Promise<void> {
    // No-op: no resources to clean up.
    this.activeSpan = undefined;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'noop',
        activeSpan: this.activeSpan?.context.spanId ?? null,
      },
    };
  }
}
