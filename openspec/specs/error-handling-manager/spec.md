# ErrorHandlingManager Specification

## Purpose

Provides a unified error taxonomy (CenfError hierarchy), classification system, and `@handleErrors` decorator pattern. Ensures all errors are categorized, logged, and converted to API-safe responses.

## Port Interface

```typescript
interface IErrorHandlingManager {
  handle<T>(fn: () => Promise<T>, options?: HandleOptions): Promise<T>;
  classify(error: unknown): ErrorClassification;
  toResponse(error: unknown): ErrorResponse;
}

interface HandleOptions {
  retries?: number;
  fallback?: () => Promise<unknown>;
  timeoutMs?: number;
}

interface ErrorClassification {
  category: 'client' | 'server' | 'network' | 'timeout';
  retryable: boolean;
  userMessage?: string;
}

interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

## Error Taxonomy

```
CenfError (abstract base)
├── ConfigError
├── ValidationError
├── SecretError
├── AuthError (TokenExpiredError, TokenInvalidError, TokenVerificationError)
├── CacheError (CacheConnectionError, CacheOperationError)
├── DatabaseError (DatabaseConnectionError, DatabaseQueryError, DatabaseTransactionError)
├── StorageError (StorageUploadError, StorageDownloadError, StorageDeleteError)
├── HttpClientError (HttpTimeoutError)
├── CircuitBreakerOpenError
├── EventBusError (EventBusConnectionError, EventBusPublishError, EventBusSubscriptionError)
├── ObservabilityError
├── I18nError
├── BootstrapError
├── ShutdownError
└── JsonError (JsonSerializationError, JsonDeserializationError)
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `StandardErrorHandlingAdapter` | Implements classify, toResponse, handle with retry/fallback |

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_ERROR_INCLUDE_STACK` | `boolean` | `false` | Include stack in API responses |
| `CENF_ERROR_DEFAULT_RETRIES` | `number` | `0` | Default retry count for handle() |

## Lifecycle

- `start()`: No-op (pure logic, no external deps)
- `stop()`: No-op
- `health()`: Returns `{ status: 'healthy' }`

## Testing Strategy

- **Unit**: Verify each CenfError subclass maps to correct classification
- **Integration**: `handle()` with retry logic, fallback invocation
- **Edge cases**: Non-CenfError classification, nested errors, stack sanitization

## Requirements

### Requirement: Error Classification Taxonomy

The system MUST classify any error into one of four categories: client, server, network, timeout. CenfError subclasses MUST map directly; unknown errors MUST default to server category.

#### Scenario: CenfError subclass classification

- GIVEN a `TokenExpiredError` instance is thrown
- WHEN `errorManager.classify(err)` is called
- THEN it returns `{ category: "client", retryable: false, userMessage: "Token expired" }`

#### Scenario: Unknown error defaults to server

- GIVEN a plain `Error("something broke")` is thrown
- WHEN `errorManager.classify(err)` is called
- THEN it returns `{ category: "server", retryable: false }`

#### Scenario: Network errors are retryable

- GIVEN a `HttpTimeoutError` instance is thrown
- WHEN `errorManager.classify(err)` is called
- THEN it returns `{ category: "timeout", retryable: true }`

### Requirement: API-Safe Error Response Conversion

The system MUST convert errors to `ErrorResponse` objects safe for API consumers. Stack traces MUST NOT be included unless `CENF_ERROR_INCLUDE_STACK=true`.

#### Scenario: ValidationError to API response

- GIVEN a `ValidationError` with message "Email is required"
- WHEN `errorManager.toResponse(err)` is called
- THEN it returns `{ code: "VALIDATION_ERROR", message: "Email is required" }`
- AND no stack trace is included in details

#### Scenario: Internal error hides implementation details

- GIVEN a `DatabaseConnectionError("ECONNREFUSED 127.0.0.1:5432")`
- WHEN `errorManager.toResponse(err)` is called with `CENF_ERROR_INCLUDE_STACK=false`
- THEN the message is sanitized to a generic "Internal server error"
- AND the raw connection string is NOT in the response

### Requirement: Handle with Retry and Fallback

The system MUST support wrapped execution with optional retry and fallback. Retries MUST use exponential backoff.

#### Scenario: Successful execution without retry

- GIVEN `handle()` is called with a function that succeeds on first call
- WHEN the function resolves
- THEN the result is returned
- AND no retries are attempted

#### Scenario: Retry on transient failure then succeed

- GIVEN `handle()` with `retries: 2` and a function that fails twice then succeeds
- WHEN the function is executed
- THEN it retries up to 2 times
- AND returns the successful result on the third attempt

#### Scenario: Fallback invoked after all retries exhausted

- GIVEN `handle()` with `retries: 1` and a `fallback` function
- WHEN the primary function fails all retries
- THEN the fallback is invoked
- AND the fallback result is returned
