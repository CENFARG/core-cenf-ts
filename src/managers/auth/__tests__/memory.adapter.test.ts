import { describe, it, expect } from 'vitest';
import { MemoryAuthAdapter } from '../adapters/memory.adapter.js';
import type { AuthManager } from '../ports.js';
import type { JwtPayload, TokenConfig } from '../types.js';

const defaultConfig: TokenConfig = {
  secret: 'test-secret',
  algorithm: 'HS256',
  expiresIn: '1h',
};

describe('MemoryAuthAdapter', () => {
  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------
  describe('lifecycle', () => {
    it('start() resolves', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const health = await adapter.health();
      expect(health.status).toBe('healthy');
      expect(health.details.adapter).toBe('memory');
    });

    it('health() reports algorithm', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const health = await adapter.health();
      expect(health.details.algorithm).toBe('HS256');
    });
  });

  // -----------------------------------------------------------------------
  // sign / verify roundtrip
  // -----------------------------------------------------------------------
  describe('sign and verify', () => {
    it('sign() returns a string token', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token = await adapter.sign({ sub: 'user-1' });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('verify() returns the original payload', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const payload: JwtPayload = { sub: 'user-1', role: 'admin' };
      const token = await adapter.sign(payload);
      const verified = await adapter.verify(token);
      expect(verified.sub).toBe('user-1');
      expect(verified.role).toBe('admin');
    });

    it('verify() returns different payloads for different tokens', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token1 = await adapter.sign({ sub: 'user-1' });
      const token2 = await adapter.sign({ sub: 'user-2' });
      const p1 = await adapter.verify(token1);
      const p2 = await adapter.verify(token2);
      expect(p1.sub).toBe('user-1');
      expect(p2.sub).toBe('user-2');
    });

    it('sign with optional config overrides default', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token = await adapter.sign(
        { sub: 'user-1' },
        { expiresIn: '30m' },
      );
      const verified = await adapter.verify(token);
      expect(verified.sub).toBe('user-1');
    });

    it('verify with optional config overrides default', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token = await adapter.sign({ sub: 'user-1' });
      const verified = await adapter.verify(token, {
        secret: 'test-secret',
      });
      expect(verified.sub).toBe('user-1');
    });
  });

  // -----------------------------------------------------------------------
  // decode
  // -----------------------------------------------------------------------
  describe('decode', () => {
    it('decode() returns payload without verification', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token = await adapter.sign({ sub: 'user-1', role: 'admin' });
      const payload = adapter.decode(token);
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('admin');
    });

    it('decode() works even for tokens that would fail verify', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token = await adapter.sign({ sub: 'user-1' });
      // Decode should work even without proper verification config
      const payload = adapter.decode(token);
      expect(payload.sub).toBe('user-1');
    });

    it('decode() returns extra claims', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const token = await adapter.sign({
        sub: 'user-1',
        role: 'admin',
        exp: 9999999999,
      });
      const payload = adapter.decode(token);
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('admin');
      expect(payload.exp).toBe(9999999999);
    });
  });

  // -----------------------------------------------------------------------
  // refresh
  // -----------------------------------------------------------------------
  describe('refresh', () => {
    it('refresh() returns a new token', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const original = await adapter.sign({ sub: 'user-1' });
      const refreshed = await adapter.refresh(original);
      expect(typeof refreshed).toBe('string');
      expect(refreshed).not.toBe(original);
    });

    it('refreshed token is verifiable', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const original = await adapter.sign({ sub: 'user-1' });
      const refreshed = await adapter.refresh(original);
      const payload = await adapter.verify(refreshed);
      expect(payload.sub).toBe('user-1');
    });

    it('refresh preserves original claims', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const original = await adapter.sign({
        sub: 'user-1',
        role: 'admin',
      });
      const refreshed = await adapter.refresh(original);
      const payload = await adapter.verify(refreshed);
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('admin');
    });
  });

  // -----------------------------------------------------------------------
  // Port contract compliance
  // -----------------------------------------------------------------------
  describe('AuthManager contract', () => {
    it('implements AuthManager port', () => {
      const adapter: AuthManager = new MemoryAuthAdapter(defaultConfig);
      expect(adapter).toBeDefined();
    });

    it('sign/verify roundtrip preserves all custom claims', async () => {
      const adapter = new MemoryAuthAdapter(defaultConfig);
      const claims: JwtPayload = {
        sub: 'user-42',
        role: 'admin',
        tenant: 'acme',
        permissions: ['read', 'write'],
      };
      const token = await adapter.sign(claims);
      const verified = await adapter.verify(token);
      expect(verified.sub).toBe('user-42');
      expect(verified.role).toBe('admin');
      expect(verified.tenant).toBe('acme');
      expect(verified.permissions).toEqual(['read', 'write']);
    });

    it('sign with different secrets produces different tokens', async () => {
      const adapter1 = new MemoryAuthAdapter({
        ...defaultConfig,
        secret: 'secret-a',
      });
      const adapter2 = new MemoryAuthAdapter({
        ...defaultConfig,
        secret: 'secret-b',
      });
      const token1 = await adapter1.sign({ sub: 'user-1' });
      const token2 = await adapter2.sign({ sub: 'user-1' });
      expect(token1).not.toBe(token2);
    });
  });
});
