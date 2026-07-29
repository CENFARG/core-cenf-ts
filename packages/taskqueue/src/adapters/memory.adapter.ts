/**
 * In-memory task queue adapter.
 *
 * Implements the TaskQueueManager port with zero external dependencies.
 * Uses per-queue FIFO arrays with a Map-based store.
 *
 * @module managers/taskqueue/adapters/memory.adapter
 */

import { randomUUID } from 'node:crypto';
import type { TaskQueueManager } from '../ports.js';
import type { Task, TaskStatus } from '../types.js';

// ---------------------------------------------------------------------------
// Internal task record
// ---------------------------------------------------------------------------

interface InternalTask {
  id: string;
  queue: string;
  payload: unknown;
  status: TaskStatus;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// InMemoryTaskQueueAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory task queue using per-queues FIFO arrays.
 *
 * Each named queue is an independent FIFO list. Tasks transition
 * through `pending → processing → completed` via enqueue/dequeue/ack
 * calls. Completed tasks stay in memory for idempotent ack handling.
 *
 * Use this adapter:
 * - In unit tests where a real queue backend is not available
 * - For single-process task orchestration
 * - As a fallback when the distributed queue is unavailable
 */
export class InMemoryTaskQueueAdapter implements TaskQueueManager {
  private queues = new Map<string, InternalTask[]>();

  // -----------------------------------------------------------------------
  // TaskQueueManager — enqueue
  // -----------------------------------------------------------------------

  async enqueue(queue: string, payload: unknown): Promise<Task> {
    const task: InternalTask = {
      id: randomUUID(),
      queue,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };

    const list = this.getOrCreateQueue(queue);
    list.push(task);

    return this.toPublicTask(task);
  }

  // -----------------------------------------------------------------------
  // TaskQueueManager — dequeue
  // -----------------------------------------------------------------------

  async dequeue(queue: string): Promise<Task | null> {
    const list = this.queues.get(queue);
    if (!list) return null;

    const idx = list.findIndex((t) => t.status === 'pending');
    if (idx === -1) return null;

    const task = list[idx]!;
    task.status = 'processing';
    return this.toPublicTask(task);
  }

  // -----------------------------------------------------------------------
  // TaskQueueManager — ack
  // -----------------------------------------------------------------------

  async ack(taskId: string): Promise<void> {
    for (const list of this.queues.values()) {
      const task = list.find((t) => t.id === taskId);
      if (task) {
        task.status = 'completed';
        return;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Retrieve or lazily create a queue list.
   */
  private getOrCreateQueue(queue: string): InternalTask[] {
    let list = this.queues.get(queue);
    if (!list) {
      list = [];
      this.queues.set(queue, list);
    }
    return list;
  }

  /**
   * Return a plain Task object without exposing internal references.
   */
  private toPublicTask(task: InternalTask): Task {
    return {
      id: task.id,
      queue: task.queue,
      payload: task.payload,
      status: task.status,
      createdAt: task.createdAt,
    };
  }
}
