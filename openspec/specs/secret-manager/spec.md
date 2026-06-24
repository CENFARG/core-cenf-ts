# SecretManager Specification

## Purpose

Manages sensitive credentials (API keys, DB passwords, JWT secrets) with adapter-based retrieval. Supports env vars for development, vault for production, and in-memory for testing.

## Port Interface

```typescript
interface ISecretManager {
  getSecret(name: string): Promise<string>;
  setSecret(name: string, value: string): Promise<void>;
  rotateSecret(name: string, newValue: string): Promise<void>;
  health(): Promise<SecretHealth>;
}

interface SecretHealth {
  source: 'env' | 'vault' | 'memory';
  available: boolean;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `EnvSecretAdapter` | Reads from `process.env` (development only) |
| `MemorySecretAdapter` | In-memory map for testing |
| `VaultSecretAdapter` | HashiCorp Vault integration (v0.2.0 stub) |

## Error Types

- `SecretNotFoundError` — Requested secret name does not exist
- `SecretAccessError` — Permission denied or vault unreachable

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_SECRET_SOURCE` | `env\|vault\|memory` | `env` | Secret backend |
| `CENF_VAULT_ADDR` | `string` | `""` | Vault server URL |
| `CENF_VAULT_TOKEN` | `string` | `""` | Vault auth token |

## Lifecycle

- `start()`: Validates source connectivity (vault ping or env check)
- `stop()`: Clears in-memory cache, closes vault connections
- `health()`: Returns source type and availability status

## Testing Strategy

- **Unit**: `MemorySecretAdapter` — set/get/rotate with known values
- **Integration**: `EnvSecretAdapter` — reads from test env vars
- **Edge cases**: Missing secrets, vault timeout, rotation race conditions

## Requirements

### Requirement: Secure Secret Retrieval

The system MUST retrieve secrets by name from the configured source. Secrets MUST NOT be logged in plaintext. Missing secrets MUST raise `SecretNotFoundError`.

#### Scenario: Retrieve secret from env source

- GIVEN `CENF_SECRET_SOURCE=env` and `process.env.DB_PASSWORD=secret123`
- WHEN `await secret.getSecret("DB_PASSWORD")` is called
- THEN it returns `"secret123"`
- AND no log entry contains the raw value

#### Scenario: Missing secret raises error

- GIVEN a secret name `NONEXISTENT_KEY` is not in any source
- WHEN `await secret.getSecret("NONEXISTENT_KEY")` is called
- THEN it throws `SecretNotFoundError`
- AND the error message does NOT contain any secret values

#### Scenario: Secret rotation updates value

- GIVEN a secret `API_KEY` has value `old-key`
- WHEN `await secret.rotateSecret("API_KEY", "new-key")` is called
- THEN subsequent `getSecret("API_KEY")` returns `"new-key"`
- AND a rotation event is logged at INFO level (without values)

#### Scenario: Health check reports source status

- GIVEN the secret source is configured as `env`
- WHEN `await secret.health()` is called
- THEN it returns `{ source: "env", available: true }`
- AND if vault source is unreachable, returns `{ source: "vault", available: false }`

#### Scenario: Memory adapter for testing isolation

- GIVEN `MemorySecretAdapter` is instantiated with empty state
- WHEN `setSecret("test", "value")` then `getSecret("test")` is called
- THEN it returns `"value"`
- AND no other test's secrets are accessible
