import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OTelAdapter } from '../otel.adapter.js';
import type { ObservabilityManager } from '../../ports.js';

// ---------------------------------------------------------------------------
// Mock @opentelemetry/api
// ---------------------------------------------------------------------------

const {
  mockSpanSetAttribute,
  mockSpanAddEvent,
  mockSpanRecordException,
  mockSpanSetStatus,
  mockSpanEnd,
  mockTracerStartSpan,
  mockTracerGetActiveSpan,
  mockMeterCreateCounter,
  mockMeterCreateHistogram,
  mockCounterAdd,
  mockHistogramRecord,
  mockGetTracer,
  mockGetMeter,
} = vi.hoisted(() => {
  const setAttribute = vi.fn();
  const addEvent = vi.fn();
  const recordException = vi.fn();
  const setStatus = vi.fn();
  const end = vi.fn();

  const mockSpan = {
    setAttribute,
    addEvent,
    recordException,
    setStatus,
    end,
    spanContext: vi.fn().mockReturnValue({
      traceId: 'abc123def456abc123def456abc123de',
      spanId: 'abc123def456ab',
      traceFlags: 1,
    }),
  };

  const startSpan = vi.fn().mockReturnValue(mockSpan);
  const getActiveSpan = vi.fn().mockReturnValue(mockSpan);

  const counterAdd = vi.fn();
  const histogramRecord = vi.fn();

  const createCounter = vi.fn().mockReturnValue({ add: counterAdd });
  const createHistogram = vi.fn().mockReturnValue({ record: histogramRecord });

  const getTracer = vi.fn().mockReturnValue({
    startSpan,
    startActiveSpan: vi.fn((name: string, fn: (span: typeof mockSpan) => void) => {
      fn(mockSpan);
    }),
  });

  const getMeter = vi.fn().mockReturnValue({
    createCounter,
    createHistogram,
  });

  return {
    mockSpanSetAttribute: setAttribute,
    mockSpanAddEvent: addEvent,
    mockSpanRecordException: recordException,
    mockSpanSetStatus: setStatus,
    mockSpanEnd: end,
    mockTracerStartSpan: startSpan,
    mockTracerGetActiveSpan: getActiveSpan,
    mockMeterCreateCounter: createCounter,
    mockMeterCreateHistogram: createHistogram,
    mockCounterAdd: counterAdd,
    mockHistogramRecord: histogramRecord,
    mockGetTracer: getTracer,
    mockGetMeter: getMeter,
  };
});

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: mockGetTracer,
    getActiveSpan: mockTracerGetActiveSpan,
  },
  metrics: {
    getMeter: mockGetMeter,
  },
  SpanStatusCode: {
    UNSET: 0,
    OK: 1,
    ERROR: 2,
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OTelAdapter', () => {
  let adapter: OTelAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await adapter?.stop();
    } catch {
      // Ignore stop failures
    }
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  it('start() initializes the adapter', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    expect(mockGetTracer).toHaveBeenCalledWith('test-service');
  });

  it('start() uses default service name when not provided', async () => {
    adapter = new OTelAdapter();
    await adapter.start();

    expect(mockGetTracer).toHaveBeenCalledWith('core-cenf');
  });

  it('health() reports healthy after start', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details.adapter).toBe('otel');
  });

  it('health() reports degraded before start', async () => {
    adapter = new OTelAdapter();
    const health = await adapter.health();
    expect(health.status).toBe('degraded');
  });

  // -----------------------------------------------------------------------
  // Tracing — createSpan
  // -----------------------------------------------------------------------

  it('createSpan() creates a span via OTel tracer', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    const span = adapter.createSpan('http.request');

    expect(mockTracerStartSpan).toHaveBeenCalledWith(
      'http.request',
      undefined,
    );
    expect(span).toBeDefined();
    expect(span.context.traceId).toBeTruthy();
  });

  it('createSpan() passes options to tracer', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    adapter.createSpan('db.query', {
      kind: 'CLIENT',
      attributes: { 'db.system': 'postgres' },
    });

    expect(mockTracerStartSpan).toHaveBeenCalledWith(
      'db.query',
      expect.objectContaining({
        kind: expect.any(Number),
        attributes: { 'db.system': 'postgres' },
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Tracing — setAttribute
  // -----------------------------------------------------------------------

  it('setAttribute() sets attribute on active span', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    adapter.createSpan('test');
    adapter.setAttribute('http.method', 'GET');

    expect(mockSpanSetAttribute).toHaveBeenCalledWith('http.method', 'GET');
  });

  // -----------------------------------------------------------------------
  // Tracing — recordException
  // -----------------------------------------------------------------------

  it('recordException() records error on active span', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    adapter.createSpan('test');
    const error = new Error('test error');
    adapter.recordException(error);

    expect(mockSpanRecordException).toHaveBeenCalledWith(error);
    expect(mockSpanSetStatus).toHaveBeenCalledWith({ code: 2 });
  });

  // -----------------------------------------------------------------------
  // Tracing — addEvent
  // -----------------------------------------------------------------------

  it('addEvent() adds event to active span', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    adapter.createSpan('test');
    adapter.addEvent('cache.hit', { key: 'user-123' });

    expect(mockSpanAddEvent).toHaveBeenCalledWith('cache.hit', {
      key: 'user-123',
    });
  });

  // -----------------------------------------------------------------------
  // Tracing — getActiveSpan
  // -----------------------------------------------------------------------

  it('getActiveSpan() returns the last created span', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    const span = adapter.createSpan('test');
    const active = adapter.getActiveSpan();

    expect(active).toBe(span);
  });

  it('getActiveSpan() returns undefined when no span created', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    expect(adapter.getActiveSpan()).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Metrics — createCounter
  // -----------------------------------------------------------------------

  it('createCounter() creates a counter via OTel meter', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    const counter = adapter.createCounter('http.requests.total');

    expect(mockMeterCreateCounter).toHaveBeenCalledWith(
      'http.requests.total',
      undefined,
    );

    counter.add(1);
    expect(mockCounterAdd).toHaveBeenCalledWith(1);
  });

  // -----------------------------------------------------------------------
  // Metrics — createHistogram
  // -----------------------------------------------------------------------

  it('createHistogram() creates a histogram via OTel meter', async () => {
    adapter = new OTelAdapter({ serviceName: 'test-service' });
    await adapter.start();

    const histogram = adapter.createHistogram('http.request.duration');

    expect(mockMeterCreateHistogram).toHaveBeenCalledWith(
      'http.request.duration',
      undefined,
    );

    histogram.record(150);
    expect(mockHistogramRecord).toHaveBeenCalledWith(150);
  });
});
