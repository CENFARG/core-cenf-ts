# CENF Core Infrastructure — API Catalog (TypeScript)

> **Structured manager catalog for AI agents.**
> Each manager follows: Port interface → Adapters → Types → Errors.
> Method signatures closely follow `core-cenf-py` v0.1.0.

---

## 1. ConfigManager

### Port: `IConfigManager`
- `load<T>(schema: ZodSchema<T>): T` — Load and validate config from env/sources
- `get<T>(key: string): T | undefined` — Get single value
- `set<T>(key: string, value: T): void` — Set runtime override
- `reload(): void` — Reload from sources

### Adapters
- `EnvConfigAdapter` — Reads from `process.env` with Zod validation
- `FileConfigAdapter` — Reads from YAML/JSON config files

### Errors
- `ConfigValidationError` — Zod validation failed
- `ConfigNotFoundError` — Required config missing

---

## 2. LogManager

### Port: `ILogManager`
- `debug(obj: unknown, msg?: string): void`
- `info(obj: unknown, msg?: string): void`
- `warn(obj: unknown, msg?: string): void`
- `error(obj: unknown, msg?: string): void`
- `fatal(obj: unknown, msg?: string): void`
- `child(bindings: object): ILogManager` — Create child logger

### Adapters
- `PinoLogAdapter` — Wraps pino

### Errors
- `LogConfigurationError`

---

## 3. SecretManager

### Port: `ISecretManager`
- `getSecret(name: string): Promise<string>` — Retrieve a secret by name
- `setSecret(name: string, value: string): Promise<void>` — Store a secret
- `rotateSecret(name: string, newValue: string): Promise<void>` — Rotate a secret
- `health(): Promise<SecretHealth>`

### Adapters
- `EnvSecretAdapter` — Reads from `process.env` (dev only)
- `MemorySecretAdapter` — In-memory for testing
- `VaultSecretAdapter` — HashiCorp Vault stub (v0.2.0)

### Errors
- `SecretNotFoundError`
- `SecretAccessError`

---

## 4. ErrorHandlingManager

### Port: `IErrorHandlingManager`
- `handle<T>(fn: () => Promise<T>, options?: HandleOptions): Promise<T>` — Wrapped execution with retry/fallback
- `classify(error: unknown): ErrorClassification` — Categorize error for routing
- `toResponse(error: unknown): ErrorResponse` — Convert to API-safe response

### Error Taxonomy
```
CenfError (abstract)
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

---

## 5. ValidationManager

### Port: `IValidationManager`
- `validate<T>(schema: ZodSchema<T>, data: unknown): T` — Sync validation
- `validateAsync<T>(schema: ZodSchema<T>, data: unknown): Promise<T>` — Async
- `validateArray<T>(schema: ZodSchema<T>, data: unknown[]): T[]` — Batch

### Adapters
- `ZodValidationAdapter` — Wraps Zod

### Errors
- `ValidationError` — Generic validation failure
- `ValidationArrayError` — Multiple items failed

---

## 6. CacheManager

### Port: `ICacheManager`
- `get<T>(key: string): Promise<T | undefined>`
- `set<T>(key: string, value: T, ttl?: number): Promise<void>`
- `del(key: string): Promise<boolean>`
- `exists(key: string): Promise<boolean>`
- `clear(): Promise<void>`
- `health(): Promise<CacheHealth>`

### Adapters
- `RedisCacheAdapter` — Wraps ioredis
- `MemoryCacheAdapter` — In-memory fallback

### Errors
- `CacheConnectionError`
- `CacheOperationError`

---

## 7. FeatureFlagManager

### Port: `IFeatureFlagManager`
- `isEnabled(flag: string, context?: FlagContext): Promise<boolean>` — Check if feature is enabled
- `getVariant(flag: string, context?: FlagContext): Promise<string>` — Get variant for A/B testing
- `getAll(context?: FlagContext): Promise<Record<string, boolean>>` — Bulk check
- `refresh(): Promise<void>` — Reload from source

### Adapters
- `YamlFeatureFlagAdapter` — Reads from YAML config file
- `MemoryFeatureFlagAdapter` — In-memory for testing

### Errors
- `FeatureFlagNotFoundError`
- `FeatureFlagParseError`

---

## 8. RateLimiterManager

### Port: `IRateLimiterManager`
- `consume(key: string, tokens?: number): Promise<RateLimitResult>` — Consume tokens
- `status(key: string): Promise<RateLimitStatus>` — Current rate limit state
- `reset(key: string): Promise<void>` — Reset counter for a key

### Algorithm
- Token bucket: fixed capacity, refill rate per second
- Zero external dependencies — pure TypeScript implementation

### Errors
- `RateLimitExceededError`

---

## 9. DatabaseManager

### Port: `IDatabaseManager`
- `connect(): Promise<void>`
- `disconnect(): Promise<void>`
- `health(): Promise<DatabaseHealth>`
- `query<T>(query: string, params?: unknown[]): Promise<T[]>`
- `transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>`

### Adapters
- `DrizzleDatabaseAdapter` — Wraps Drizzle ORM
- `PrismaDatabaseAdapter` — Wraps Prisma Client

### Errors
- `DatabaseConnectionError`
- `DatabaseQueryError`
- `DatabaseTransactionError`

---

## 10. AuthManager

### Port: `IAuthManager`
- `generateToken(payload: TokenPayload, options?: TokenOptions): Promise<string>`
- `verifyToken<T>(token: string, options?: VerifyOptions): Promise<T>`
- `decodeToken<T>(token: string): T`
- `refreshToken(refreshToken: string): Promise<TokenPair>`

### Adapters
- `JoseAuthAdapter` — Wraps jose (JWT)

### Errors
- `TokenExpiredError`
- `TokenInvalidError`
- `TokenVerificationError`

---

## 11. ObservabilityManager

### Port: `IObservabilityManager`
- `createSpan(name: string, context?: SpanContext): Span`
- `recordMetric(name: string, value: number, attributes?: MetricAttributes): void`
- `recordError(error: Error, context?: SpanContext): void`
- `addEvent(name: string, attributes?: EventAttributes): void`

### Adapters
- `OpenTelemetryAdapter` — Wraps @opentelemetry/api

### Errors
- `ObservabilityConfigurationError`

---

## 12. StorageManager

### Port: `IStorageManager`
- `upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string>`
- `download(key: string): Promise<Buffer>`
- `delete(key: string): Promise<void>`
- `exists(key: string): Promise<boolean>`
- `list(prefix: string): Promise<string[]>`

### Adapters
- `S3StorageAdapter` — Wraps @aws-sdk/client-s3
- `LocalStorageAdapter` — File system fallback

### Errors
- `StorageUploadError`
- `StorageDownloadError`
- `StorageDeleteError`

---

## 13. CircuitBreakerManager

### Port: `ICircuitBreakerManager`
- `call<T>(name: string, fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>`
- `status(name: string): CircuitBreakerStatus`
- `reset(name: string): void`

### Adapters
- `OpossumCircuitBreakerAdapter` — Wraps opossum

### Errors
- `CircuitBreakerOpenError`

---

## 14. I18nManager

### Port: `II18nManager`
- `t(key: string, options?: TranslateOptions): string`
- `setLanguage(lang: string): void`
- `getLanguage(): string`
- `addResourceBundle(lang: string, ns: string, resources: Record<string, unknown>): void`

### Adapters
- `I18nextAdapter` — Wraps i18next

### Errors
- `I18nConfigurationError`

---

## 15. EventBusManager

### Port: `IEventBusManager`
- `publish<T>(subject: string, data: T): Promise<void>`
- `subscribe<T>(subject: string, handler: (data: T) => Promise<void>): Promise<string>`
- `unsubscribe(subscriptionId: string): Promise<void>`
- `health(): Promise<EventBusHealth>`

### Adapters
- `NatsEventBusAdapter` — Wraps @nats-io/nats-core v3

### Errors
- `EventBusConnectionError`
- `EventBusPublishError`
- `EventBusSubscriptionError`

---

## 16. HttpClientManager

### Port: `IHttpClientManager`
- `get<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>`
- `post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>`
- `put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>`
- `patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>`
- `delete<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>`

### Adapters
- `UndiciHttpClientAdapter` — Wraps undici with retry logic

### Errors
- `HttpClientError` — Non-2xx response
- `HttpTimeoutError`

---

## 17. BootstrapOrchestrator

### Port: `IBootstrapOrchestrator`
- `register(priority: number, fn: () => Promise<void>): void`
- `start(): Promise<void>`
- `shutdown(): Promise<void>`

### Errors
- `BootstrapError`
- `ShutdownError`

---

## 18. HealthManager

### Port: `IHealthManager`
- `register(name: string, check: () => Promise<HealthStatus>): void`
- `check(): Promise<HealthReport>` — Aggregate all registered checks
- `check(name: string): Promise<HealthStatus>` — Single check

### Errors
- `HealthCheckTimeoutError`

---

## 19. JsonSerializer

### Port: `IJsonSerializer`
- `serialize<T>(data: T, options?: SerializeOptions): string`
- `deserialize<T>(json: string, options?: DeserializeOptions): T`

### Adapters
- `NativeJsonSerializer` — Handles BigInt, Dates via custom reviver

### Errors
- `JsonSerializationError`
- `JsonDeserializationError`

---

## Common Types

```typescript
// Health
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
  timestamp: Date;
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthStatus>;
  timestamp: Date;
}

interface CacheHealth {
  connected: boolean;
  latencyMs: number;
  keysCount?: number;
}

interface DatabaseHealth {
  connected: boolean;
  latencyMs: number;
  poolStatus?: { active: number; idle: number; waiting: number };
}

interface EventBusHealth {
  connected: boolean;
  subscriptions: number;
}

interface SecretHealth {
  source: 'env' | 'vault' | 'memory';
  available: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

interface RateLimitStatus {
  key: string;
  tokensRemaining: number;
  capacity: number;
  refillRate: number;
}

interface FlagContext {
  userId?: string;
  groupId?: string;
  [key: string]: unknown;
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

interface HandleOptions {
  retries?: number;
  fallback?: () => Promise<unknown>;
  timeoutMs?: number;
}

// Auth
interface TokenPayload {
  sub: string;
  [key: string]: unknown;
}

interface TokenOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

interface VerifyOptions {
  issuer?: string;
  audience?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Circuit Breaker
interface CircuitBreakerStatus {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailure?: Date;
}

// HTTP
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

interface HttpResponse<T> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

// Serializer
interface SerializeOptions {
  pretty?: boolean;
  dateFormat?: 'iso' | 'timestamp';
}

interface DeserializeOptions {
  dateFormat?: 'iso' | 'timestamp';
  strict?: boolean;
}
```
