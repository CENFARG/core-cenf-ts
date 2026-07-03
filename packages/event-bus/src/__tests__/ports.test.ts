import { describe, it, expect } from 'vitest';
import { EVENT_BUS_PORT_VERSION } from '../ports.js';
import type { EventBusManager } from '../ports.js';
import type { AsyncLifecycle } from '@cenf/core';

/**
 * Port contract tests for EventBusManager.
 *
 * Verifies:
 * - Port version constant is exported
 * - TypeScript compiles: EventBusManager extends AsyncLifecycle
 * - All required method signatures are present (compile-time)
 */
describe('EventBusManager port', () => {
  it('exports a port version constant', () => {
    expect(EVENT_BUS_PORT_VERSION).toBe('0.1.0');
  });

  it('EventBusManager extends AsyncLifecycle (compile-time)', () => {
    // Compile-time check: assign EventBusManager to AsyncLifecycle
    const assignLifecycle: AsyncLifecycle = {} as unknown as EventBusManager;
    expect(assignLifecycle).toBeDefined();
  });

  it('publish signature is callable (compile-time)', () => {
    // Verify the method signature compiles with correct types
    const fn: EventBusManager['publish'] = async (_topic, _data) => {};
    expect(typeof fn).toBe('function');
  });

  it('subscribe signature returns string (compile-time)', () => {
    const fn: EventBusManager['subscribe'] = async (_topic, _handler) => '';
    expect(typeof fn).toBe('function');
  });

  it('unsubscribe signature accepts string (compile-time)', () => {
    const fn: EventBusManager['unsubscribe'] = async (_id) => {};
    expect(typeof fn).toBe('function');
  });

  it('request signature expects generic R (compile-time)', () => {
    const fn: EventBusManager['request'] = async <T, R>(_topic: string, _data: T, _timeout?: number) =>
      ({}) as R;
    expect(typeof fn).toBe('function');
  });

  it('reply signature expects handler (compile-time)', () => {
    const fn: EventBusManager['reply'] = async <T, R>(
      _topic: string,
      _handler: (data: T) => Promise<R>,
    ) => {};
    expect(typeof fn).toBe('function');
  });
});
