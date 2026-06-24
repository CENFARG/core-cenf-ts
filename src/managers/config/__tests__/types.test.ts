import { describe, it, expect } from 'vitest';
import { CONFIG_TYPES_VERSION } from '../types.js';
import type { ConfigStore, EnvConfigOptions } from '../types.js';

describe('ConfigStore type', () => {
  it('holds arbitrary key-value pairs', () => {
    const store: ConfigStore = {
      PORT: 3000,
      HOST: 'localhost',
      DEBUG: true,
    };
    expect(store.PORT).toBe(3000);
    expect(store.HOST).toBe('localhost');
    expect(store.DEBUG).toBe(true);
  });

  it('is empty by default', () => {
    const store: ConfigStore = {};
    expect(Object.keys(store)).toHaveLength(0);
  });
});

describe('EnvConfigOptions type', () => {
  it('has default values', () => {
    const opts: EnvConfigOptions = {};
    expect(opts.dotenvPath).toBeUndefined();
    expect(opts.override).toBeUndefined();
  });

  it('accepts custom dotenv path', () => {
    const opts: EnvConfigOptions = { dotenvPath: '/custom/.env' };
    expect(opts.dotenvPath).toBe('/custom/.env');
  });

  it('accepts override flag', () => {
    const opts: EnvConfigOptions = { override: true };
    expect(opts.override).toBe(true);
  });

  it('accepts full options', () => {
    const opts: EnvConfigOptions = {
      dotenvPath: '/app/.env.production',
      override: false,
    };
    expect(opts.dotenvPath).toBe('/app/.env.production');
    expect(opts.override).toBe(false);
  });
});

describe('runtime export', () => {
  it('exports CONFIG_TYPES_VERSION', () => {
    expect(CONFIG_TYPES_VERSION).toBe('0.1.0');
  });
});
