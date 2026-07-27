/**
 * ObservabilityManager port interface — distributed tracing and telemetry.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/observability/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type {
  Span,
  SpanAttributeValue,
  SpanOptions,
} from './types.js';

/**
 * Observability manager port for distributed tracing.
 *
 * Provides span creation, attribute setting, exception recording,
 * and custom event attachment. Extends `AsyncLifecycle` for uniform
 * orchestration and graceful shutdown of telemetry providers.
 */
export interface ObservabilityManager extends AsyncLifecycle {
  /**
   * Create a new span with the given name.
   *
   * If a parent span exists in the current context, the new span
   * becomes a child of that parent. If OTel is disabled, returns
   * a no-op span (graceful degradation).
   *
   * @param name - The span name (e.g., "http.request", "db.query").
   * @param options - Optional span configuration (attributes, kind).
   * @returns A Span instance for the operation.
   */
  createSpan(name: string, options?: SpanOptions): Span;

  /**
   * Get the currently active span from the execution context.
   *
   * @returns The active span, or `undefined` if no span is active.
   */
  getActiveSpan(): Span | undefined;

  /**
   * Set an attribute on the active span.
   *
   * No-op if no span is currently active.
   *
   * @param key - The attribute key.
   * @param value - The attribute value (string, number, or boolean).
   */
  setAttribute(key: string, value: SpanAttributeValue): void;

  /**
   * Record an exception on the active span.
   *
   * Sets the span status to ERROR and attaches the exception details.
   * No-op if no span is currently active.
   *
   * @param error - The error or exception to record.
   */
  recordException(error: unknown): void;

  /**
   * Add a named event to the active span.
   *
   * Useful for recording significant moments within a span's lifetime
   * (e.g., cache hit/miss, retry attempt, key decision).
   * No-op if no span is currently active.
   *
   * @param name - The event name.
   * @param attributes - Optional key-value attributes for the event.
   */
  addEvent(
    name: string,
    attributes?: Record<string, SpanAttributeValue>,
  ): void;
}

/** Runtime version constant — ensures module existence for TDD. */
export const OBSERVABILITY_PORT_VERSION = '0.1.0';
