/**
 * EventBusManager-specific types.
 *
 * Types for event envelopes, handlers, and subscriptions.
 *
 * @module managers/event-bus/types
 */

// ---------------------------------------------------------------------------
// EventEnvelope — CloudEvents-compatible message wrapper
// ---------------------------------------------------------------------------

/**
 * Message envelope wrapping published events.
 *
 * Optional CloudEvents-compatible fields enable
 * interoperability with external event systems.
 */
export interface EventEnvelope {
  /** Unique identifier for this event. */
  id: string;

  /** The topic this event was published to. */
  topic: string;

  /** The event payload. */
  data: unknown;

  /** Unix timestamp (ms) when the event was published. */
  timestamp: number;

  /** Optional correlation ID for tracing across services. */
  correlationId?: string;

  /** Optional event source identifier. */
  source?: string;

  /** Optional event type (CloudEvents specversion). */
  type?: string;
}

// ---------------------------------------------------------------------------
// EventHandler — subscriber callback signature
// ---------------------------------------------------------------------------

/**
 * Async handler for subscribed events.
 *
 * Receives the deserialized data payload and the full envelope.
 * Errors thrown by the handler should be caught by the event bus
 * and must not affect other subscribers.
 */
export type EventHandler<T = unknown> = (
  data: T,
  envelope: EventEnvelope,
) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Subscription — subscription metadata
// ---------------------------------------------------------------------------

/**
 * Metadata for an active subscription.
 */
export interface Subscription {
  /** Unique subscription ID. */
  id: string;

  /** The topic this subscription is for. */
  topic: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const EVENT_BUS_TYPES_VERSION = '0.1.0';
