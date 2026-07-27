import { describe, it, expect } from 'vitest';
import { LOG_TYPES_VERSION } from '../types.js';
import type { LogLevel, LogFormat, LogEntry } from '../types.js';

describe('LogLevel type', () => {
  it('accepts valid levels', () => {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    expect(levels).toHaveLength(6);
    expect(levels.includes('info')).toBe(true);
  });
});

describe('LogFormat type', () => {
  it('accepts json and pretty', () => {
    const jsonFmt: LogFormat = 'json';
    const prettyFmt: LogFormat = 'pretty';
    expect(jsonFmt).toBe('json');
    expect(prettyFmt).toBe('pretty');
  });
});

describe('LogEntry type', () => {
  it('has required fields', () => {
    const entry: LogEntry = {
      level: 'info',
      msg: 'test message',
      timestamp: new Date().toISOString(),
    };
    expect(entry.level).toBe('info');
    expect(entry.msg).toBe('test message');
    expect(entry.timestamp).toBeDefined();
  });

  it('supports optional context', () => {
    const entry: LogEntry = {
      level: 'warn',
      msg: 'warning',
      timestamp: new Date().toISOString(),
      context: { userId: '123' },
    };
    expect(entry.context).toEqual({ userId: '123' });
  });
});

describe('runtime export', () => {
  it('exports LOG_TYPES_VERSION', () => {
    expect(LOG_TYPES_VERSION).toBe('0.1.0');
  });
});
