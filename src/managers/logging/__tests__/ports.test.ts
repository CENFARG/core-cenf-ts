import { describe, it, expect } from 'vitest';
import { LOG_PORT_VERSION } from '../ports.js';
import type { ILogManager } from '../ports.js';

/** Test implementation of ILogManager. */
class TestLogger implements ILogManager {
  public logs: Array<{ level: string; obj: unknown; msg?: string }> = [];

  debug(obj: unknown, msg?: string): void {
    this.logs.push({ level: 'debug', obj, msg });
  }
  info(obj: unknown, msg?: string): void {
    this.logs.push({ level: 'info', obj, msg });
  }
  warn(obj: unknown, msg?: string): void {
    this.logs.push({ level: 'warn', obj, msg });
  }
  error(obj: unknown, msg?: string): void {
    this.logs.push({ level: 'error', obj, msg });
  }
  fatal(obj: unknown, msg?: string): void {
    this.logs.push({ level: 'fatal', obj, msg });
  }
  child(bindings: Record<string, unknown>): ILogManager {
    const child = new TestLogger();
    return child;
  }
}

describe('ILogManager port', () => {
  it('exports runtime version constant', () => {
    expect(LOG_PORT_VERSION).toBe('0.1.0');
  });

  it('has 5 log levels: debug, info, warn, error, fatal', () => {
    const logger = new TestLogger();
    logger.debug({}, 'debug msg');
    logger.info({}, 'info msg');
    logger.warn({}, 'warn msg');
    logger.error({}, 'error msg');
    logger.fatal({}, 'fatal msg');

    expect(logger.logs).toHaveLength(5);
    expect(logger.logs[0]!.level).toBe('debug');
    expect(logger.logs[4]!.level).toBe('fatal');
  });

  it('accepts message as second argument', () => {
    const logger = new TestLogger();
    logger.info({ userId: '123' }, 'User action');
    expect(logger.logs[0]!.msg).toBe('User action');
    expect(logger.logs[0]!.obj).toEqual({ userId: '123' });
  });

  it('child() returns a new ILogManager', () => {
    const logger = new TestLogger();
    const child = logger.child({ service: 'auth' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
    expect(typeof child.child).toBe('function');
  });
});
