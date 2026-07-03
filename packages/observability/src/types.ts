/**
 * ObservabilityManager-specific types.
 *
 * Types for spans, context, attributes, and span configuration.
 *
 * @module managers/observability/types
 */

// ---------------------------------------------------------------------------
// Span context — identifies a span within a trace
// ---------------------------------------------------------------------------

/**
 * Immutable context identifying a span within a distributed trace.
 *
 * Mirrors the W3C TraceContext specification with trace ID,
 * span ID, and trace flags.
 */
export interface SpanContext {
  /** 32-character hex trace identifier. */
  readonly traceId: string;
  /** 16-character hex span identifier. */
  readonly spanId: string;
  /** W3C trace flags (e.g., sampled = 1). */
  readonly traceFlags: number;
}

// ---------------------------------------------------------------------------
// Span — represents a single operation within a trace
// ---------------------------------------------------------------------------

/**
 * A span represents a single operation within a distributed trace.
 *
 * Spans can be nested (parent-child) and carry attributes,
 * events, and status information.
 */
export interface Span {
  /** Immutable span context identifying this span. */
  readonly context: SpanContext;

  /** End the span, recording its duration. */
  end(): void;

  /** Set the status of this span. */
  setStatus(status: SpanStatus): void;

  /** Set an attribute on this span. */
  setAttribute(key: string, value: SpanAttributeValue): void;

  /** Add a named event to this span. */
  addEvent(
    name: string,
    attributes?: Record<string, SpanAttributeValue>,
  ): void;

  /** Record an exception on this span (sets status to ERROR). */
  recordException(error: unknown): void;
}

// ---------------------------------------------------------------------------
// Span kind — describes the relationship between spans
// ---------------------------------------------------------------------------

/**
 * Describes the relationship between the span, its parents,
 * and its children in a trace.
 */
export type SpanKind =
  | 'INTERNAL'
  | 'SERVER'
  | 'CLIENT'
  | 'PRODUCER'
  | 'CONSUMER';

// ---------------------------------------------------------------------------
// Span status — the result of the operation
// ---------------------------------------------------------------------------

/**
 * The status of a finished span.
 */
export type SpanStatus = 'UNSET' | 'OK' | 'ERROR';

// ---------------------------------------------------------------------------
// Attribute value — the type of data that can be stored on a span
// ---------------------------------------------------------------------------

/**
 * Valid attribute value types for spans and events.
 *
 * Mirrors the OpenTelemetry attribute value type system:
 * string, number, or boolean.
 */
export type SpanAttributeValue = string | number | boolean;

// ---------------------------------------------------------------------------
// Span options — configuration when creating a span
// ---------------------------------------------------------------------------

/**
 * Options for configuring a newly created span.
 */
export interface SpanOptions {
  /** Initial attributes to set on the span. */
  attributes?: Record<string, SpanAttributeValue>;
  /** The span kind (default: INTERNAL). */
  kind?: SpanKind;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const OBSERVABILITY_TYPES_VERSION = '0.1.0';
