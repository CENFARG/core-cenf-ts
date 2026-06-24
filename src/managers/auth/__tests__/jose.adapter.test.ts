import { describe, it, expect } from 'vitest';
import { JoseJwtAdapter } from '../adapters/jose.adapter.js';
import type { AuthManager } from '../ports.js';
import type { JwtPayload, TokenConfig } from '../types.js';
import { TokenExpiredError } from '../../../shared/errors.js';

const hs256Config: TokenConfig = {
  secret: 'a-very-secret-key-for-testing-purposes-only',
  algorithm: 'HS256',
  expiresIn: '1h',
};

describe('JoseJwtAdapter (HS256)', () => {
  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------
  describe('lifecycle', () => {
    it('start() resolves', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy with HS256', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const health = await adapter.health();
      expect(health.status).toBe('healthy');
      expect(health.details.algorithm).toBe('HS256');
    });
  });

  // -----------------------------------------------------------------------
  // sign and verify — happy path
  // -----------------------------------------------------------------------
  describe('sign and verify', () => {
    it('sign() returns a valid JWT string (3 segments)', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const token = await adapter.sign({ sub: 'user-1' });
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      // Header, payload, signature
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
      expect(parts[2]).toBeTruthy();
    });

    it('sign/verify roundtrip preserves claims', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const token = await adapter.sign({ sub: 'user-1', role: 'admin' });
      const payload = await adapter.verify(token);
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('admin');
    });

    it('sign with custom expiresIn', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const token = await adapter.sign(
        { sub: 'user-1' },
        { expiresIn: '30m' },
      );
      const payload = await adapter.verify(token);
      expect(payload.sub).toBe('user-1');
    });

    it('sign with issuer sets iss claim', async () => {
      const adapter = new JoseJwtAdapter({
        ...hs256Config,
        issuer: 'cenf-auth',
      });
      const token = await adapter.sign({ sub: 'user-1' });
      const payload = await adapter.verify(token);
      expect(payload.iss).toBe('cenf-auth');
    });

    it('sign with audience sets aud claim', async () => {
      const adapter = new JoseJwtAdapter({
        ...hs256Config,
        audience: 'cenf-api',
      });
      const token = await adapter.sign({ sub: 'user-1' });
      const payload = await adapter.verify(token);
      expect(payload.aud).toBe('cenf-api');
    });

    it('verify with wrong secret throws', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const token = await adapter.sign({ sub: 'user-1' });
      await expect(
        adapter.verify(token, { secret: 'wrong-secret' }),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // expired token
  // -----------------------------------------------------------------------
  describe('expired token', () => {
    it('verify rejects expired token with TokenExpiredError', async () => {
      const adapter = new JoseJwtAdapter({
        ...hs256Config,
        expiresIn: '0s',
      });
      // Sign with immediate expiry
      const token = await adapter.sign({ sub: 'user-1' }, { expiresIn: '0s' });
      // Small delay to ensure expiration
      await new Promise((r) => setTimeout(r, 100));
      await expect(adapter.verify(token)).rejects.toThrow(TokenExpiredError);
    });

    it('expired token error includes the expiry information', async () => {
      const adapter = new JoseJwtAdapter({
        ...hs256Config,
        expiresIn: '0s',
      });
      const token = await adapter.sign({ sub: 'user-1' }, { expiresIn: '0s' });
      await new Promise((r) => setTimeout(r, 100));
      try {
        await adapter.verify(token);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TokenExpiredError);
        expect((err as Error).message).toContain('expired');
      }
    });
  });

  // -----------------------------------------------------------------------
  // decode
  // -----------------------------------------------------------------------
  describe('decode', () => {
    it('decode() returns payload without verification', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const token = await adapter.sign({
        sub: 'user-1',
        role: 'admin',
      });
      const payload = adapter.decode(token);
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('admin');
    });

    it('decode() works for expired tokens', async () => {
      const adapter = new JoseJwtAdapter({
        ...hs256Config,
        expiresIn: '0s',
      });
      const token = await adapter.sign({ sub: 'user-1' }, { expiresIn: '0s' });
      await new Promise((r) => setTimeout(r, 100));
      // Decode should work even though token is expired
      const payload = adapter.decode(token);
      expect(payload.sub).toBe('user-1');
    });
  });

  // -----------------------------------------------------------------------
  // refresh
  // -----------------------------------------------------------------------
  describe('refresh', () => {
    it('refresh() returns a new token', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const original = await adapter.sign({ sub: 'user-1' });
      const refreshed = await adapter.refresh(original);
      expect(refreshed).not.toBe(original);
    });

    it('refreshed token is verifiable', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const original = await adapter.sign({ sub: 'user-1' });
      const refreshed = await adapter.refresh(original);
      const payload = await adapter.verify(refreshed);
      expect(payload.sub).toBe('user-1');
    });

    it('refreshed token preserves custom claims', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const original = await adapter.sign({
        sub: 'user-1',
        role: 'admin',
        tenant: 'acme',
      });
      const refreshed = await adapter.refresh(original);
      const payload = await adapter.verify(refreshed);
      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('admin');
      expect(payload.tenant).toBe('acme');
    });
  });

  // -----------------------------------------------------------------------
  // Port contract compliance
  // -----------------------------------------------------------------------
  describe('AuthManager contract', () => {
    it('implements AuthManager port', () => {
      const adapter: AuthManager = new JoseJwtAdapter(hs256Config);
      expect(adapter).toBeDefined();
    });

    it('sign/verify with complex payload', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const claims: JwtPayload = {
        sub: 'user-42',
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
      };
      const token = await adapter.sign(claims);
      const verified = await adapter.verify(token);
      expect(verified.sub).toBe('user-42');
      expect(verified.role).toBe('admin');
      expect(verified.permissions).toEqual(['read', 'write', 'delete']);
    });

    it('verify throws on tampered token', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      const token = await adapter.sign({ sub: 'user-1' });
      const tampered = token.slice(0, -5) + 'xxxxx';
      await expect(adapter.verify(tampered)).rejects.toThrow();
    });

    it('verify throws on garbage input', async () => {
      const adapter = new JoseJwtAdapter(hs256Config);
      await expect(adapter.verify('not-a-token')).rejects.toThrow();
    });
  });
});
