import { describe, it, expect } from 'vitest';
import { HEALTH_PORT_VERSION } from '../ports.js';
import type { HealthManager } from '../ports.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';

describe('HealthManager port', () => {
  it('exports a port version constant', () => {
    expect(HEALTH_PORT_VERSION).toBe('0.1.0');
  });

  it('HealthManager extends AsyncLifecycle (compile-time)', () => {
    const assignLifecycle: AsyncLifecycle = {} as unknown as HealthManager;
    expect(assignLifecycle).toBeDefined();
  });

  it('check signature returns HealthReport (compile-time)', () => {
    const fn: HealthManager['check'] = async () => ({
      status: 'healthy',
      components: {},
      timestamp: 0,
    });
    expect(typeof fn).toBe('function');
  });

  it('register signature accepts manager + name (compile-time)', () => {
    const fn: HealthManager['register'] = (_manager, _name) => {};
    expect(typeof fn).toBe('function');
  });

  it('isReady signature returns boolean (compile-time)', () => {
    const fn: HealthManager['isReady'] = async () => true;
    expect(typeof fn).toBe('function');
  });

  it('isLive signature returns boolean (compile-time)', () => {
    const fn: HealthManager['isLive'] = async () => true;
    expect(typeof fn).toBe('function');
  });
});
