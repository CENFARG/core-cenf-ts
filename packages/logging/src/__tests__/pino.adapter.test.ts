import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PinoLogAdapter } from '../adapters/pino.adapter.js';
import type { LogEntry } from '../types.js';
import { Writable } from 'node:stream';

/** Capture pino output to a string. */
function captureStream(): { stream: Writable; output: string } {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return { stream, get output() { return output; } };
}

describe('PinoLogAdapter', () => {
  let captured: ReturnType<typeof captureStream>;

  beforeEach(() => {
    captured = captureStream();
  });

  afterEach(() => {
    captured.stream.destroy();
  });

  function parseOutput(): LogEntry[] {
    return captured.output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  it('info() emits structured JSON with timestamp, level, msg', () => {
    const logger = new PinoLogAdapter({ stream: captured.stream, level: 'info' });
    logger.info({}, 'test message');
    const entries = parseOutput();
    expect(entries).toHaveLength(1);
    expect(entries[0]!).toMatchObject({
      level: 30, // pino info level
      msg: 'test message',
    });
    expect(entries[0]!.time).toBeDefined();
  });

  it('includes context object in log entry', () => {
    const logger = new PinoLogAdapter({ stream: captured.stream, level: 'info' });
    logger.info({ userId: '123', action: 'login' }, 'User action');
    const entries = parseOutput();
    expect(entries[0]!).toMatchObject({
      userId: '123',
      action: 'login',
      msg: 'User action',
    });
  });

  it('error() includes stack trace', () => {
    const logger = new PinoLogAdapter({ stream: captured.stream, level: 'info' });
    const err = new Error('something broke');
    logger.error(err, 'Operation failed');
    const entries = parseOutput();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe(50); // pino error level
    expect(entries[0]!.msg).toBe('Operation failed');
    // Pino serializes Error under the 'err' key
    expect(entries[0]!.err).toBeDefined();
    expect(typeof entries[0]!.err.stack).toBe('string');
  });

  it('warn level suppresses debug and trace', () => {
    const logger = new PinoLogAdapter({ stream: captured.stream, level: 'warn' });
    logger.debug({}, 'debug msg');
    logger.info({}, 'info msg');
    logger.warn({}, 'warn msg');
    const entries = parseOutput();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe(40); // pino warn
  });

  it('child() logger inherits parent bindings', () => {
    const logger = new PinoLogAdapter({
      stream: captured.stream,
      level: 'info',
      base: { service: 'auth' },
    });
    const child = logger.child({ requestId: 'abc-123' });
    child.info({}, 'child log');
    const entries = parseOutput();
    expect(entries[0]!).toMatchObject({
      service: 'auth',
      requestId: 'abc-123',
    });
  });

  it('child() logger bindings do not affect parent', () => {
    const logger = new PinoLogAdapter({
      stream: captured.stream,
      level: 'info',
      base: { service: 'auth' },
    });
    logger.child({ requestId: 'child-only' });
    logger.info({}, 'parent log');

    const entries = parseOutput();
    expect(entries[0]!).toMatchObject({ service: 'auth' });
    expect(entries[0]!.requestId).toBeUndefined();
  });

  it('fatal() emits at level 60', () => {
    const logger = new PinoLogAdapter({ stream: captured.stream, level: 'info' });
    logger.fatal({}, 'system down');
    const entries = parseOutput();
    expect(entries[0]!.level).toBe(60); // pino fatal
  });
});
