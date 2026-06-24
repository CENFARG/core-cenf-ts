/**
 * LogManager port interface — structured logging.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/logging/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';

/**
 * Structured logging manager port.
 *
 * Provides five log levels and child logger support.
 * Extends `AsyncLifecycle` for uniform orchestration.
 * All adapters (pino, memory) implement this interface.
 */
export interface ILogManager extends AsyncLifecycle {
  /** Debug-level log for development diagnostics. */
  debug(obj: unknown, msg?: string): void;

  /** Info-level log for normal operational events. */
  info(obj: unknown, msg?: string): void;

  /** Warn-level log for potential issues. */
  warn(obj: unknown, msg?: string): void;

  /** Error-level log for failures that need attention. */
  error(obj: unknown, msg?: string): void;

  /** Fatal-level log for unrecoverable failures. */
  fatal(obj: unknown, msg?: string): void;

  /**
   * Create a child logger with additional bindings.
   *
   * Child loggers inherit parent configuration and merge
   * their bindings with parent bindings on every log call.
   *
   * @param bindings - Key-value pairs to attach to every log entry.
   * @returns A new `ILogManager` with merged bindings.
   */
  child(bindings: Record<string, unknown>): ILogManager;
}

/** Runtime version constant — ensures module existence for TDD. */
export const LOG_PORT_VERSION = '0.1.0';
