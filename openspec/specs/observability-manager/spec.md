# ObservabilityManager Specification

## Purpose

Provides OpenTelemetry integration for distributed tracing, metrics, and error recording. Enables correlation of requests across services via context propagation.

## Port Interface

```typescript
interface IObservabilityManager {
  createSpan(name: string, context?: SpanContext): Span;
  recordMetric(name: string, value: number, attributes?: MetricAttributes): void;
  recordError(error: Error, context?: SpanContext): void;
  addEvent(name: string, attributes?: EventAttributes): void;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `OpenTelemetryAdapter` | Wraps `@opentelemetry/api` for spans, metrics, context |
| `MemoryObservabilityAdapter` | In-memory capture for testing |

## Error Types

- `ObservabilityConfigurationError` — OTel SDK not initialized, invalid exporter config

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_OTEL_ENABLED` | `boolean` | `true` | Enable OTel instrumentation |
| `CENF_OTEL_SERVICE_NAME` | `string` | `cenf-service` | Service name for traces |
| `CENF_OTEL_EXPORTER` | `none\|console\|otlp` | `console` | Span exporter type |

## Lifecycle

- `start()`: Initializes OTel SDK with tracer provider, meter provider, propagator
- `stop()`: Flushes pending spans/metrics, shuts down providers
- `health()`: Returns `{ status: 'healthy'|'degraded', details: { exporter, pendingSpans } }`

## Testing Strategy

- **Unit**: `MemoryObservabilityAdapter` captures spans and metrics
- **Integration**: `OpenTelemetryAdapter` with console exporter
- **Edge cases**: OTel disabled (graceful degradation), exporter failures

## Requirements

### Requirement: Distributed Tracing with Spans

The system MUST create spans with name, parent context, and attributes. Spans MUST propagate correlation IDs via AsyncLocalStorage.

#### Scenario: Create span with parent context

- GIVEN an active parent span in AsyncLocalStorage
- WHEN `obs.createSpan("db.query", { attributes: { "db.statement": "SELECT..." } })` is called
- THEN a child span is created linked to the parent
- AND the span includes the `db.statement` attribute

#### Scenario: Span lifecycle — start and end

- GIVEN a span created via `createSpan("http.request")`
- WHEN `span.end()` is called
- THEN the span duration is recorded
- AND the span is exported to the configured exporter

#### Scenario: OTel disabled graceful degradation

- GIVEN `CENF_OTEL_ENABLED=false`
- WHEN `obs.createSpan("test")` is called
- THEN a no-op span is returned
- AND no error is thrown
- AND no exporter is called

### Requirement: Metric Recording

The system MUST record named metrics with numeric values and optional attributes. Metrics MUST support counters, gauges, and histograms.

#### Scenario: Record counter metric

- WHEN `obs.recordMetric("http.requests.total", 1, { method: "GET" })` is called
- THEN a counter metric is incremented
- AND the attribute `method: "GET"` is attached

#### Scenario: Error recording with context

- GIVEN an error `new Error("timeout")` and active span context
- WHEN `obs.recordError(err, context)` is called
- THEN the error is attached to the current span
- AND the span status is set to ERROR

#### Scenario: Custom event on span

- WHEN `obs.addEvent("cache.miss", { key: "user:123" })` is called
- THEN an event is added to the active span
- AND the event includes the key attribute
