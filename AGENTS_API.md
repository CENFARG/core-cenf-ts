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

## 3. ValidationManager

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

## 4. CacheManager

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

## 5. DatabaseManager

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

## 6. AuthManager

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

## 7. ObservabilityManager

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

## 8. StorageManager

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

## 9. CircuitBreakerManager

### Port: `ICircuitBreakerManager`
- `call<T>(name: string, fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>`
- `status(name: string): CircuitBreakerStatus`
- `reset(name: string): void`

### Adapters
- `OpossumCircuitBreakerAdapter` — Wraps opossum

### Errors
- `CircuitBreakerOpenError`

---

## 10. I18nManager

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

## 11. EventBusManager

### Port: `IEventBusManager`
- `publish<T>(subject: string, data: T): Promise<void>`
- `subscribe<T>(subject: string, handler: (data: T) => Promise<void>): Promise<string>`
- `unsubscribe(subscriptionId: string): Promise<void>`
- `health(): Promise<EventBusHealth>`

### Adapters
- `NatsEventBusAdapter` — Wraps nats

### Errors
- `EventBusConnectionError`
- `EventBusPublishError`
- `EventBusSubscriptionError`

---

## 12. HttpClientManager

### Port: `IHttpClientManager`
- `get<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>`
- `post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>`
- `put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>`
- `patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>`
- `delete<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>`

### Adapters
- `NativeHttpClientAdapter` — Native fetch with retry

### Errors
- `HttpClientError` — Non-2xx response
- `HttpTimeoutError`

---

## 13. BootstrapOrchestrator

### Port: `IBootstrapOrchestrator`
- `register(priority: number, fn: () => Promise<void>): void`
- `start(): Promise<void>`
- `shutdown(): Promise<void>`

### Errors
- `BootstrapError`
- `ShutdownError`

---

## 14. HealthManager

### Port: `IHealthManager`
- `register(name: string, check: () => Promise<HealthStatus>): void`
- `check(): Promise<HealthReport>` — Aggregate all registered checks
- `check(name: string): Promise<HealthStatus>` — Single check

### Errors
- `HealthCheckTimeoutError`

---

## 15. JsonSerializer

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
