import { describe, it, expect } from 'vitest';
import { AUTH_PORT_VERSION, type AuthManager } from '../ports.js';
import type { JwtPayload, TokenConfig } from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

/** Test implementation of AuthManager for contract verification. */
class TestAuthManager implements AuthManager {
  private secrets = new Map<string, string>();

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async sign(
    payload: JwtPayload,
    _config?: Partial<TokenConfig>,
  ): Promise<string> {
    return `signed.${payload.sub}.token`;
  }

  async verify(
    token: string,
    _config?: Partial<TokenConfig>,
  ): Promise<JwtPayload> {
    const parts = token.split('.');
    return { sub: parts[1] ?? 'unknown' };
  }

  decode(token: string): JwtPayload {
    const parts = token.split('.');
    return { sub: parts[1] ?? 'unknown' };
  }

  async refresh(token: string): Promise<string> {
    return `refreshed.${token}`;
  }
}

// ---------------------------------------------------------------------------
// AuthManager port contract
// ---------------------------------------------------------------------------
describe('AuthManager port', () => {
  it('exports a runtime version constant', () => {
    expect(AUTH_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: AuthManager = new TestAuthManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestAuthManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('sign() returns a string token', async () => {
    const mgr = new TestAuthManager();
    const token = await mgr.sign({ sub: 'user-1' });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('sign() accepts optional TokenConfig', async () => {
    const mgr = new TestAuthManager();
    const token = await mgr.sign(
      { sub: 'user-1' },
      { secret: 'test-secret', algorithm: 'HS256', expiresIn: '1h' },
    );
    expect(typeof token).toBe('string');
  });

  it('verify() returns the payload for a valid token', async () => {
    const mgr = new TestAuthManager();
    const token = await mgr.sign({ sub: 'user-1' });
    const payload = await mgr.verify(token);
    expect(payload.sub).toBe('user-1');
  });

  it('verify() accepts optional TokenConfig', async () => {
    const mgr = new TestAuthManager();
    const token = await mgr.sign({ sub: 'user-1' });
    const payload = await mgr.verify(token, { secret: 'test-secret' });
    expect(payload.sub).toBe('user-1');
  });

  it('decode() returns payload without verification', () => {
    const mgr = new TestAuthManager();
    const payload = mgr.decode('header.payload.signature');
    expect(payload.sub).toBe('payload');
  });

  it('decode() does not throw on malformed input', () => {
    const mgr = new TestAuthManager();
    // The test implementation is lenient; the real adapter validates format.
    expect(() => mgr.decode('garbage')).not.toThrow();
  });

  it('refresh() returns a new token string', async () => {
    const mgr = new TestAuthManager();
    const oldToken = await mgr.sign({ sub: 'user-1' });
    const newToken = await mgr.refresh(oldToken);
    expect(typeof newToken).toBe('string');
    expect(newToken).not.toBe(oldToken);
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestAuthManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------
describe('Auth types', () => {
  it('JwtPayload has sub and allows extra properties', () => {
    const payload: JwtPayload = {
      sub: 'user-1',
      role: 'admin',
      exp: 1234567890,
    };
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('admin');
    expect(payload.exp).toBe(1234567890);
  });

  it('TokenConfig has required secret, algorithm, expiresIn', () => {
    const config: TokenConfig = {
      secret: 'my-secret',
      algorithm: 'HS256',
      expiresIn: '1h',
    };
    expect(config.secret).toBe('my-secret');
    expect(config.algorithm).toBe('HS256');
    expect(config.expiresIn).toBe('1h');
  });

  it('TokenConfig supports optional issuer and audience', () => {
    const config: TokenConfig = {
      secret: 'my-secret',
      algorithm: 'HS256',
      expiresIn: 3600,
      issuer: 'cenf',
      audience: 'api',
    };
    expect(config.issuer).toBe('cenf');
    expect(config.audience).toBe('api');
  });

  it('TokenConfig expiresIn accepts string or number', () => {
    const stringConfig: TokenConfig = {
      secret: 's',
      algorithm: 'HS256',
      expiresIn: '15m',
    };
    const numberConfig: TokenConfig = {
      secret: 's',
      algorithm: 'HS256',
      expiresIn: 900,
    };
    expect(stringConfig.expiresIn).toBe('15m');
    expect(numberConfig.expiresIn).toBe(900);
  });

  it('TokenConfig algorithm accepts HS256 or RS256', () => {
    const hs: TokenConfig = {
      secret: 's',
      algorithm: 'HS256',
      expiresIn: '1h',
    };
    const rs: TokenConfig = {
      secret: 's',
      algorithm: 'RS256',
      expiresIn: '1h',
    };
    expect(hs.algorithm).toBe('HS256');
    expect(rs.algorithm).toBe('RS256');
  });
});
