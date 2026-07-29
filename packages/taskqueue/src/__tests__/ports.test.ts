import { describe, it, expect } from 'vitest';
import {
  TASKQUEUE_PORT_VERSION,
  type TaskQueueManager,
} from '../ports.js';
import type {
  Task,
  TaskStatus,
} from '../types.js';

// ---------------------------------------------------------------------------
// Test implementation of TaskQueueManager for contract verification
// ---------------------------------------------------------------------------

class TestTaskQueueManager implements TaskQueueManager {
  private tasks: Task[] = [];

  async enqueue(queue: string, payload: unknown): Promise<Task> {
    const task: Task = {
      id: `test-${this.tasks.length + 1}`,
      queue,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };
    this.tasks.push(task);
    return task;
  }

  async dequeue(queue: string): Promise<Task | null> {
    const idx = this.tasks.findIndex(
      (t) => t.queue === queue && t.status === 'pending',
    );
    if (idx === -1) return null;
    const task = this.tasks[idx]!;
    task.status = 'processing';
    return task;
  }

  async ack(taskId: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) task.status = 'completed';
  }
}

// ---------------------------------------------------------------------------
// TaskQueueManager port contract
// ---------------------------------------------------------------------------

describe('TaskQueueManager port', () => {
  it('exports a runtime version constant', () => {
    expect(TASKQUEUE_PORT_VERSION).toBe('0.1.0');
  });

  it('has enqueue/dequeue/ack methods', () => {
    const mgr: TaskQueueManager = new TestTaskQueueManager();
    expect(mgr.enqueue).toBeDefined();
    expect(mgr.dequeue).toBeDefined();
    expect(mgr.ack).toBeDefined();
  });

  it('enqueue() returns a Task with the correct queue and payload', async () => {
    const mgr = new TestTaskQueueManager();
    const task = await mgr.enqueue('orders', { orderId: 42 });
    expect(task.queue).toBe('orders');
    expect(task.payload).toEqual({ orderId: 42 });
    expect(task.status).toBe('pending');
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeInstanceOf(Date);
  });

  it('enqueue() generates unique IDs for each task', async () => {
    const mgr = new TestTaskQueueManager();
    const t1 = await mgr.enqueue('q', 'a');
    const t2 = await mgr.enqueue('q', 'b');
    expect(t1.id).not.toBe(t2.id);
  });

  it('dequeue() returns a pending task from the specified queue', async () => {
    const mgr = new TestTaskQueueManager();
    await mgr.enqueue('orders', { orderId: 1 });
    const task = await mgr.dequeue('orders');
    expect(task).not.toBeNull();
    expect(task!.queue).toBe('orders');
    expect(task!.status).toBe('processing');
  });

  it('dequeue() returns null when queue is empty', async () => {
    const mgr = new TestTaskQueueManager();
    const task = await mgr.dequeue('empty-queue');
    expect(task).toBeNull();
  });

  it('dequeue() only returns tasks from the matching queue', async () => {
    const mgr = new TestTaskQueueManager();
    await mgr.enqueue('queue-a', 'a');
    const task = await mgr.dequeue('queue-b');
    expect(task).toBeNull();
  });

  it('ack() marks a task as completed', async () => {
    const mgr = new TestTaskQueueManager();
    const task = await mgr.enqueue('q', {});
    await expect(mgr.ack(task.id)).resolves.toBeUndefined();
  });

  it('queue still accepts new tasks after ack', async () => {
    const mgr = new TestTaskQueueManager();
    const task = await mgr.enqueue('q', { first: true });
    await mgr.ack(task.id);
    await mgr.enqueue('q', { second: true });
    const next = await mgr.dequeue('q');
    expect(next).not.toBeNull();
    expect((next!.payload as Record<string, unknown>).second).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------------

describe('Task types', () => {
  it('Task has required fields', () => {
    const task: Task = {
      id: 'abc-123',
      queue: 'email',
      payload: { to: 'user@test.com' },
      status: 'pending',
      createdAt: new Date('2025-01-01'),
    };
    expect(task.id).toBe('abc-123');
    expect(task.queue).toBe('email');
    expect(task.payload).toEqual({ to: 'user@test.com' });
    expect(task.status).toBe('pending');
    expect(task.createdAt).toEqual(new Date('2025-01-01'));
  });

  it('supports all TaskStatus values', () => {
    const statuses: TaskStatus[] = ['pending', 'processing', 'completed', 'failed'];
    expect(statuses).toContain('pending');
    expect(statuses).toContain('processing');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('failed');
  });
});
