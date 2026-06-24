import { describe, it, expect, vi } from 'vitest';
import {
  retry,
  exponentialBackoff,
  sha256Hash,
  isCenfError,
} from '../utils.js';
import { CenfError, ConfigError } from '../errors.js';

describe('retry()', () => {
  it('succeeds on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValueOnce('ok');
    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exhausts all attempts and throws the last error', async () => {
    const lastError = new Error('final failure');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(lastError);
    await expect(
      retry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('final failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects maxAttempts limit', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));
    await expect(
      retry(fn, { maxAttempts: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('exponentialBackoff()', () => {
  it('returns base delay for attempt 0', () => {
    expect(exponentialBackoff(0, 100)).toBe(100);
  });

  it('doubles delay for attempt 1', () => {
    expect(exponentialBackoff(1, 100)).toBe(200);
  });

  it('quadruples delay for attempt 2', () => {
    expect(exponentialBackoff(2, 100)).toBe(400);
  });

  it('caps at maxDelay', () => {
    const delay = exponentialBackoff(10, 100, 1000);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('returns 0 for negative attempt', () => {
    expect(exponentialBackoff(-1, 100)).toBe(100);
  });
});

describe('sha256Hash()', () => {
  it('produces a deterministic hash for the same input', () => {
    const hash1 = sha256Hash('hello world');
    const hash2 = sha256Hash('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = sha256Hash('hello');
    const hash2 = sha256Hash('world');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = sha256Hash('');
    expect(hash).toHaveLength(64);
  });

  it('is case-sensitive', () => {
    const hash1 = sha256Hash('Hello');
    const hash2 = sha256Hash('hello');
    expect(hash1).not.toBe(hash2);
  });
});

describe('isCenfError()', () => {
  it('returns true for CenfError subclasses', () => {
    const err = new ConfigError('test');
    expect(isCenfError(err)).toBe(true);
  });

  it('returns false for plain Error', () => {
    const err = new Error('plain');
    expect(isCenfError(err)).toBe(false);
  });

  it('returns false for non-Error objects', () => {
    expect(isCenfError('string error')).toBe(false);
    expect(isCenfError({ code: 'ERR_CONFIG' })).toBe(false);
    expect(isCenfError(null)).toBe(false);
    expect(isCenfError(undefined)).toBe(false);
  });

  it('returns false for Error with similar shape but not CenfError', () => {
    class Lookalike extends Error {
      readonly code = 'ERR_FAKE';
    }
    const fake = new Lookalike('fake');
    expect(isCenfError(fake)).toBe(false);
  });
});
