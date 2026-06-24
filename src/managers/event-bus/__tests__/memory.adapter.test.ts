import { describe, it, expect, vi } from 'vitest';
import { MemoryEventBusAdapter } from '../adapters/memory.adapter.js';
import {
  EventBusConnectionError,
} from '../../../shared/errors.js';

describe('MemoryEventBusAdapter', () => {
  let adapter: MemoryEventBusAdapter;

  beforeEach(() => {
    adapter = new MemoryEventBusAdapter();
  });

  describe('AsyncLifecycle', () => {
    it('start() resolves successfully', async () => {
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves successfully', async () => {
      await adapter.start();
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy status', async () => {
      await adapter.start();
      const health = await adapter.health();
      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
    });
  });

  describe('publish / subscribe', () => {
    it('delivers published message to subscriber', async () => {
      const handler = vi.fn();
      await adapter.subscribe('test.topic', handler);
      await adapter.publish('test.topic', { message: 'hello' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { message: 'hello' },
        expect.objectContaining({
          topic: 'test.topic',
          data: { message: 'hello' },
        }),
      );
    });

    it('delivers to multiple subscribers on same topic', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      await adapter.subscribe('test.topic', handler1);
      await adapter.subscribe('test.topic', handler2);
      await adapter.publish('test.topic', { message: 'hello' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('does not deliver to subscribers on other topics', async () => {
      const handler = vi.fn();
      await adapter.subscribe('topic.a', handler);
      await adapter.publish('topic.b', { message: 'hello' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('returns unique subscription IDs', async () => {
      const id1 = await adapter.subscribe('test.topic', vi.fn());
      const id2 = await adapter.subscribe('test.topic', vi.fn());

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('publish is fire-and-forget — handler error does not propagate', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('boom'));
      const normalHandler = vi.fn();

      await adapter.subscribe('test.topic', failingHandler);
      await adapter.subscribe('test.topic', normalHandler);
      await adapter.publish('test.topic', { message: 'hello' });

      // Handler error is caught internally; publish resolves
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('stops delivery after unsubscribe', async () => {
      const handler = vi.fn();
      const id = await adapter.subscribe('test.topic', handler);
      await adapter.unsubscribe(id);
      await adapter.publish('test.topic', { message: 'hello' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('is idempotent — unsubscribing unknown ID does not throw', async () => {
      await expect(
        adapter.unsubscribe('non-existent-id'),
      ).resolves.toBeUndefined();
    });

    it('only removes the specified subscription', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const id1 = await adapter.subscribe('test.topic', handler1);
      await adapter.subscribe('test.topic', handler2);

      await adapter.unsubscribe(id1);
      await adapter.publish('test.topic', { message: 'hello' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('request / reply', () => {
    it('request waits for reply handler response', async () => {
      await adapter.reply<string, string>(
        'greet.echo',
        async (data) => `Reply: ${data}`,
      );

      const result = await adapter.request<string, string>(
        'greet.echo',
        'hello',
      );

      expect(result).toBe('Reply: hello');
    });

    it('request throws when no reply handler registered', async () => {
      await expect(
        adapter.request('unknown.topic', 'data'),
      ).rejects.toThrow(EventBusConnectionError);
    });

    it('reply replaces previous handler on same topic', async () => {
      await adapter.reply<string, string>('echo', async () => 'first');
      await adapter.reply<string, string>('echo', async () => 'second');

      const result = await adapter.request<string, string>('echo', 'test');
      expect(result).toBe('second');
    });
  });

  describe('stop() cleanup', () => {
    it('clears all subscribers on stop', async () => {
      const handler = vi.fn();
      await adapter.start();
      await adapter.subscribe('test.topic', handler);
      await adapter.stop();

      // Re-subscribe after stop (fresh state)
      const newHandler = vi.fn();
      await adapter.subscribe('test.topic', newHandler);
      await adapter.publish('test.topic', { message: 'hello' });

      expect(handler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledTimes(1);
    });

    it('clears all reply handlers on stop', async () => {
      await adapter.start();
      await adapter.reply('echo', async () => 'response');
      await adapter.stop();

      await expect(
        adapter.request('echo', 'data'),
      ).rejects.toThrow(EventBusConnectionError);
    });
  });
});
