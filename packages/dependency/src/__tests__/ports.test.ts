import { describe, it, expect } from 'vitest';
import {
  DEPENDENCY_PORT_VERSION,
  type DependencyManager,
} from '../ports.js';
import type {
  DependencyToken,
  OverrideEntry,
} from '../types.js';

// ---------------------------------------------------------------------------
// Test implementation of DependencyManager for contract verification
// ---------------------------------------------------------------------------

class TestDependencyManager implements DependencyManager {
  private overrides = new Map<string, unknown>();

  async resolveClass(_module: string, className: string): Promise<any> {
    // For tests, return a simple mock based on className
    const key = `${_module}:${className}`;
    const override = this.overrides.get(key);
    if (override) return override;

    if (className === 'Logger') {
      return { log: (msg: string) => msg };
    }
    if (className === 'Database') {
      return { query: async (sql: string) => [sql] };
    }
    throw new Error(
      `No dependency registered for module=${_module}, class=${className}`,
    );
  }

  async registerOverride(
    token: DependencyToken,
    implementation: any,
  ): Promise<void> {
    const key = `${token.scope ?? '*'}:${token.name}`;
    this.overrides.set(key, implementation);
  }
}

// ---------------------------------------------------------------------------
// DependencyManager port contract
// ---------------------------------------------------------------------------

describe('DependencyManager port', () => {
  it('exports a runtime version constant', () => {
    expect(DEPENDENCY_PORT_VERSION).toBe('0.1.0');
  });

  it('has resolveClass/registerOverride methods', () => {
    const mgr: DependencyManager = new TestDependencyManager();
    expect(mgr.resolveClass).toBeDefined();
    expect(mgr.registerOverride).toBeDefined();
  });

  it('resolveClass() returns a dependency instance', async () => {
    const mgr = new TestDependencyManager();
    const logger = await mgr.resolveClass('logging', 'Logger');
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
  });

  it('resolveClass() throws for unknown classes', async () => {
    const mgr = new TestDependencyManager();
    await expect(
      mgr.resolveClass('unknown', 'NonExistent'),
    ).rejects.toThrow();
  });

  it('registerOverride() stores an implementation', async () => {
    const mgr = new TestDependencyManager();
    const mockImpl = { custom: true };
    await mgr.registerOverride(
      { name: 'Database', scope: 'app' },
      mockImpl,
    );
    const resolved = await mgr.resolveClass('app', 'Database');
    expect(resolved).toBe(mockImpl);
  });

  it('registerOverride() overrides previously resolvable classes', async () => {
    const mgr = new TestDependencyManager();

    const original = await mgr.resolveClass('logging', 'Logger');
    expect(original.log).toBeDefined();

    const mockLogger = { log: () => 'mocked' };
    await mgr.registerOverride(
      { name: 'Logger', scope: 'logging' },
      mockLogger,
    );

    const resolved = await mgr.resolveClass('logging', 'Logger');
    expect(resolved.log()).toBe('mocked');
  });
});

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

describe('Dependency types', () => {
  it('DependencyToken has required fields', () => {
    const token: DependencyToken = {
      name: 'CacheManager',
      scope: 'infra',
    };
    expect(token.name).toBe('CacheManager');
    expect(token.scope).toBe('infra');
  });

  it('DependencyToken scope is optional', () => {
    const token: DependencyToken = {
      name: 'Logger',
    };
    expect(token.name).toBe('Logger');
    expect(token.scope).toBeUndefined();
  });

  it('OverrideEntry has all fields', () => {
    const entry: OverrideEntry = {
      token: { name: 'Database', scope: 'app' },
      implementation: { query: async () => [] },
      createdAt: new Date('2025-06-01'),
    };
    expect(entry.token.name).toBe('Database');
    expect(entry.token.scope).toBe('app');
    expect(typeof entry.implementation.query).toBe('function');
    expect(entry.createdAt).toEqual(new Date('2025-06-01'));
  });
});
