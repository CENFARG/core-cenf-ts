/**
 * TaskQueueManager-specific types.
 *
 * Defines the Task data structure and TaskStatus discriminator.
 *
 * @module managers/taskqueue/types
 */

// ---------------------------------------------------------------------------
// TaskStatus — lifecycle status for a queued task
// ---------------------------------------------------------------------------

/**
 * Task lifecycle status.
 *
 * - `pending`:    Enqueued but not yet picked up by a worker.
 * - `processing`: Currently being processed by a worker.
 * - `completed`:  Successfully processed and acknowledged.
 * - `failed`:     Processing failed (not automatically retried).
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Task — a unit of work in a queue
// ---------------------------------------------------------------------------

/**
 * A unit of work enqueued for background processing.
 *
 * Each task belongs to exactly one queue identified by `queue`,
 * carries an opaque `payload`, and transitions through a lifecycle
 * tracked by `status`.
 */
export interface Task {
  /** Unique identifier for this task. */
  readonly id: string;

  /** The queue this task belongs to. */
  readonly queue: string;

  /** Opaque payload — the data to be processed. */
  readonly payload: unknown;

  /** Current lifecycle status of the task. */
  status: TaskStatus;

  /** Timestamp when the task was created. */
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const TASKQUEUE_TYPES_VERSION = '0.1.0';
