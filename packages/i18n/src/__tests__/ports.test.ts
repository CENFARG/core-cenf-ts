import { describe, it, expect } from 'vitest';
import { I18N_PORT_VERSION } from '../ports.js';
import type { I18nManager } from '../ports.js';
import type { AsyncLifecycle } from '@cenf/core';

describe('I18nManager port', () => {
  it('exports a port version constant', () => {
    expect(I18N_PORT_VERSION).toBe('0.1.0');
  });

  it('I18nManager extends AsyncLifecycle (compile-time)', () => {
    const assignLifecycle: AsyncLifecycle = {} as unknown as I18nManager;
    expect(assignLifecycle).toBeDefined();
  });

  it('t signature accepts key and params (compile-time)', () => {
    const fn: I18nManager['t'] = (_key, _params?) => '';
    expect(typeof fn).toBe('function');
  });

  it('setLocale signature accepts string (compile-time)', () => {
    const fn: I18nManager['setLocale'] = async (_locale) => {};
    expect(typeof fn).toBe('function');
  });

  it('getLocale signature returns string (compile-time)', () => {
    const fn: I18nManager['getLocale'] = () => '';
    expect(typeof fn).toBe('function');
  });

  it('loadResources signature accepts locale and resources (compile-time)', () => {
    const fn: I18nManager['loadResources'] = async (_locale, _resources) => {};
    expect(typeof fn).toBe('function');
  });
});
