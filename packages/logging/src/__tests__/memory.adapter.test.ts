import { describe, it, expect } from 'vitest';
import { MemoryLogAdapter } from '../adapters/memory.adapter.js';
import type { ILogManager } from '../ports.js';

describe('MemoryLogAdapter', () => {
  it('captures log entries for verification', () => {
    const logger = new MemoryLogAdapter();
    logger.info({}, 'test');
    logger.warn({}, 'warning');

    expect(logger.entries).toHaveLength(2);
    expect(logger.entries[0]!.level).toBe('info');
    expect(logger.entries[1]!.level).toBe('warn');
  });

  it('records all five log levels', () => {
    const logger = new MemoryLogAdapter();
    logger.debug({}, 'd');
    logger.info({}, 'i');
    logger.warn({}, 'w');
    logger.error({}, 'e');
    logger.fatal({}, 'f');

    expect(logger.entries).toHaveLength(5);
    expect(logger.entries.map((e) => e.level)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('captures context object in entries', () => {
    const logger = new MemoryLogAdapter();
    logger.info({ userId: '123', action: 'login' }, 'User login');

    expect(logger.entries[0]!.context).toEqual({
      userId: '123',
      action: 'login',
    });
  });

  it('captures error with stack trace', () => {
    const logger = new MemoryLogAdapter();
    const err = new Error('test error');
    logger.error(err, 'failed');

    const entry = logger.entries[0]!;
    expect(entry.level).toBe('error');
    expect(entry.msg).toBe('failed');
    expect(entry.context).toHaveProperty('err');
  });

  it('child() logger isolation — child entries go to separate store', () => {
    const parent = new MemoryLogAdapter();
    const child = parent.child({ service: 'child-svc' });

    child.info({}, 'child message');
    parent.info({}, 'parent message');

    // Parent only sees its own entries
    expect(parent.entries).toHaveLength(1);
    expect(parent.entries[0]!.msg).toBe('parent message');

    // Child has its own entries
    expect((child as MemoryLogAdapter).entries).toHaveLength(1);
    expect((child as MemoryLogAdapter).entries[0]!.msg).toBe('child message');
  });

  it('child() logger inherits parent bindings in context', () => {
    const parent = new MemoryLogAdapter();
    const child = parent.child({ service: 'auth', requestId: 'req-1' });

    child.info({ extra: 'data' }, 'child log');

    const childAdapter = child as MemoryLogAdapter;
    expect(childAdapter.entries[0]!.context).toMatchObject({
      service: 'auth',
      requestId: 'req-1',
      extra: 'data',
    });
  });

  it('clear() empties captured entries', () => {
    const logger = new MemoryLogAdapter();
    logger.info({}, 'test');
    expect(logger.entries).toHaveLength(1);

    logger.clear();
    expect(logger.entries).toHaveLength(0);
  });

  it('implements ILogManager interface', () => {
    const logger: ILogManager = new MemoryLogAdapter();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.child).toBe('function');
  });
});
