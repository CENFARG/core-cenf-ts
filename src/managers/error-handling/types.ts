/**
 * ErrorHandlingManager-specific types.
 *
 * Types used by error handling adapters and consumers.
 *
 * @module managers/error-handling/types
 */

/**
 * Standard error categories for classification.
 *
 * Used to route errors to the correct handling strategy
 * (retry, fail-fast, user notification, etc.).
 */
export type ErrorCategory = 'client' | 'server' | 'network' | 'timeout';

/**
 * Classification result for an error.
 *
 * Determines how the error should be handled: whether it
 * can be retried, what message to show the user, etc.
 */
export interface ErrorClassification {
  /** The error category. */
  category: ErrorCategory;

  /** Whether the operation can be retried. */
  retryable: boolean;

  /** Optional user-facing message. */
  userMessage?: string;
}

/**
 * Context information about where and how an error occurred.
 *
 * Passed to `handle()` to enrich the error report with
 * operational context.
 */
export interface ErrorContext {
  /** Source component or module name. */
  source?: string;

  /** The operation that was being performed. */
  operation?: string;

  /** Number of retry attempts (used by wrap). */
  retries?: number;

  /** Fallback function to call on failure. */
  fallback?: () => unknown;

  /** Timeout in milliseconds for the operation. */
  timeoutMs?: number;
}

/**
 * Structured error report safe for logging and API responses.
 *
 * Produced by `handle()` — never contains raw stack traces
 * or sensitive implementation details.
 */
export interface ErrorReport {
  /** Stable error code for programmatic handling. */
  code: string;

  /** Sanitized error message. */
  message: string;

  /** Optional additional details (field errors, validation info). */
  details?: Record<string, unknown>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const ERROR_HANDLING_TYPES_VERSION = '0.1.0';
