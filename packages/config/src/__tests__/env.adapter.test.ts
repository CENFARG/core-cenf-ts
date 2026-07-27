import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EnvConfigAdapter } from '../adapters/env.adapter.js';
import { ConfigValidationError } from '../errors.js';
import type { EnvConfigOptions } from '../types.js';

const testSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  OPTIONAL_FLAG: z.string().optional(),
});

describe('EnvConfigAdapter', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    delete process.env.OPTIONAL_FLAG;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('load() returns typed config from env vars', async () => {
    const adapter = new EnvConfigAdapter();
    const config = await adapter.load(testSchema);
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_URL).toBe('postgres://localhost:5432/test');
    expect(config.OPTIONAL_FLAG).toBeUndefined();
  });

  it('load() applies default values for missing env vars', async () => {
    const adapter = new EnvConfigAdapter();
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    process.env.DATABASE_URL = 'postgres://localhost/test';
    const config = await adapter.load(testSchema);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
  });

  it('load() throws ConfigValidationError when required field is missing', async () => {
    const adapter = new EnvConfigAdapter();
    delete process.env.DATABASE_URL;
    await expect(adapter.load(testSchema)).rejects.toThrow(ConfigValidationError);
  });

  it('load() throws ConfigValidationError for invalid type', async () => {
    const adapter = new EnvConfigAdapter();
    process.env.PORT = 'not-a-number';
    await expect(adapter.load(testSchema)).rejects.toThrow(ConfigValidationError);
  });

  it('set() overrides in-memory without mutating process.env', async () => {
    const adapter = new EnvConfigAdapter();
    await adapter.load(testSchema);
    adapter.set('PORT', 9999);
    expect(adapter.get('PORT')).toBe(9999);
    expect(process.env.PORT).toBe('4000');
  });

  it('get() returns undefined for unloaded keys', () => {
    const adapter = new EnvConfigAdapter();
    expect(adapter.get('UNKNOWN')).toBeUndefined();
  });

  it('get() returns loaded values after load()', async () => {
    const adapter = new EnvConfigAdapter();
    await adapter.load(testSchema);
    expect(adapter.get('NODE_ENV')).toBe('test');
    expect(adapter.get('PORT')).toBe(4000);
  });

  it('reload() re-reads environment variables', async () => {
    const adapter = new EnvConfigAdapter();
    await adapter.load(testSchema);
    expect(adapter.get('NODE_ENV')).toBe('test');
    process.env.NODE_ENV = 'production';
    await adapter.reload();
    const config = await adapter.load(testSchema);
    expect(config.NODE_ENV).toBe('production');
  });

  it('implements AsyncLifecycle start/stop/health', async () => {
    const adapter = new EnvConfigAdapter();
    await adapter.start();
    await adapter.load(testSchema);
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details).toBeDefined();
    await adapter.stop();
  });

  it('health() reports env and keys loaded count', async () => {
    const adapter = new EnvConfigAdapter();
    await adapter.start();
    await adapter.load(testSchema);
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details).toHaveProperty('env');
    expect(health.details).toHaveProperty('keysLoaded');
  });

  it('load() does NOT leak non-schema env vars into get() store', async () => {
    process.env.SECRET_API_KEY = 'super-secret-value';
    process.env.DATABASE_PASSWORD = 'db-password-123';
    const adapter = new EnvConfigAdapter();
    await adapter.load(testSchema);
    expect(adapter.get('NODE_ENV')).toBe('test');
    expect(adapter.get('PORT')).toBe(4000);
    expect(adapter.get('DATABASE_URL')).toBe('postgres://localhost:5432/test');
    expect(adapter.get('SECRET_API_KEY')).toBeUndefined();
    expect(adapter.get('DATABASE_PASSWORD')).toBeUndefined();
    delete process.env.SECRET_API_KEY;
    delete process.env.DATABASE_PASSWORD;
  });

  it('accepts custom dotenv path in constructor', () => {
    const options: EnvConfigOptions = { dotenvPath: '/custom/.env' };
    const adapter = new EnvConfigAdapter(options);
    expect(adapter).toBeDefined();
  });

  it('start() calls process.loadEnvFile() instead of dotenv', async () => {
    const spy = vi.spyOn(process, 'loadEnvFile');
    const options: EnvConfigOptions = { dotenvPath: '/test/.env' };
    const adapter = new EnvConfigAdapter(options);
    await adapter.start();
    expect(spy).toHaveBeenCalledWith('/test/.env');
    spy.mockRestore();
  });

  it('reload() calls process.loadEnvFile()', async () => {
    const spy = vi.spyOn(process, 'loadEnvFile');
    const options: EnvConfigOptions = { dotenvPath: '/test/.env' };
    const adapter = new EnvConfigAdapter(options);
    await adapter.reload();
    expect(spy).toHaveBeenCalledWith('/test/.env');
    spy.mockRestore();
  });

  it('start() without dotenvPath uses default .env', async () => {
    const spy = vi.spyOn(process, 'loadEnvFile');
    const adapter = new EnvConfigAdapter();
    await adapter.start();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('start() handles missing file gracefully', async () => {
    const spy = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const adapter = new EnvConfigAdapter({ dotenvPath: '/nonexistent/.env' });
    await expect(adapter.start()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
