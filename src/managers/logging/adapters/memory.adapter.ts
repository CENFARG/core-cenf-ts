/**
 * In-memory logging adapter for testing.
 *
 * Captures log entries in an array for test verification.
 * Supports all `ILogManager` methods and child logger isolation.
 *
 * @module managers/logging/adapters/memory.adapter
 */

import type { ILogManager } from '../ports.js';
import type { LogEntry, LogLevel } from '../types.js';

/**
 * In-memory log adapter that captures entries for test assertions.
 *
 * Stores structured `LogEntry` objects in a public `entries` array.
 * Child loggers maintain their own isolated entry lists.
 */
export class MemoryLogAdapter implements ILogManager {
  /** Captured log entries. Public for test access. */
  readonly entries: LogEntry[] = [];
  private bindings: Record<string, unknown> = {};

  constructor(bindings?: Record<string, unknown>) {
    this.bindings = { ...bindings };
  }

  debug(obj: unknown, msg?: string): void {
    this.record('debug', obj, msg);
  }

  info(obj: unknown, msg?: string): void {
    this.record('info', obj, msg);
  }

  warn(obj: unknown, msg?: string): void {
    this.record('warn', obj, msg);
  }

  error(obj: unknown, msg?: string): void {
    this.record('error', obj, msg);
  }

  fatal(obj: unknown, msg?: string): void {
    this.record('fatal', obj, msg);
  }

  child(bindings: Record<string, unknown>): ILogManager {
    const child = new MemoryLogAdapter({
      ...this.bindings,
      ...bindings,
    });
    return child;
  }

  /** Clear all captured entries. */
  clear(): void {
    this.entries.length = 0;
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  private record(level: LogLevel, obj: unknown, msg?: string): void {
    const context: Record<string, unknown> = { ...this.bindings };

    if (obj instanceof Error) {
      context.err = {
        message: obj.message,
        stack: obj.stack,
      };
    } else if (typeof obj === 'object' && obj !== null) {
      Object.assign(context, obj as Record<string, unknown>);
    }

    const message =
      msg ??
      (typeof obj === 'string' ? obj : (obj as Error)?.message ?? '');

    this.entries.push({
      level,
      msg: message,
      timestamp: new Date().toISOString(),
      context: Object.keys(context).length > 0 ? context : undefined,
    });
  }
}
