/**
 * OpenTelemetry observability adapter — distributed tracing and metrics.
 *
 * Implements the ObservabilityManager port using @opentelemetry/api
 * for span creation, attribute setting, exception recording, and metrics.
 *
 * @module managers/observability/adapters/otel.adapter
 */

import {
  trace,
  metrics,
  SpanStatusCode,
  type Tracer,
  type Meter,
  type SpanKind as OTelSpanKind,
} from '@opentelemetry/api';
import type { ObservabilityManager } from '../ports.js';
import type {
  Span,
  SpanContext,
  SpanStatus,
  SpanAttributeValue,
  SpanOptions,
} from '../types.js';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// OTelAdapterOptions
// ---------------------------------------------------------------------------

/**
 * Options for configuring the OTelAdapter.
 */
export interface OTelAdapterOptions {
  /**
   * Service name for the tracer and meter.
   *
   * @default 'core-cenf'
   */
  serviceName?: string;
}

// ---------------------------------------------------------------------------
// OTelSpanWrapper — wraps OTel span to our Span interface
// ---------------------------------------------------------------------------

/**
 * Wraps an OpenTelemetry span to conform to the CENF Span interface.
 */
class OTelSpanWrapper implements Span {
  readonly context: SpanContext;
  private readonly otelSpan: import('@opentelemetry/api').Span;

  constructor(otelSpan: import('@opentelemetry/api').Span) {
    this.otelSpan = otelSpan;
    const ctx = otelSpan.spanContext();
    this.context = {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      traceFlags: ctx.traceFlags,
    };
  }

  end(): void {
    this.otelSpan.end();
  }

  setStatus(status: SpanStatus): void {
    const codeMap: Record<SpanStatus, number> = {
      UNSET: SpanStatusCode.UNSET,
      OK: SpanStatusCode.OK,
      ERROR: SpanStatusCode.ERROR,
    };
    this.otelSpan.setStatus({ code: codeMap[status] });
  }

  setAttribute(key: string, value: SpanAttributeValue): void {
    this.otelSpan.setAttribute(key, value);
  }

  addEvent(
    name: string,
    attributes?: Record<string, SpanAttributeValue>,
  ): void {
    this.otelSpan.addEvent(name, attributes);
  }

  recordException(error: unknown): void {
    this.otelSpan.recordException(
      error instanceof Error ? error : new Error(String(error)),
    );
    this.otelSpan.setStatus({ code: SpanStatusCode.ERROR });
  }
}

// ---------------------------------------------------------------------------
// SpanKind mapping
// ---------------------------------------------------------------------------

const SPAN_KIND_MAP: Record<string, OTelSpanKind> = {
  INTERNAL: 0,
  SERVER: 1,
  CLIENT: 2,
  PRODUCER: 3,
  CONSUMER: 4,
};

// ---------------------------------------------------------------------------
// OTelAdapter
// ---------------------------------------------------------------------------

/**
 * OpenTelemetry-backed observability adapter.
 *
 * Features:
 * - Span creation with kind and attributes via OTel tracer
 * - Attribute setting, event recording, exception recording on active span
 * - Counter and histogram metric creation via OTel meter
 * - Graceful degradation when OTel SDK is not initialized
 *
 * Use this adapter:
 * - In production with an OTel-compatible backend (Jaeger, Zipkin, etc.)
 * - For distributed tracing across microservices
 * - For application metrics collection
 */
export class OTelAdapter implements ObservabilityManager {
  private tracer: Tracer | null = null;
  private meter: Meter | null = null;
  private readonly serviceName: string;
  private activeSpan: Span | undefined;
  private started = false;

  constructor(options: OTelAdapterOptions = {}) {
    this.serviceName = options.serviceName ?? 'core-cenf';
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.tracer = trace.getTracer(this.serviceName);
    this.meter = metrics.getMeter(this.serviceName);
    this.started = true;
  }

  async stop(): Promise<void> {
    this.tracer = null;
    this.meter = null;
    this.activeSpan = undefined;
    this.started = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: this.started ? 'healthy' : 'degraded',
      details: {
        adapter: 'otel',
        started: this.started,
        serviceName: this.serviceName,
        activeSpan: this.activeSpan?.context.spanId ?? null,
      },
    };
  }

  // -----------------------------------------------------------------------
  // ObservabilityManager — createSpan
  // -----------------------------------------------------------------------

  createSpan(name: string, options?: SpanOptions): Span {
    if (!this.tracer) {
      throw new Error('OTelAdapter not started — call start() first');
    }

    const otelOptions: Record<string, unknown> | undefined = options
      ? {
          kind: options.kind ? SPAN_KIND_MAP[options.kind] : undefined,
          attributes: options.attributes,
        }
      : undefined;

    const otelSpan = this.tracer.startSpan(name, otelOptions as never);
    const wrapped = new OTelSpanWrapper(otelSpan);
    this.activeSpan = wrapped;
    return wrapped;
  }

  // -----------------------------------------------------------------------
  // ObservabilityManager — getActiveSpan
  // -----------------------------------------------------------------------

  getActiveSpan(): Span | undefined {
    return this.activeSpan;
  }

  // -----------------------------------------------------------------------
  // ObservabilityManager — setAttribute
  // -----------------------------------------------------------------------

  setAttribute(key: string, value: SpanAttributeValue): void {
    this.activeSpan?.setAttribute(key, value);
  }

  // -----------------------------------------------------------------------
  // ObservabilityManager — recordException
  // -----------------------------------------------------------------------

  recordException(error: unknown): void {
    if (!this.activeSpan) return;
    this.activeSpan.recordException(error);
    this.activeSpan.setStatus('ERROR');
  }

  // -----------------------------------------------------------------------
  // ObservabilityManager — addEvent
  // -----------------------------------------------------------------------

  addEvent(
    name: string,
    attributes?: Record<string, SpanAttributeValue>,
  ): void {
    this.activeSpan?.addEvent(name, attributes);
  }

  // -----------------------------------------------------------------------
  // Metrics — createCounter
  // -----------------------------------------------------------------------

  /**
   * Create a counter metric.
   *
   * @param name - Metric name (e.g., 'http.requests.total').
   * @param description - Optional metric description.
   * @returns A counter with an `add(value)` method.
   */
  createCounter(
    name: string,
    description?: string,
  ): { add(value: number): void } {
    if (!this.meter) {
      throw new Error('OTelAdapter not started — call start() first');
    }

    const counter = this.meter.createCounter(name, description ? { description } : undefined);
    return {
      add(value: number): void {
        counter.add(value);
      },
    };
  }

  // -----------------------------------------------------------------------
  // Metrics — createHistogram
  // -----------------------------------------------------------------------

  /**
   * Create a histogram metric.
   *
   * @param name - Metric name (e.g., 'http.request.duration').
   * @param description - Optional metric description.
   * @returns A histogram with a `record(value)` method.
   */
  createHistogram(
    name: string,
    description?: string,
  ): { record(value: number): void } {
    if (!this.meter) {
      throw new Error('OTelAdapter not started — call start() first');
    }

    const histogram = this.meter.createHistogram(name, description ? { description } : undefined);
    return {
      record(value: number): void {
        histogram.record(value);
      },
    };
  }
}
