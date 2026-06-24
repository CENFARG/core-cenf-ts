import { describe, it, expect } from 'vitest';
import { SecretNotFoundError } from '../errors.js';
import { CenfError, SecretError } from '../../../shared/errors.js';

describe('SecretNotFoundError', () => {
  it('extends CenfError', () => {
    const err = new SecretNotFoundError('secret DB_PASSWORD not found');
    expect(err).toBeInstanceOf(CenfError);
  });

  it('extends SecretError', () => {
    const err = new SecretNotFoundError('secret DB_PASSWORD not found');
    expect(err).toBeInstanceOf(SecretError);
  });

  it('has correct error code', () => {
    const err = new SecretNotFoundError('secret DB_PASSWORD not found');
    expect(err.code).toBe('ERR_SECRET_NOT_FOUND');
  });

  it('preserves the message', () => {
    const err = new SecretNotFoundError('custom message');
    expect(err.message).toBe('custom message');
  });

  it('preserves the error name', () => {
    const err = new SecretNotFoundError('test');
    expect(err.name).toBe('SecretNotFoundError');
  });

  it('accepts an optional cause', () => {
    const cause = new Error('underlying');
    const err = new SecretNotFoundError('not found', cause);
    expect(err.cause).toBe(cause);
  });
});
