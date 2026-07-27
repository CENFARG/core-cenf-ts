/**
 * NATS event bus adapter — distributed pub/sub via @nats-io/nats-core.
 *
 * Implements the EventBusManager port using NATS for real distributed
 * messaging with pub/sub, request/reply, and JetStream persistence.
 *
 * @module managers/event-bus/adapters/nats.adapter
 */

import {
  connect,
  JSONCodec,
  type NatsConnection,
  type ConnectionOptions,
} from '@nats-io/nats-core';
import type { EventBusManager } from '../ports.js';
import type { EventEnvelope, EventHandler } from '../types.js';
import type { HealthStatus } from '@cenf/core';
import {
  EventBusConnectionError,
  EventBusPublishError,
} from '@cenf/core';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// NatsEventBusOptions
// ---------------------------------------------------------------------------

/**
 * Options for configuring the NatsEventBusAdapter.
 */
export interface NatsEventBusOptions {
  /**
   * NATS server URL(s).
   *
   * @default 'localhost:4222'
   */
  servers?: string;

  /**
   * Connection timeout in milliseconds.
   *
   * @default 5000
   */
  connectionTimeoutMs?: number;

  /**
   * Optional user credentials for authentication.
   */
  user?: string;

  /**
   * Optional password for authentication.
   */
  pass?: string;

  /**
   * Optional token for authentication.
   */
  token?: string;
}

// ---------------------------------------------------------------------------
// JetStream stream config
// ---------------------------------------------------------------------------

/**
 * JetStream stream configuration for createStream().
 */
export interface JetStreamStreamConfig {
  /** Stream name. */
  name: string;
  /** Subject patterns the stream captures. */
  subjects: string[];
  /** Maximum messages to retain (-1 = unlimited). */
  maxMessages?: number;
  /** Maximum bytes to retain (-1 = unlimited). */
  maxBytes?: number;
  /** Storage type: 'file' or 'memory'. */
  storage?: 'file' | 'memory';
  /** Number of replicas. */
  replicas?: number;
}

// ---------------------------------------------------------------------------
// NatsEventBusAdapter
// ---------------------------------------------------------------------------

/**
 * NATS-backed event bus adapter for distributed pub/sub.
 *
 * Features:
 * - Topic-based publish/subscribe via NATS core
 * - Request/reply pattern with timeout support
 * - JetStream for persistent messaging (create/delete streams, persistent pub/sub)
 * - JSON codec for message serialization
 * - Graceful connection management with health reporting
 *
 * Use this adapter:
 * - In production environments with a NATS server
 * - For distributed event-driven architectures
 * - When message persistence via JetStream is required
 */
export class NatsEventBusAdapter implements EventBusManager {
  private nc: NatsConnection | null = null;
  private readonly jc = JSONCodec();
  private readonly servers: string;
  private readonly connectionTimeoutMs: number;
  private readonly authOptions: Partial<ConnectionOptions>;
  private connected = false;

  /** Active subscriptions tracked for unsubscribe. */
  private readonly subscriptions = new Map<
    string,
    { topic: string; unsubscribe: () => void }
  >();

  constructor(options: NatsEventBusOptions = {}) {
    this.servers = options.servers ?? 'localhost:4222';
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 5000;
    this.authOptions = {};
    if (options.user && options.pass) {
      this.authOptions.user = options.user;
      this.authOptions.pass = options.pass;
    }
    if (options.token) {
      this.authOptions.token = options.token;
    }
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      this.nc = await connect({
        servers: this.servers,
        ...this.authOptions,
      } as ConnectionOptions);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new EventBusConnectionError(
        `Failed to connect to NATS at '${this.servers}'`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async stop(): Promise<void> {
    // Unsubscribe all active subscriptions
    for (const [, sub] of this.subscriptions) {
      try {
        sub.unsubscribe();
      } catch {
        // Best-effort cleanup
      }
    }
    this.subscriptions.clear();

    if (this.nc) {
      try {
        await this.nc.close();
      } catch {
        // Best-effort cleanup
      }
      this.nc = null;
    }
    this.connected = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: this.connected ? 'healthy' : 'degraded',
      details: {
        adapter: 'nats',
        connected: this.connected,
        servers: this.servers,
        subscriptions: this.subscriptions.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // EventBusManager — publish
  // -----------------------------------------------------------------------

  async publish<T = unknown>(topic: string, data: T): Promise<void> {
    if (!this.nc) {
      throw new EventBusPublishError(
        'NATS connection not established — call start() first',
      );
    }

    try {
      const envelope: EventEnvelope = {
        id: randomUUID(),
        topic,
        data,
        timestamp: Date.now(),
      };
      this.nc.publish(topic, this.jc.encode(envelope));
    } catch (error) {
      throw new EventBusPublishError(
        `Failed to publish to topic '${topic}'`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // EventBusManager — subscribe
  // -----------------------------------------------------------------------

  async subscribe<T = unknown>(
    topic: string,
    handler: EventHandler<T>,
  ): Promise<string> {
    if (!this.nc) {
      throw new EventBusConnectionError(
        'NATS connection not established — call start() first',
      );
    }

    const subId = randomUUID();

    const sub = await this.nc.subscribe(topic, {
      callback: (_err: unknown, msg: { data: Uint8Array }) => {
        try {
          const envelope = this.jc.decode(msg.data) as EventEnvelope;
          handler(envelope.data as T, envelope);
        } catch {
          // Swallow handler errors — fire-and-forget
        }
      },
    });

    this.subscriptions.set(subId, {
      topic,
      unsubscribe: () => sub.unsubscribe(),
    });

    return subId;
  }

  // -----------------------------------------------------------------------
  // EventBusManager — unsubscribe
  // -----------------------------------------------------------------------

  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      try {
        sub.unsubscribe();
      } catch {
        // Idempotent
      }
      this.subscriptions.delete(subscriptionId);
    }
  }

  // -----------------------------------------------------------------------
  // EventBusManager — request
  // -----------------------------------------------------------------------

  async request<T = unknown, R = unknown>(
    topic: string,
    data: T,
    timeoutMs = 5000,
  ): Promise<R> {
    if (!this.nc) {
      throw new EventBusConnectionError(
        'NATS connection not established — call start() first',
      );
    }

    try {
      const msg = await this.nc.request(topic, this.jc.encode(data), {
        timeout: timeoutMs,
      });
      return this.jc.decode(msg.data) as R;
    } catch (error) {
      throw new EventBusConnectionError(
        `Request to '${topic}' failed`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // EventBusManager — reply
  // -----------------------------------------------------------------------

  async reply<T = unknown, R = unknown>(
    topic: string,
    handler: (data: T) => Promise<R>,
  ): Promise<void> {
    if (!this.nc) {
      throw new EventBusConnectionError(
        'NATS connection not established — call start() first',
      );
    }

    const sub = await this.nc.subscribe(topic, {
      callback: async (_err: unknown, msg: { data: Uint8Array; respond?: (data: Uint8Array) => boolean }) => {
        try {
          const requestData = this.jc.decode(msg.data) as T;
          const replyData = await handler(requestData);
          if (msg.respond) {
            msg.respond(this.jc.encode(replyData));
          }
        } catch {
          // Swallow handler errors
        }
      },
    });

    const subId = `reply:${topic}`;
    this.subscriptions.set(subId, {
      topic,
      unsubscribe: () => sub.unsubscribe(),
    });
  }

  // -----------------------------------------------------------------------
  // JetStream — stream management
  // -----------------------------------------------------------------------

  /**
   * Create a JetStream stream.
   *
   * @param name - Stream name.
   * @param subjects - Subject patterns the stream captures.
   * @param config - Optional additional stream configuration.
   */
  async createStream(
    name: string,
    subjects: string[],
    config?: Omit<JetStreamStreamConfig, 'name' | 'subjects'>,
  ): Promise<void> {
    if (!this.nc) {
      throw new EventBusConnectionError(
        'NATS connection not established — call start() first',
      );
    }

    const jsm = await this.nc.jetstreamManager();
    await jsm.streams.add({
      name,
      subjects,
      max_msgs: config?.maxMessages ?? -1,
      max_bytes: config?.maxBytes ?? -1,
      storage: config?.storage === 'memory' ? 1 : 0,
      num_replicas: config?.replicas ?? 1,
    });
  }

  /**
   * Delete a JetStream stream.
   *
   * @param name - Stream name to delete.
   */
  async deleteStream(name: string): Promise<void> {
    if (!this.nc) {
      throw new EventBusConnectionError(
        'NATS connection not established — call start() first',
      );
    }

    const jsm = await this.nc.jetstreamManager();
    await jsm.streams.delete(name);
  }

  // -----------------------------------------------------------------------
  // JetStream — persistent publish
  // -----------------------------------------------------------------------

  /**
   * Publish a message via JetStream for persistent delivery.
   *
   * @param subject - The subject to publish to.
   * @param data - The message payload.
   */
  async persistentPublish<T = unknown>(
    subject: string,
    data: T,
  ): Promise<void> {
    if (!this.nc) {
      throw new EventBusPublishError(
        'NATS connection not established — call start() first',
      );
    }

    const js = this.nc.jetstream();
    await js.publish(subject, this.jc.encode(data));
  }
}
