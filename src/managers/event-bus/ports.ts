/**
 * EventBusManager port interface — pub/sub messaging.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/event-bus/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { EventHandler } from './types.js';

/**
 * Event bus manager port for publish/subscribe messaging.
 *
 * Supports topic-based pub/sub, request/reply pattern,
 * and optional CloudEvents envelope wrapping.
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface EventBusManager extends AsyncLifecycle {
  /**
   * Publish a message to a topic.
   *
   * All subscribers to the topic receive the message asynchronously.
   * This is fire-and-forget — errors in individual subscriber handlers
   * do not propagate to the publisher.
   *
   * @param topic - The topic to publish to.
   * @param data - The message payload.
   */
  publish<T = unknown>(topic: string, data: T): Promise<void>;

  /**
   * Subscribe to a topic.
   *
   * Returns a subscription ID that can be used to unsubscribe.
   * Multiple subscribers on the same topic each receive the message.
   *
   * @param topic - The topic to subscribe to.
   * @param handler - The async handler for incoming messages.
   * @returns A unique subscription ID.
   */
  subscribe<T = unknown>(
    topic: string,
    handler: EventHandler<T>,
  ): Promise<string>;

  /**
   * Unsubscribe from a topic using a subscription ID.
   *
   * No-op if the subscription does not exist.
   *
   * @param subscriptionId - The subscription ID returned by `subscribe()`.
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Send a request and wait for a reply (request/reply pattern).
   *
   * Publishes to the topic and expects a single reply handler
   * registered via `reply()` on the same topic.
   *
   * @param topic - The request topic.
   * @param data - The request payload.
   * @param timeoutMs - Maximum wait time in milliseconds. Default 5000.
   * @returns The reply payload.
   * @throws EventBusConnectionError if no reply handler is registered.
   */
  request<T = unknown, R = unknown>(
    topic: string,
    data: T,
    timeoutMs?: number,
  ): Promise<R>;

  /**
   * Register a reply handler for a topic (request/reply pattern).
   *
   * Only one reply handler per topic is supported. Registering
   * a second handler on the same topic replaces the previous one.
   *
   * @param topic - The topic to reply to.
   * @param handler - The async handler that processes requests and returns replies.
   */
  reply<T = unknown, R = unknown>(
    topic: string,
    handler: (data: T) => Promise<R>,
  ): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const EVENT_BUS_PORT_VERSION = '0.1.0';
