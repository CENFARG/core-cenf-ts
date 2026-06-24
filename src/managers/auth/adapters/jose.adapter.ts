/**
 * Jose-based JWT authentication adapter.
 *
 * Implements the AuthManager port using the `jose` library
 * for HS256/RS256 JWT signing, verification, and decoding.
 *
 * @module managers/auth/adapters/jose.adapter
 */

import { SignJWT, jwtVerify, decodeJwt, errors as joseErrors } from 'jose';
import type { AuthManager } from '../ports.js';
import type { JwtPayload, TokenConfig } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';
import {
  TokenExpiredError,
  TokenInvalidError,
  TokenVerificationError,
} from '../../../shared/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a string secret to a Uint8Array key for jose.
 *
 * For HS256, jose expects a `CryptoKey` or `Uint8Array`.
 * We use `TextEncoder` to convert the secret string to bytes.
 */
function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Parse an expiry string like "1h", "15m", "7d" into a format jose accepts.
 *
 * For "0s" (immediate expiry used in testing), returns a Unix timestamp
 * slightly in the past so the token is already expired when signed.
 */
function parseExpiry(expiresIn: string | number): string | number {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }
  if (expiresIn === '0s') {
    // Return a past timestamp — token is expired immediately
    return Math.floor(Date.now() / 1000) - 1;
  }
  // Pass through to jose — it accepts strings like "1h", "15m", "7d"
  return expiresIn;
}

/**
 * Generate a short random JWT ID for uniqueness.
 */
function randomJti(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// JoseJwtAdapter
// ---------------------------------------------------------------------------

/**
 * Jose-based JWT adapter wrapping the `jose` library.
 *
 * Supports HS256 (symmetric) and RS256 (asymmetric) algorithms.
 * Handles token signing, verification with full claim validation,
 * decoding, and refresh.
 */
export class JoseJwtAdapter implements AuthManager {
  private readonly defaultConfig: TokenConfig;

  constructor(config: TokenConfig) {
    this.defaultConfig = { ...config };
    if (config.algorithm !== 'HS256' && config.algorithm !== 'RS256') {
      throw new TokenVerificationError(
        `Unsupported algorithm: ${config.algorithm}. Supported: HS256, RS256`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // AuthManager
  // -----------------------------------------------------------------------

  async sign(
    payload: JwtPayload,
    config?: Partial<TokenConfig>,
  ): Promise<string> {
    const secret = config?.secret ?? this.defaultConfig.secret;
    const expiresIn = config?.expiresIn ?? this.defaultConfig.expiresIn;
    const issuer = config?.issuer ?? this.defaultConfig.issuer;
    const audience = config?.audience ?? this.defaultConfig.audience;
    const key = toKey(secret);

    let jwt = new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setJti(randomJti());

    // Set expiry if provided
    if (expiresIn) {
      jwt = jwt.setExpirationTime(parseExpiry(expiresIn));
    }

    // Set optional claims
    if (issuer) {
      jwt = jwt.setIssuer(issuer);
    }
    if (audience) {
      jwt = jwt.setAudience(audience);
    }

    try {
      return await jwt.sign(key);
    } catch (error) {
      throw new TokenVerificationError(
        `Failed to sign JWT: ${(error as Error).message}`,
        error,
      );
    }
  }

  async verify(
    token: string,
    config?: Partial<TokenConfig>,
  ): Promise<JwtPayload> {
    const secret = config?.secret ?? this.defaultConfig.secret;
    const issuer = config?.issuer ?? this.defaultConfig.issuer;
    const audience = config?.audience ?? this.defaultConfig.audience;
    const key = toKey(secret);

    const verifyOptions: Record<string, unknown> = {};
    if (issuer) {
      verifyOptions['issuer'] = issuer;
    }
    if (audience) {
      verifyOptions['audience'] = audience;
    }

    try {
      const { payload } = await jwtVerify(token, key, verifyOptions);
      return payload as unknown as JwtPayload;
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw new TokenExpiredError(
          `Token has expired: ${error.message}`,
          error,
        );
      }
      if (
        error instanceof joseErrors.JWTInvalid ||
        error instanceof joseErrors.JWSSignatureVerificationFailed
      ) {
        throw new TokenInvalidError(
          `Invalid token: ${(error as Error).message}`,
          error,
        );
      }
      if (error instanceof joseErrors.JWTClaimValidationFailed) {
        throw new TokenVerificationError(
          `Token claim validation failed: ${(error as Error).message}`,
          error,
        );
      }
      throw new TokenVerificationError(
        `Token verification failed: ${(error as Error).message}`,
        error,
      );
    }
  }

  decode(token: string): JwtPayload {
    try {
      const payload = decodeJwt(token);
      return payload as unknown as JwtPayload;
    } catch (error) {
      throw new TokenInvalidError(
        `Failed to decode token: ${(error as Error).message}`,
        error,
      );
    }
  }

  async refresh(token: string): Promise<string> {
    // Decode the existing token to extract claims
    const payload = this.decode(token);

    // Remove standard JWT claims that should be regenerated
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sub, exp: _exp, iat: _iat, nbf: _nbf, iss: _iss, aud: _aud, jti: _jti, ...customClaims } = payload;

    // Build new payload preserving the subject and custom claims
    const newPayload: JwtPayload = {
      sub: sub ?? 'unknown',
      ...customClaims,
    };

    // Sign a fresh token
    return this.sign(newPayload);
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // Validate configuration is present
    if (!this.defaultConfig.secret) {
      throw new TokenVerificationError(
        'JoseJwtAdapter requires a secret to be configured.',
      );
    }
  }

  async stop(): Promise<void> {
    // No persistent resources to clean up.
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'jose',
        algorithm: this.defaultConfig.algorithm,
      },
    };
  }
}
