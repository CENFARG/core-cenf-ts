import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTaskQueueAdapter } from '../adapters/memory.adapter.js';
import type { TaskQueueManager } from '../ports.js';

// ---------------------------------------------------------------------------
// InMemoryTaskQueueAdapter
// ---------------------------------------------------------------------------

describe('InMemoryTaskQueueAdapter', () => {
  let queue: TaskQueueManager;

  beforeEach(() => {
    queue = new InMemoryTaskQueueAdapter();
  });

  // -----------------------------------------------------------------------
  // Enqueue
  // -----------------------------------------------------------------------

  describe('enqueue', () => {
    it('creates a task with the given queue and payload', async () => {
      const task = await queue.enqueue('orders', { orderId: 42 });
      expect(task.queue).toBe('orders');
      expect(task.payload).toEqual({ orderId: 42 });
      expect(task.status).toBe('pending');
    });

    it('generates a unique string id', async () => {
      const t1 = await queue.enqueue('q', 'a');
      const t2 = await queue.enqueue('q', 'b');
      expect(typeof t1.id).toBe('string');
      expect(t1.id.length).toBeGreaterThan(0);
      expect(t1.id).not.toBe(t2.id);
    });

    it('sets createdAt to current date', async () => {
      const before = Date.now();
      const task = await queue.enqueue('q', {});
      const after = Date.now();
      const created = task.createdAt.getTime();
      expect(created).toBeGreaterThanOrEqual(before);
      expect(created).toBeLessThanOrEqual(after);
    });
  });

  // -----------------------------------------------------------------------
  // Dequeue
  // -----------------------------------------------------------------------

  describe('dequeue', () => {
    it('returns the first pending task from the queue', async () => {
      await queue.enqueue('q', 'first');
      await queue.enqueue('q', 'second');
      const task = await queue.dequeue('q');
      expect(task).not.toBeNull();
      expect(task!.payload).toBe('first');
    });

    it('returns null when no tasks exist in the queue', async () => {
      const task = await queue.dequeue('nonexistent');
      expect(task).toBeNull();
    });

    it('only dequeues from the matching queue', async () => {
      await queue.enqueue('queue-a', 'a');
      const fromB = await queue.dequeue('queue-b');
      expect(fromB).toBeNull();
      const fromA = await queue.dequeue('queue-a');
      expect(fromA).not.toBeNull();
      expect(fromA!.payload).toBe('a');
    });

    it('does not return already completed tasks', async () => {
      const task = await queue.enqueue('q', 'done');
      await queue.ack(task.id);
      const result = await queue.dequeue('q');
      expect(result).toBeNull();
    });

    it('marks the returned task as processing', async () => {
      await queue.enqueue('q', 'proc');
      const task = await queue.dequeue('q');
      expect(task!.status).toBe('processing');
    });
  });

  // -----------------------------------------------------------------------
  // Ack
  // -----------------------------------------------------------------------

  describe('ack', () => {
    it('marks a task as completed', async () => {
      const task = await queue.enqueue('q', {});
      await queue.ack(task.id);
      // Dequeue again should not return it
      const result = await queue.dequeue('q');
      expect(result).toBeNull();
    });

    it('does not throw when acking a nonexistent task', async () => {
      await expect(queue.ack('nonexistent-id')).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Queue isolation
  // -----------------------------------------------------------------------

  describe('queue isolation', () => {
    it('multiple queues operate independently', async () => {
      await queue.enqueue('emails', { to: 'a@x.com' });
      await queue.enqueue('notifications', { msg: 'hi' });

      const emailTask = await queue.dequeue('emails');
      expect(emailTask).not.toBeNull();
      expect((emailTask!.payload as Record<string, unknown>).to).toBe('a@x.com');

      const notifTask = await queue.dequeue('notifications');
      expect(notifTask).not.toBeNull();
      expect((notifTask!.payload as Record<string, unknown>).msg).toBe('hi');
    });
  });

  // -----------------------------------------------------------------------
  // FIFO order
  // -----------------------------------------------------------------------

  describe('FIFO order', () => {
    it('tasks are dequeued in FIFO order per queue', async () => {
      await queue.enqueue('q', 'first');
      await queue.enqueue('q', 'second');
      await queue.enqueue('q', 'third');

      expect((await queue.dequeue('q'))!.payload).toBe('first');
      expect((await queue.dequeue('q'))!.payload).toBe('second');
      expect((await queue.dequeue('q'))!.payload).toBe('third');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('works with various payload types', async () => {
      const t1 = await queue.enqueue('q', null);
      expect(t1.payload).toBeNull();

      const t2 = await queue.enqueue('q', 42);
      expect(t2.payload).toBe(42);

      const t3 = await queue.enqueue('q', 'string');
      expect(t3.payload).toBe('string');
    });

    it('handles empty payloads gracefully', async () => {
      const task = await queue.enqueue('q', {});
      expect(task.payload).toEqual({});
    });
  });
});
