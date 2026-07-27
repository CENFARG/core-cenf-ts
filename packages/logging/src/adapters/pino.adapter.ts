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
import type { HealthStatus } from '@cenf/core';

/** Options for configuring the PinoLogAdapter. */
export interface PinoOptions {
  /** Writable stream for log output. Default: process.stdout. */
  stream?: DestinationStream;
  /** Minimum log level. Default: 'info'. */
  level?: pino.Level;
  /** Base bindings added to every log entry. */
  base?: Record<string, unknown>;
}

/** Numeric log levels for internal routing. */
const LEVEL_NUMBERS = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

type LevelMethod = keyof typeof LEVEL_NUMBERS;

/**
 * pino-based structured logging adapter.
 *
 * Implements `ILogManager` using the pino logger.
 * Supports five log levels, child loggers, and stream-based output.
 */
export class PinoLogAdapter implements ILogManager {
  private logger: Logger;

  constructor(options: PinoOptions = {}) {
    this.logger = pino(
      {
        level: options.level ?? 'info',
        base: options.base,
      },
      options.stream ?? pino.destination(1), // stdout
    );
  }

  /** Internal constructor for child loggers with a pre-built pino instance. */
  private static fromLogger(logger: Logger): PinoLogAdapter {
    const adapter = Object.create(PinoLogAdapter.prototype) as PinoLogAdapter;
    adapter.logger = logger;
    return adapter;
  }

  debug(obj: unknown, msg?: string): void {
    this.log('debug', obj, msg);
  }

  info(obj: unknown, msg?: string): void {
    this.log('info', obj, msg);
  }

  warn(obj: unknown, msg?: string): void {
    this.log('warn', obj, msg);
  }

  error(obj: unknown, msg?: string): void {
    if (obj instanceof Error) {
      this.logger.error(this.errorToObj(obj), msg ?? obj.message);
      return;
    }
    this.log('error', obj, msg);
  }

  fatal(obj: unknown, msg?: string): void {
    this.log('fatal', obj, msg);
  }

  child(bindings: Record<string, unknown>): ILogManager {
    const childLogger = this.logger.child(bindings);
    return PinoLogAdapter.fromLogger(childLogger);
  }

  async start(): Promise<void> {
    // No-op: pino logger is initialized in constructor
  }

  async stop(): Promise<void> {
    // No-op: pino logger stream is managed externally
  }

  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: { adapter: 'pino' } };
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  private log(method: LevelMethod, obj: unknown, msg?: string): void {
    const level = LEVEL_NUMBERS[method];
    // Pino's levelVal is the CONFIGURED minimum level.
    // Log only if the message level is >= the minimum.
    if (level < this.logger.levelVal) return;

    if (typeof obj === 'object' && obj !== null && !(obj instanceof Error)) {
      this.logger[method](obj as Record<string, unknown>, msg ?? '');
    } else {
      const message = typeof obj === 'string' && msg === undefined ? obj : msg;
      this.logger[method](message);
    }
  }

  private errorToObj(err: Error): Record<string, unknown> {
    const extra = { ...(err as unknown as Record<string, unknown>) };
    return {
      err: {
        message: err.message,
        stack: err.stack,
        ...extra,
      },
    };
  }
}
