/**
 * LogManager-specific types.
 *
 * Types used by logging adapters and consumers.
 *
 * @module managers/logging/types
 */

/**
 * Log severity levels in order of increasing importance.
 *
 * Mirrors pino's level set for compatibility.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log output format.
 *
 * - `json`: Structured JSON output (production default).
 * - `pretty`: Human-readable colored output (local development).
 */
export type LogFormat = 'json' | 'pretty';

/**
 * A structured log entry produced by a logging adapter.
 *
 * Captured by `MemoryLogAdapter` for test verification.
 */
export interface LogEntry {
  /** Severity level of the log entry. */
  level: LogLevel;
  /** Log message text. */
  msg: string;
  /** ISO 8601 timestamp of when the log was created. */
  timestamp: string;
  /** Optional structured context attached to the entry. */
  context?: Record<string, unknown>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const LOG_TYPES_VERSION = '0.1.0';
