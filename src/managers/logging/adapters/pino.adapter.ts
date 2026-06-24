/**
 * pino-based logging adapter.
 *
 * Wraps the pino logger for structured JSON logging with level
 * filtering, child loggers, and configurable output format.
 *
 * @module managers/logging/adapters/pino.adapter
 */

import pino from 'pino';
import type { Logger, DestinationStream } from 'pino';
import type { ILogManager } from '../ports.js';

/** Options for configuring the PinoLogAdapter. */
export interface PinoOptions {
  /** Writable stream for log output. Default: process.stdout. */
  stream?: DestinationStream;
  /** Minimum log level. Default: 'info'. */
  level?: pino.Level;
  /** Base bindings added to every log entry. */
  base?: Record<string, unknown>;
}

/**
 * pino-based structured logging adapter.
 *
 * Implements `ILogManager` using the pino logger.
 * Supports five log levels, child loggers, and stream-based output.
 */
export class PinoLogAdapter implements ILogManager {
  private readonly logger: Logger;

  constructor(options: PinoOptions = {}) {
    this.logger = pino(
      {
        level: options.level ?? 'info',
        base: options.base,
      },
      options.stream ?? pino.destination(1), // stdout
    );
  }

  debug(obj: unknown, msg?: string): void {
    this.log(20, obj, msg);
  }

  info(obj: unknown, msg?: string): void {
    this.log(30, obj, msg);
  }

  warn(obj: unknown, msg?: string): void {
    this.log(40, obj, msg);
  }

  error(obj: unknown, msg?: string): void {
    if (obj instanceof Error) {
      this.logger.error({ ...this.errorToObj(obj) }, msg ?? obj.message);
    } else {
      this.log(50, obj, msg);
    }
  }

  fatal(obj: unknown, msg?: string): void {
    this.log(60, obj, msg);
  }

  child(bindings: Record<string, unknown>): ILogManager {
    const childLogger = this.logger.child(bindings);
    const adapter = new PinoLogAdapter();
    // Replace the internal logger with the child
    (adapter as { logger: Logger }).logger = childLogger;
    return adapter;
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  private log(level: pino.Level, obj: unknown, msg?: string): void {
    // Pino's levelVal is the CONFIGURED minimum level.
    // Log only if the message level is >= the minimum.
    if (level < this.logger.levelVal) return;

    if (typeof obj === 'object' && obj !== null && !(obj instanceof Error)) {
      this.logger[levelToMethod(level)](
        obj as Record<string, unknown>,
        msg ?? '',
      );
    } else {
      const message = typeof obj === 'string' && msg === undefined ? obj : msg;
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      this.logger[levelToMethod(level)](message);
    }
  }

  private errorToObj(err: Error): Record<string, unknown> {
    return {
      err: {
        message: err.message,
        stack: err.stack,
        ...(err as Record<string, unknown>),
      },
    };
  }
}

/** Map pino numeric level to method name (using the legacy method names). */
function levelToMethod(level: pino.Level): 'debug' | 'info' | 'warn' | 'error' | 'fatal' {
  const map: Record<number, keyof Logger> = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
  };
  const method = map[level as number];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  switch (method) {
    case 'debug': return 'debug';
    case 'info': return 'info';
    case 'warn': return 'warn';
    case 'error': return 'error';
    case 'fatal': return 'fatal';
    default: return 'info';
  }
}
