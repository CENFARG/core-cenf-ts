import { describe, it, expect } from 'vitest';
import { LogConfigurationError } from '../errors.js';
import { CenfError } from '@cenf/core';

describe('LogConfigurationError', () => {
  it('extends CenfError', () => {
    const err = new LogConfigurationError('invalid log level');
    expect(err).toBeInstanceOf(CenfError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has code ERR_LOG_CONFIGURATION', () => {
    const err = new LogConfigurationError('bad config');
    expect(err.code).toBe('ERR_LOG_CONFIGURATION');
  });

  it('includes message and optional cause', () => {
    const cause = new Error('pino init failed');
    const err = new LogConfigurationError('config error', cause);
    expect(err.message).toBe('config error');
    expect(err.cause).toBe(cause);
  });

  it('preserves stack trace', () => {
    const err = new LogConfigurationError('trace test');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('LogConfigurationError');
  });
});
