/**
 * AuthManager-specific types.
 *
 * Types for JWT payloads, token configuration, and algorithms.
 *
 * @module managers/auth/types
 */

// ---------------------------------------------------------------------------
// JWT Payload — claims embedded in a token
// ---------------------------------------------------------------------------

/**
 * JWT payload claims.
 *
 * The `sub` (subject) claim is required. Additional claims
 * (e.g., `role`, `exp`, `iat`, `iss`, `aud`) can be included
 * via the index signature.
 */
export interface JwtPayload {
  /** Subject — the principal this token represents. */
  sub: string;
  /** Additional claims (e.g., role, permissions, custom data). */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Token configuration — signing and verification parameters
// ---------------------------------------------------------------------------

/**
 * Configuration for JWT token operations.
 *
 * Used by both `sign()` and `verify()` to control algorithm,
 * secret, expiry, issuer, and audience.
 */
export interface TokenConfig {
  /** The signing/verification secret (HS256) or private key (RS256). */
  secret: string;

  /** The signing algorithm. */
  algorithm: 'HS256' | 'RS256';

  /**
   * Token expiry duration.
   *
   * Accepts a number (seconds) or a string (e.g., "15m", "1h", "7d").
   * Follows the `jose` library expiry format.
   */
  expiresIn: string | number;

  /** Expected token issuer (validated during verification). */
  issuer?: string;

  /** Expected token audience (validated during verification). */
  audience?: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const AUTH_TYPES_VERSION = '0.1.0';
