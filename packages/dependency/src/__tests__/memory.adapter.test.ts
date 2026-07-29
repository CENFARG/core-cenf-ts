import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDependencyAdapter } from '../adapters/memory.adapter.js';
import type { DependencyManager } from '../ports.js';
import type { DependencyToken } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const token = (name: string, scope?: string): DependencyToken => ({
  name,
  ...(scope ? { scope } : {}),
});

// ---------------------------------------------------------------------------
// InMemoryDependencyAdapter
// ---------------------------------------------------------------------------

describe('InMemoryDependencyAdapter', () => {
  let deps: DependencyManager;

  beforeEach(() => {
    deps = new InMemoryDependencyAdapter();
  });

  // -----------------------------------------------------------------------
  // registerOverride
  // -----------------------------------------------------------------------

  describe('registerOverride', () => {
    it('stores an implementation for a token with scope', async () => {
      const impl = { send: () => 'sent' };
      await deps.registerOverride(token('EmailService', 'notifications'), impl);
      const resolved = await deps.resolveClass('notifications', 'EmailService');
      expect(resolved).toBe(impl);
    });

    it('stores an implementation for a token without scope', async () => {
      const impl = { value: 42 };
      await deps.registerOverride(token('Config'), impl);
      // Matches scope-less token
      const resolved = await deps.resolveClass('any-module', 'Config');
      expect(resolved).toBe(impl);
    });
  });

  // -----------------------------------------------------------------------
  // resolveClass
  // -----------------------------------------------------------------------

  describe('resolveClass', () => {
    it('returns previously registered implementation for scoped token', async () => {
      const impl = { process: () => 'done' };
      await deps.registerOverride(token('JobRunner', 'workers'), impl);
      const resolved = await deps.resolveClass('workers', 'JobRunner');
      expect(resolved).toBe(impl);
    });

    it('returns previously registered implementation for unscoped token', async () => {
      const impl = { get: () => 'value' };
      await deps.registerOverride(token('Cache'), impl);
      const resolved = await deps.resolveClass('module-x', 'Cache');
      expect(resolved).toBe(impl);
    });

    it('scoped override takes priority over unscoped', async () => {
      const generic = { type: 'generic' };
      const specific = { type: 'specific' };

      await deps.registerOverride(token('Logger'), generic);
      await deps.registerOverride(token('Logger', 'app'), specific);

      const fromApp = await deps.resolveClass('app', 'Logger');
      expect(fromApp).toBe(specific);

      const fromOther = await deps.resolveClass('other', 'Logger');
      expect(fromOther).toBe(generic);
    });

    it('throws when no override is registered', async () => {
      await expect(
        deps.resolveClass('unknown-module', 'UnknownClass'),
      ).rejects.toThrow(/No override registered/i);
    });

    it('throws when module mismatch but same name exists', async () => {
      await deps.registerOverride(token('Logger', 'app'), {});
      await expect(
        deps.resolveClass('different-module', 'Logger'),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Override replacement
  // -----------------------------------------------------------------------

  describe('override replacement', () => {
    it('registering the same token replaces the old override', async () => {
      const oldImpl = { version: 'v1' };
      const newImpl = { version: 'v2' };

      await deps.registerOverride(token('Service', 'app'), oldImpl);
      await deps.registerOverride(token('Service', 'app'), newImpl);

      const resolved = await deps.resolveClass('app', 'Service');
      expect(resolved).toBe(newImpl);
      expect(resolved).not.toBe(oldImpl);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple tokens
  // -----------------------------------------------------------------------

  describe('multiple tokens', () => {
    it('resolves different tokens independently', async () => {
      const db = { query: () => [] };
      const cache = { get: () => 'val' };
      const logger = { log: () => {} };

      await deps.registerOverride(token('Database', 'app'), db);
      await deps.registerOverride(token('Cache', 'app'), cache);
      await deps.registerOverride(token('Logger', 'app'), logger);

      expect(await deps.resolveClass('app', 'Database')).toBe(db);
      expect(await deps.resolveClass('app', 'Cache')).toBe(cache);
      expect(await deps.resolveClass('app', 'Logger')).toBe(logger);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty module string', async () => {
      const impl = { fallback: true };
      await deps.registerOverride(token('Fallback'), impl);
      const resolved = await deps.resolveClass('', 'Fallback');
      expect(resolved).toBe(impl);
    });

    it('handles special characters in token names', async () => {
      const impl = { special: true };
      await deps.registerOverride(
        token('my-service@v2', 'namespace'),
        impl,
      );
      const resolved = await deps.resolveClass('namespace', 'my-service@v2');
      expect(resolved).toBe(impl);
    });
  });
});
