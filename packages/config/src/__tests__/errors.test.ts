import { describe, it, expect } from 'vitest';
import { ConfigValidationError, ConfigNotFoundError } from '../errors.js';
import { CenfError } from '@cenf/core';

describe('ConfigValidationError', () => {
  it('extends CenfError', () => {
    const err = new ConfigValidationError('invalid config');
    expect(err).toBeInstanceOf(CenfError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has code ERR_CONFIG_VALIDATION', () => {
    const err = new ConfigValidationError('bad schema');
    expect(err.code).toBe('ERR_CONFIG_VALIDATION');
  });

  it('includes message and optional cause', () => {
    const cause = new Error('zod parse failed');
    const err = new ConfigValidationError('validation error', cause);
    expect(err.message).toBe('validation error');
    expect(err.cause).toBe(cause);
  });

  it('preserves stack trace', () => {
    const err = new ConfigValidationError('trace test');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ConfigValidationError');
  });
});

describe('ConfigNotFoundError', () => {
  it('extends CenfError', () => {
    const err = new ConfigNotFoundError('missing key');
    expect(err).toBeInstanceOf(CenfError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has code ERR_CONFIG_NOT_FOUND', () => {
    const err = new ConfigNotFoundError('MISSING_KEY');
    expect(err.code).toBe('ERR_CONFIG_NOT_FOUND');
  });

  it('includes the missing key name in message', () => {
    const err = new ConfigNotFoundError('DATABASE_URL');
    expect(err.message).toContain('DATABASE_URL');
  });
});
