import { describe, it, expect } from 'vitest';
import { JSON_SERIALIZER_PORT_VERSION } from '../ports.js';
import type { JsonSerializer } from '../ports.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';

describe('JsonSerializer port', () => {
  it('exports a port version constant', () => {
    expect(JSON_SERIALIZER_PORT_VERSION).toBe('0.1.0');
  });

  it('JsonSerializer extends AsyncLifecycle (compile-time)', () => {
    const assignLifecycle: AsyncLifecycle = {} as unknown as JsonSerializer;
    expect(assignLifecycle).toBeDefined();
  });

  it('serialize signature returns string (compile-time)', () => {
    const fn: JsonSerializer['serialize'] = <T>(_data: T) => '';
    expect(typeof fn).toBe('function');
  });

  it('deserialize signature accepts string (compile-time)', () => {
    const fn: JsonSerializer['deserialize'] = <T>(_json: string) => ({} as T);
    expect(typeof fn).toBe('function');
  });

  it('registerSerializer signature accepts type + serializer (compile-time)', () => {
    const fn: JsonSerializer['registerSerializer'] = <T>(_type, _serializer) => {};
    expect(typeof fn).toBe('function');
  });
});
