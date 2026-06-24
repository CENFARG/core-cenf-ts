import { describe, it, expect } from 'vitest';
import {
  JsonValue, // runtime type guard export to force module load
} from '../types.js';
import type {
  JsonObject,
  Result,
  HealthStatus,
  ContextStore,
} from '../types.js';

describe('JsonValue type', () => {
  it('accepts string', () => {
    const val: JsonValue = 'hello';
    expect(val).toBe('hello');
  });

  it('accepts number', () => {
    const val: JsonValue = 42;
    expect(val).toBe(42);
  });

  it('accepts boolean', () => {
    const val: JsonValue = true;
    expect(val).toBe(true);
  });

  it('accepts null', () => {
    const val: JsonValue = null;
    expect(val).toBeNull();
  });

  it('accepts array of JsonValue', () => {
    const val: JsonValue = [1, 'two', false];
    expect(Array.isArray(val)).toBe(true);
    if (Array.isArray(val)) {
      expect(val[0]).toBe(1);
    }
  });

  it('accepts nested JsonObject', () => {
    const val: JsonValue = { key: 'value', nested: { count: 10 } };
    expect(val).toEqual({ key: 'value', nested: { count: 10 } });
  });
});

describe('JsonObject type', () => {
  it('is a valid JsonObject with string values', () => {
    const obj: JsonObject = { name: 'test', id: '123' };
    expect(obj.name).toBe('test');
  });

  it('is a valid JsonObject with mixed values', () => {
    const obj: JsonObject = { count: 10, active: false, label: 'ok' };
    expect(obj.active).toBe(false);
  });
});

describe('Result<T, E> type', () => {
  it('success variant holds the value', () => {
    const result: Result<number, Error> = { ok: true, value: 42 };
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('error variant holds the error', () => {
    const err = new Error('failed');
    const result: Result<number, Error> = { ok: false, error: err };
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(err);
      expect(result.error.message).toBe('failed');
    }
  });

  it('discriminated union works with CenfError', () => {
    class TestErr extends Error {
      readonly code = 'TEST_ERR';
    }
    const failure: Result<string, TestErr> = {
      ok: false,
      error: new TestErr('fail'),
    };
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.code).toBe('TEST_ERR');
    }
  });
});

describe('HealthStatus type', () => {
  it('healthy status with details', () => {
    const status: HealthStatus = {
      status: 'healthy',
      details: { uptime: 3600 },
    };
    expect(status.status).toBe('healthy');
    expect(status.details).toEqual({ uptime: 3600 });
  });

  it('degraded status', () => {
    const status: HealthStatus = {
      status: 'degraded',
      details: { reason: 'high latency' },
    };
    expect(status.status).toBe('degraded');
  });

  it('unhealthy status', () => {
    const status: HealthStatus = { status: 'unhealthy', details: {} };
    expect(status.status).toBe('unhealthy');
  });
});

describe('ContextStore type', () => {
  it('holds correlationId', () => {
    const ctx: ContextStore = { correlationId: 'abc-123' };
    expect(ctx.correlationId).toBe('abc-123');
  });

  it('holds optional tenantId', () => {
    const ctx: ContextStore = {
      correlationId: 'corr-1',
      tenantId: 'tenant-5',
    };
    expect(ctx.tenantId).toBe('tenant-5');
  });

  it('holds optional userId', () => {
    const ctx: ContextStore = {
      correlationId: 'corr-2',
      userId: 'user-99',
    };
    expect(ctx.userId).toBe('user-99');
  });

  it('holds full context store', () => {
    const ctx: ContextStore = {
      correlationId: 'full-ctx',
      tenantId: 't1',
      userId: 'u1',
    };
    expect(ctx.correlationId).toBe('full-ctx');
    expect(ctx.tenantId).toBe('t1');
    expect(ctx.userId).toBe('u1');
  });
});
