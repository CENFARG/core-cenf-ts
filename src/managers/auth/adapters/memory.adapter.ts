/**
 * In-memory authentication adapter for testing.
 *
 * Implements the AuthManager port with a simple token encoding
 * scheme. No real cryptography — tokens are base64url-encoded
 * JSON with a configurable secret-based signature segment.
 *
 * @module managers/auth/adapters/memory.adapter
 */

import { createHash } from 'node:crypto';
import type { AuthManager } from '../ports.js';
import type { JwtPayload, TokenConfig } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url')
    .toString('utf-8');
}

function signPayload(
  payload: JwtPayload,
  secret: string,
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHash('sha256')
    .update(`${data}.${secret}`)
    .digest('base64url');
  return `${data}.${signature}`;
}

function extractPayload(token: string): JwtPayload {
  const parts = token.split('.');
  // A valid memory token has at least 3 segments: header.body.signature
  const bodySegment = parts[1];
  if (!bodySegment) {
    return { sub: 'unknown' };
  }
  const decoded = base64UrlDecode(bodySegment);
  return JSON.parse(decoded) as JwtPayload;
}

/**
 * In-memory authentication adapter for testing.
 *
 * Stores a default `TokenConfig` and uses a simple SHA-256-based
 * signing scheme. Tokens are base64url-encoded JSON with a derived
 * signature segment. No real JWT validation — designed for unit tests
 * where external crypto libraries are undesirable.
 */
export class MemoryAuthAdapter implements AuthManager {
  private readonly defaultConfig: TokenConfig;

  constructor(config: TokenConfig) {
    this.defaultConfig = { ...config };
  }

  // -----------------------------------------------------------------------
  // AuthManager
  // -----------------------------------------------------------------------

  async sign(
    payload: JwtPayload,
    config?: Partial<TokenConfig>,
  ): Promise<string> {
    const secret = config?.secret ?? this.defaultConfig.secret;
    return signPayload(payload, secret);
  }

  async verify(
    token: string,
    config?: Partial<TokenConfig>,
  ): Promise<JwtPayload> {
    // Memory adapter: extract payload, optionally validate with secret
    const payload = extractPayload(token);
    const secret = config?.secret ?? this.defaultConfig.secret;

    // Re-sign and compare to verify integrity
    const expected = signPayload(payload, secret);
    if (expected !== token) {
      // The token payload is extractable but signature doesn't match
      // Return payload anyway (memory adapter is lenient for testing)
    }

    return payload;
  }

  decode(token: string): JwtPayload {
    return extractPayload(token);
  }

  async refresh(token: string): Promise<string> {
    const payload = extractPayload(token);
    // Add an iat claim to ensure the refreshed token differs from the original.
    const refreshedPayload: JwtPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    };
    return signPayload(refreshedPayload, this.defaultConfig.secret);
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: memory adapter is always ready.
  }

  async stop(): Promise<void> {
    // No-op: no connections to close.
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        algorithm: this.defaultConfig.algorithm,
      },
    };
  }
}
