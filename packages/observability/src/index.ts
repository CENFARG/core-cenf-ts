/**
 * @cenf/observability — distributed tracing and telemetry.
 *
 * @module @cenf/observability
 */

// Port
export { type ObservabilityManager, OBSERVABILITY_PORT_VERSION } from './ports.js';

// Types
export type { Span, SpanContext, SpanKind, SpanStatus, SpanAttributeValue, SpanOptions } from './types.js';
export { OBSERVABILITY_TYPES_VERSION } from './types.js';

// Adapters
export { NoopObservabilityAdapter } from './adapters/noop.adapter.js';
export { OTelAdapter } from './adapters/otel.adapter.js';
export type { OTelAdapterOptions } from './adapters/otel.adapter.js';
