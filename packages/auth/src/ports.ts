/**
 * AuthManager port interface — JWT authentication and token management.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/auth/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { JwtPayload, TokenConfig } from './types.js';

/**
 * Authentication manager port for JWT token operations.
 *
 * Provides token signing, verification, decoding, and refresh.
 * Supports HS256 and RS256 algorithms via adapter implementations.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface AuthManager extends AsyncLifecycle {
  /**
   * Sign a JWT token with the given payload.
   *
   * @param payload - The claims to embed in the token (must include `sub`).
   * @param config - Optional token configuration (secret, algorithm, expiry).
   *                 Falls back to adapter defaults if not provided.
   * @returns A signed JWT string.
   * @throws AuthError if signing fails.
   */
  sign(
    payload: JwtPayload,
    config?: Partial<TokenConfig>,
  ): Promise<string>;

  /**
   * Verify a JWT token and return its payload.
   *
   * Validates the signature, expiry (`exp`), issuer (`iss`),
   * and audience (`aud`) claims against the provided configuration.
   *
   * @param token - The JWT string to verify.
   * @param config - Optional verification configuration (secret, issuer, audience).
   * @returns The verified token payload.
   * @throws TokenExpiredError if the token has expired.
   * @throws TokenInvalidError if the token is malformed or signature is invalid.
   * @throws TokenVerificationError if claims validation fails.
   */
  verify(
    token: string,
    config?: Partial<TokenConfig>,
  ): Promise<JwtPayload>;

  /**
   * Decode a JWT token WITHOUT verification.
   *
   * Returns the payload claims without validating the signature,
   * expiry, or any other claims. Useful for inspecting token
   * contents (e.g., reading the `sub` claim) before verification.
   *
   * @param token - The JWT string to decode.
   * @returns The decoded payload claims.
   * @throws TokenInvalidError if the token is not valid base64url JSON.
   */
  decode(token: string): JwtPayload;

  /**
   * Refresh an existing token and return a new one.
   *
   * Validates the refresh token, extracts the original payload,
   * and issues a new access token with a fresh expiry.
   *
   * @param token - The existing (refresh) token.
   * @returns A new signed JWT string.
   * @throws TokenExpiredError if the refresh token has expired.
   * @throws TokenInvalidError if the refresh token is invalid.
   */
  refresh(token: string): Promise<string>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const AUTH_PORT_VERSION = '0.1.0';
