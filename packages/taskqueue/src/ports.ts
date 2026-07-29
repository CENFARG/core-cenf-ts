/**
 * TaskQueueManager port interface — enqueue, dequeue, ack.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/taskqueue/ports
 */

import type { Task } from './types.js';

/**
 * Task queue manager port for background task processing.
 *
 * Provides a FIFO queue abstraction for enqueuing work items,
 * dequeuing them for processing, and acknowledging completion.
 * Queues are independent — each named queue operates in isolation.
 */
export interface TaskQueueManager {
  /**
   * Enqueue a task into a named queue.
   *
   * Creates a new task with `pending` status, assigns a unique ID,
   * and appends it to the end of the specified queue.
   *
   * @param queue   - The name of the target queue.
   * @param payload - The opaque data to process.
   * @returns The created task.
   */
  enqueue(queue: string, payload: unknown): Promise<Task>;

  /**
   * Dequeue the next pending task from a named queue.
   *
   * Returns the oldest `pending` task and transitions it to
   * `processing`. Returns `null` if no pending tasks exist
   * in the queue.
   *
   * @param queue - The name of the queue to pull from.
   * @returns The next task, or `null` if the queue is empty.
   */
  dequeue(queue: string): Promise<Task | null>;

  /**
   * Acknowledge a task as completed.
   *
   * Marks the identified task as `completed`. Idempotent — does
   * not throw if the task does not exist or is already completed.
   *
   * @param taskId - The unique ID of the task to acknowledge.
   */
  ack(taskId: string): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const TASKQUEUE_PORT_VERSION = '0.1.0';
