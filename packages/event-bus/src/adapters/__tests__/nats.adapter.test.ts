import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NatsEventBusAdapter } from '../nats.adapter.js';
import { EventBusConnectionError, EventBusPublishError } from '@cenf/core';
import type { EventBusManager } from '../../ports.js';

// ---------------------------------------------------------------------------
// Mock @nats-io/nats-core
// ---------------------------------------------------------------------------

const {
  mockPublish,
  mockSubscribe,
  mockRequest,
  mockJetStreamClient,
  mockJetStreamManager,
  mockConsumer,
  mockNatsConnection,
  mockConnect,
} = vi.hoisted(() => {
  const publish = vi.fn().mockResolvedValue(undefined);
  const subscribe = vi.fn().mockResolvedValue({
    [Symbol.asyncIterator]() {
      return {
        next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };
    },
  });
  const request = vi.fn().mockResolvedValue({
    json: () => ({ result: 'reply' }),
    string: () => '{"result":"reply"}',
    data: new TextEncoder().encode('{"result":"reply"}'),
  });

  const mockConsumerInstance = {
    fetch: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]() {
        return {
          next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        };
      },
    }),
  };

  const mockJsManager = {
    streams: {
      add: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(true),
    },
    consumers: {
      add: vi.fn().mockResolvedValue(mockConsumerInstance),
    },
  };

  const mockJsClient = {
    publish: vi.fn().mockResolvedValue({ seq: 1 }),
  };

  const connection = {
    publish,
    subscribe,
    request,
    jetstream: vi.fn().mockReturnValue(mockJsClient),
    jetstreamManager: vi.fn().mockResolvedValue(mockJsManager),
    close: vi.fn().mockResolvedValue(undefined),
    closed: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]() {
        return {
          next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        };
      },
    }),
  };

  const connect = vi.fn().mockResolvedValue(connection);

  return {
    mockPublish: publish,
    mockSubscribe: subscribe,
    mockRequest: request,
    mockJetStreamClient: mockJsClient,
    mockJetStreamManager: mockJsManager,
    mockConsumer: mockConsumerInstance,
    mockNatsConnection: connection,
    mockConnect: connect,
  };
});

vi.mock('@nats-io/nats-core', () => ({
  connect: mockConnect,
  StringCodec: vi.fn().mockReturnValue({
    encode: vi.fn((s: string) => new TextEncoder().encode(s)),
    decode: vi.fn((d: Uint8Array) => new TextDecoder().decode(d)),
  }),
  JSONCodec: vi.fn().mockReturnValue({
    encode: vi.fn((o: unknown) => new TextEncoder().encode(JSON.stringify(o))),
    decode: vi.fn((d: Uint8Array) => JSON.parse(new TextDecoder().decode(d))),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NatsEventBusAdapter', () => {
  let adapter: NatsEventBusAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublish.mockResolvedValue(undefined);
    mockSubscribe.mockResolvedValue({
      [Symbol.asyncIterator]() {
        return {
          next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        };
      },
    });
    mockRequest.mockResolvedValue({
      json: () => ({ result: 'reply' }),
      string: () => '{"result":"reply"}',
      data: new TextEncoder().encode('{"result":"reply"}'),
    });
  });

  afterEach(async () => {
    try {
      await adapter?.stop();
    } catch {
      // Ignore stop failures during cleanup
    }
  });

  // -----------------------------------------------------------------------
  // Connection management
  // -----------------------------------------------------------------------

  it('start() connects to NATS with default server', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ servers: 'localhost:4222' }),
    );
  });

  it('start() connects to NATS with custom server', async () => {
    adapter = new NatsEventBusAdapter({ servers: 'nats://custom:4223' });
    await adapter.start();

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ servers: 'nats://custom:4223' }),
    );
  });

  it('start() throws EventBusConnectionError on connection failure', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));
    adapter = new NatsEventBusAdapter();

    await expect(adapter.start()).rejects.toThrow(EventBusConnectionError);
  });

  it('stop() closes the NATS connection', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();
    await adapter.stop();

    expect(mockNatsConnection.close).toHaveBeenCalled();
  });

  it('health() reports healthy when connected', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details.adapter).toBe('nats');
  });

  it('health() reports degraded when not connected', async () => {
    adapter = new NatsEventBusAdapter();
    const health = await adapter.health();
    expect(health.status).toBe('degraded');
  });

  // -----------------------------------------------------------------------
  // Pub/Sub
  // -----------------------------------------------------------------------

  it('publish() sends JSON-encoded message to topic', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    await adapter.publish('orders.new', { orderId: '123' });

    expect(mockPublish).toHaveBeenCalledWith(
      'orders.new',
      expect.any(Uint8Array),
    );
  });

  it('publish() throws EventBusPublishError when not connected', async () => {
    adapter = new NatsEventBusAdapter();
    // Do NOT call start()

    await expect(
      adapter.publish('test', { data: 'value' }),
    ).rejects.toThrow(EventBusPublishError);
  });

  it('subscribe() creates subscription and returns subscription ID', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    const handler = vi.fn();
    const subId = await adapter.subscribe('orders.new', handler);

    expect(subId).toBeDefined();
    expect(typeof subId).toBe('string');
    expect(mockSubscribe).toHaveBeenCalledWith(
      'orders.new',
      expect.any(Object),
    );
  });

  it('unsubscribe() is idempotent for unknown subscription', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    await expect(
      adapter.unsubscribe('nonexistent-id'),
    ).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Request/Reply
  // -----------------------------------------------------------------------

  it('request() sends request and returns decoded reply', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    const result = await adapter.request<{ q: string }, { result: string }>(
      'search',
      { q: 'test' },
    );

    expect(mockRequest).toHaveBeenCalledWith(
      'search',
      expect.any(Uint8Array),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(result).toEqual({ result: 'reply' });
  });

  it('request() respects custom timeout', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    await adapter.request('test', {}, 10000);

    expect(mockRequest).toHaveBeenCalledWith(
      'test',
      expect.any(Uint8Array),
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it('reply() registers a reply handler via subscribe', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    const handler = vi.fn().mockResolvedValue({ ok: true });
    await adapter.reply('search', handler);

    expect(mockSubscribe).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // JetStream
  // -----------------------------------------------------------------------

  it('createStream() creates a JetStream stream', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    await adapter.createStream('ORDERS', ['orders.>']);

    expect(mockJetStreamManager.streams.add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ORDERS',
        subjects: ['orders.>'],
      }),
    );
  });

  it('deleteStream() deletes a JetStream stream', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    await adapter.deleteStream('ORDERS');

    expect(mockJetStreamManager.streams.delete).toHaveBeenCalledWith('ORDERS');
  });

  it('persistentPublish() publishes via JetStream', async () => {
    adapter = new NatsEventBusAdapter();
    await adapter.start();

    await adapter.persistentPublish('orders.new', { orderId: '456' });

    expect(mockJetStreamClient.publish).toHaveBeenCalledWith(
      'orders.new',
      expect.any(Uint8Array),
    );
  });
});
