# AuthManager Specification

## Purpose

Handles JWT token generation, verification, and rotation. Supports HS256 (symmetric) and RS256 (asymmetric via JWKS) algorithms.

## Port Interface

```typescript
interface IAuthManager {
  generateToken(payload: TokenPayload, options?: TokenOptions): Promise<string>;
  verifyToken<T extends TokenPayload>(token: string, options?: VerifyOptions): Promise<T>;
  decodeToken<T extends TokenPayload>(token: string): T;
  refreshToken(refreshToken: string): Promise<TokenPair>;
}

interface TokenPayload { sub: string; [key: string]: unknown }
interface TokenOptions { expiresIn?: string | number; issuer?: string; audience?: string }
interface VerifyOptions { issuer?: string; audience?: string }
interface TokenPair { accessToken: string; refreshToken: string; expiresAt: number }
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `JoseAuthAdapter` | Wraps `jose` library for JWT operations (HS256/RS256) |
| `MemoryAuthAdapter` | In-memory token store for testing |

## Error Types

- `TokenExpiredError` — Token `exp` claim is in the past
- `TokenInvalidError` — Malformed token or invalid signature
- `TokenVerificationError` — JWKS fetch failed, issuer/audience mismatch

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_AUTH_ALGORITHM` | `HS256\|RS256` | `HS256` | Signing algorithm |
| `CENF_AUTH_SECRET` | `string` | `""` | HS256 signing key |
| `CENF_AUTH_JWKS_URL` | `string` | `""` | RS256 JWKS endpoint |
| `CENF_AUTH_ISSUER` | `string` | `""` | Expected token issuer |
| `CENF_AUTH_AUDIENCE` | `string` | `""` | Expected token audience |
| `CENF_AUTH_ACCESS_TTL` | `string` | `15m` | Access token expiry |
| `CENF_AUTH_REFRESH_TTL` | `string` | `7d` | Refresh token expiry |

## Lifecycle

- `start()`: Validates algorithm config, pre-fetches JWKS if RS256
- `stop()`: Clears JWKS cache
- `health()`: Returns `{ status: 'healthy', details: { algorithm, jwksCached } }`

## Testing Strategy

- **Unit**: `MemoryAuthAdapter` — generate/verify round-trip
- **Integration**: `JoseAuthAdapter` — HS256 sign/verify, JWKS mock server
- **Edge cases**: Expired tokens, wrong audience, malformed JWT, key rotation

## Requirements

### Requirement: Token Generation and Verification

The system MUST generate JWT tokens with configurable algorithm and verify them with full claim validation (exp, iat, iss, aud).

#### Scenario: Generate and verify HS256 token

- GIVEN `CENF_AUTH_ALGORITHM=HS256` and `CENF_AUTH_SECRET=my-secret`
- WHEN `await auth.generateToken({ sub: "user-1" }, { expiresIn: "1h" })` is called
- THEN a valid JWT string is returned
- AND `await auth.verifyToken(token)` returns `{ sub: "user-1" }` with correct type

#### Scenario: Expired token rejection

- GIVEN a token with `exp` claim in the past
- WHEN `await auth.verifyToken(expiredToken)` is called
- THEN it throws `TokenExpiredError`
- AND the error includes the expiry timestamp

#### Scenario: Audience mismatch rejection

- GIVEN a token with `aud: "service-a"` and `VerifyOptions.audience = "service-b"`
- WHEN `await auth.verifyToken(token, { audience: "service-b" })` is called
- THEN it throws `TokenVerificationError`
- AND the error indicates audience mismatch

#### Scenario: Decode without verification

- GIVEN a JWT token (valid or expired)
- WHEN `auth.decodeToken(token)` is called
- THEN it returns the payload claims WITHOUT validating signature or expiry
- AND no error is thrown for expired tokens

#### Scenario: Token rotation with refresh

- GIVEN a valid refresh token
- WHEN `await auth.refreshToken(refreshToken)` is called
- THEN it returns a new `TokenPair` with fresh access and refresh tokens
- AND `expiresAt` is a future timestamp
