/**
 * @cenf/event-bus — pub/sub messaging.
 *
 * @module @cenf/event-bus
 */

// Port
export { type EventBusManager, EVENT_BUS_PORT_VERSION } from './ports.js';

// Types
export type { EventEnvelope, EventHandler, Subscription } from './types.js';
export { EVENT_BUS_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryEventBusAdapter } from './adapters/memory.adapter.js';
export { NatsEventBusAdapter } from './adapters/nats.adapter.js';
export type { NatsEventBusOptions, JetStreamStreamConfig } from './adapters/nats.adapter.js';
