import { describe, it, expect, vi } from 'vitest';
import { StandardErrorHandlingAdapter } from '../adapters/standard.adapter.js';
import {
  CenfError,
  TokenExpiredError,
  TokenInvalidError,
  ValidationError,
  HttpTimeoutError,
  HttpClientError,
  DatabaseConnectionError,
} from '../../../shared/errors.js';

// ---------------------------------------------------------------------------
// classify()
// ---------------------------------------------------------------------------

describe('StandardErrorHandlingAdapter — classify()', () => {
  const adapter = new StandardErrorHandlingAdapter();

  it('classifies TokenExpiredError as client, non-retryable', () => {
    const err = new TokenExpiredError('Token expired');
    const result = adapter.classify(err);
    expect(result).toEqual({
      category: 'client',
      retryable: false,
      userMessage: 'Token expired',
    });
  });

  it('classifies TokenInvalidError as client, non-retryable', () => {
    const err = new TokenInvalidError('Invalid token');
    const result = adapter.classify(err);
    expect(result.category).toBe('client');
    expect(result.retryable).toBe(false);
  });

  it('classifies ValidationError as client, non-retryable', () => {
    const err = new ValidationError('Email is required');
    const result = adapter.classify(err);
    expect(result.category).toBe('client');
    expect(result.retryable).toBe(false);
  });

  it('classifies HttpTimeoutError as timeout, retryable', () => {
    const err = new HttpTimeoutError('Request timed out');
    const result = adapter.classify(err);
    expect(result).toEqual({
      category: 'timeout',
      retryable: true,
    });
  });

  it('classifies HttpClientError as network, retryable', () => {
    const err = new HttpClientError('Connection refused');
    const result = adapter.classify(err);
    expect(result.category).toBe('network');
    expect(result.retryable).toBe(true);
  });

  it('classifies DatabaseConnectionError as server, non-retryable by default', () => {
    const err = new DatabaseConnectionError('ECONNREFUSED');
    const result = adapter.classify(err);
    expect(result.category).toBe('server');
    expect(result.retryable).toBe(false);
  });

  it('classifies plain Error as server, non-retryable', () => {
    const err = new Error('something broke');
    const result = adapter.classify(err);
    expect(result).toEqual({
      category: 'server',
      retryable: false,
    });
  });

  it('classifies non-Error throwables as server', () => {
    const result = adapter.classify('plain string error');
    expect(result.category).toBe('server');
    expect(result.retryable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handle()
// ---------------------------------------------------------------------------

describe('StandardErrorHandlingAdapter — handle()', () => {
  const adapter = new StandardErrorHandlingAdapter();

  it('produces report from CenfError with correct code', () => {
    const err = new ValidationError('Email is required');
    const report = adapter.handle(err);

    expect(report.code).toBe('ERR_VALIDATION');
    expect(report.message).toBe('Email is required');
  });

  it('sanitizes internal error message for server errors', () => {
    const err = new DatabaseConnectionError('ECONNREFUSED 127.0.0.1:5432');
    const report = adapter.handle(err);

    // Internal server errors should NOT expose connection details
    expect(report.code).toBe('ERR_DATABASE_CONNECTION');
    expect(report.message).not.toContain('127.0.0.1');
    expect(report.message).not.toContain('5432');
    expect(report.message).toContain('Internal');
  });

  it('produces generic code for unknown errors', () => {
    const err = new Error('raw error');
    const report = adapter.handle(err);

    expect(report.code).toBe('ERR_INTERNAL');
    expect(report.message).toBe('Internal server error');
  });

  it('includes details when ValidationError has extra props', () => {
    const err = new ValidationError('Field validation failed');
    const report = adapter.handle(err, {
      source: 'ValidationManager',
      operation: 'validate',
    });

    expect(report.code).toBe('ERR_VALIDATION');
    expect(report.details).toBeDefined();
  });

  it('includes source and operation in details when context provided', () => {
    const err = new HttpClientError('Fetch failed');
    const report = adapter.handle(err, {
      source: 'HttpClient',
      operation: 'GET /api/data',
    });

    expect(report.details).toHaveProperty('source', 'HttpClient');
    expect(report.details).toHaveProperty('operation', 'GET /api/data');
  });
});

// ---------------------------------------------------------------------------
// wrap()
// ---------------------------------------------------------------------------

describe('StandardErrorHandlingAdapter — wrap()', () => {
  const adapter = new StandardErrorHandlingAdapter();

  it('returns the function result on success', () => {
    const fn = vi.fn((x: number, y: number) => x + y);
    const wrapped = adapter.wrap(fn);

    const result = wrapped(2, 3);
    expect(result).toBe(5);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls handle() and re-throws on error', () => {
    const originalError = new ValidationError('Bad input');
    const fn = vi.fn(() => {
      throw originalError;
    });
    const wrapped = adapter.wrap(fn);

    expect(() => wrapped()).toThrow(ValidationError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('preserves error code through wrapped function', () => {
    const fn = vi.fn(() => {
      throw new HttpTimeoutError('Timed out');
    });
    const wrapped = adapter.wrap(fn);

    try {
      wrapped();
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpTimeoutError);
      expect((err as CenfError).code).toBe('ERR_HTTP_TIMEOUT');
    }
  });

  it('passes through all function arguments', () => {
    const fn = vi.fn((a: string, b: number, c: boolean) => `${a}-${b}-${c}`);
    const wrapped = adapter.wrap(fn);

    const result = wrapped('test', 42, true);
    expect(result).toBe('test-42-true');
  });

  it('works with async functions', async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const wrapped = adapter.wrap(fn);

    const result = await wrapped(21);
    expect(result).toBe(42);
  });

  it('wraps async function errors', async () => {
    const fn = vi.fn(async () => {
      throw new HttpClientError('Network down');
    });
    const wrapped = adapter.wrap(fn);

    await expect(wrapped()).rejects.toThrow(HttpClientError);
  });
});
