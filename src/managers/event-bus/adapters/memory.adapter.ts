/**
 * In-memory event bus adapter — pub/sub for testing.
 *
 * Implements the EventBusManager port with a Map-based
 * subscriber registry. Supports topic-based publish/subscribe,
 * request/reply pattern, and CloudEvents-compatible envelopes.
 *
 * @module managers/event-bus/adapters/memory.adapter
 */

import type { EventBusManager } from '../ports.js';
import type { EventEnvelope, EventHandler } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';
import { EventBusConnectionError } from '../../../shared/errors.js';
import { randomUUID } from 'node:crypto';

/**
 * In-memory event bus adapter using Map-based subscriber registry.
 *
 * Features:
 * - Topic-based publish/subscribe with multiple subscribers per topic
 * - Fire-and-forget publish (subscriber errors do not propagate)
 * - Request/reply pattern with single reply handler per topic
 * - CloudEvents-compatible envelope wrapping
 *
 * Use this adapter:
 * - In unit tests where a real message broker is not available
 * - For prototyping event-driven patterns
 * - As a reference implementation for the EventBusManager port
 */
export class MemoryEventBusAdapter implements EventBusManager {
  /**
   * Topic → subscriber map (subscription ID → handler).
   * Each topic can have multiple subscribers.
   */
  private readonly subscribers = new Map<
    string,
    Map<string, EventHandler>
  >();

  /**
   * Topic → reply handler (single handler per topic).
   */
  private readonly replyHandlers = new Map<
    string,
    (data: unknown) => Promise<unknown>
  >();

  /** Whether the adapter has been started. */
  private started = false;

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.subscribers.clear();
    this.replyHandlers.clear();
    this.started = false;
  }

  async health(): Promise<HealthStatus> {
    let subscriberCount = 0;
    for (const subs of this.subscribers.values()) {
      subscriberCount += subs.size;
    }

    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        started: this.started,
        topics: this.subscribers.size,
        subscribers: subscriberCount,
        replyHandlers: this.replyHandlers.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // EventBusManager — publish
  // -----------------------------------------------------------------------

  async publish<T = unknown>(topic: string, data: T): Promise<void> {
    const subs = this.subscribers.get(topic);
    if (!subs || subs.size === 0) return;

    const envelope: EventEnvelope = {
      id: randomUUID(),
      topic,
      data,
      timestamp: Date.now(),
    };

    const promises: Promise<void>[] = [];
    for (const handler of subs.values()) {
      promises.push(
        Promise.resolve(handler(data, envelope)).catch(() => {
          // Fire-and-forget: subscriber errors do not propagate to publisher
        }),
      );
    }

    await Promise.all(promises);
  }

  // -----------------------------------------------------------------------
  // EventBusManager — subscribe
  // -----------------------------------------------------------------------

  async subscribe<T = unknown>(
    topic: string,
    handler: EventHandler<T>,
  ): Promise<string> {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Map());
    }

    const id = randomUUID();
    this.subscribers.get(topic)!.set(id, handler as EventHandler);
    return id;
  }

  // -----------------------------------------------------------------------
  // EventBusManager — unsubscribe
  // -----------------------------------------------------------------------

  async unsubscribe(subscriptionId: string): Promise<void> {
    for (const [, subs] of this.subscribers) {
      if (subs.has(subscriptionId)) {
        subs.delete(subscriptionId);
        return;
      }
    }
    // Idempotent: no error if subscription not found
  }

  // -----------------------------------------------------------------------
  // EventBusManager — request
  // -----------------------------------------------------------------------

  async request<T = unknown, R = unknown>(
    topic: string,
    data: T,
    timeoutMs = 5000,
  ): Promise<R> {
    const handler = this.replyHandlers.get(topic);
    if (!handler) {
      throw new EventBusConnectionError(
        `No reply handler registered for topic: ${topic}`,
      );
    }

    const result = await Promise.race([
      handler(data),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Request timeout after ${timeoutMs}ms for topic: ${topic}`)),
          timeoutMs,
        );
        // Prevent the timer from keeping the process alive
        if (typeof timer === 'object' && 'unref' in timer) {
          timer.unref();
        }
      }),
    ]);
    return result as R;
  }

  // -----------------------------------------------------------------------
  // EventBusManager — reply
  // -----------------------------------------------------------------------

  async reply<T = unknown, R = unknown>(
    topic: string,
    handler: (data: T) => Promise<R>,
  ): Promise<void> {
    this.replyHandlers.set(
      topic,
      handler as (data: unknown) => Promise<unknown>,
    );
  }
}
