import { describe, it, expect } from 'vitest';
import { BOOTSTRAP_PORT_VERSION } from '../ports.js';
import type { BootstrapOrchestrator } from '../ports.js';
import type { AsyncLifecycle } from '@cenf/core';

describe('BootstrapOrchestrator port', () => {
  it('exports a port version constant', () => {
    expect(BOOTSTRAP_PORT_VERSION).toBe('0.1.0');
  });

  it('BootstrapOrchestrator extends AsyncLifecycle (compile-time)', () => {
    const assignLifecycle: AsyncLifecycle =
      {} as unknown as BootstrapOrchestrator;
    expect(assignLifecycle).toBeDefined();
  });

  it('register signature accepts manager + options (compile-time)', () => {
    const fn: BootstrapOrchestrator['register'] = (_manager, _options) => {};
    expect(typeof fn).toBe('function');
  });
});
