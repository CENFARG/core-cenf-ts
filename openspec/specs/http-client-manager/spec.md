# HttpClientManager Specification

## Purpose

Provides resilient HTTP client with retry/backoff, timeout, and request/response interceptors. Built on undici for modern Node.js HTTP.

## Port Interface

```typescript
interface IHttpClientManager {
  get<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>;
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>;
  patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>;
  delete<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
}

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
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `UndiciHttpClientAdapter` | Wraps undici with retry, timeout, interceptors |
| `MockHttpClientAdapter` | In-memory response map for testing |

## Error Types

- `HttpClientError` — Non-2xx response, request failed
- `HttpTimeoutError` — Request exceeded timeout

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_HTTP_TIMEOUT` | `number` | `30000` | Default timeout in ms |
| `CENF_HTTP_RETRIES` | `number` | `0` | Default retry count |
| `CENF_HTTP_BACKOFF_BASE` | `number` | `1000` | Base backoff delay in ms |

## Lifecycle

- `start()`: Initializes undici dispatcher with connection pooling
- `stop()`: Closes all idle connections
- `health()`: Returns `{ status: 'healthy', details: { activeConnections } }`

## Testing Strategy

- **Unit**: `MockHttpClientAdapter` — predefined responses, error injection
- **Integration**: `UndiciHttpClientAdapter` with test HTTP server
- **Edge cases**: Timeout, retry on 5xx, redirect handling, abort signal

## Requirements

### Requirement: HTTP Methods with Typed Responses

The system MUST support GET, POST, PUT, PATCH, DELETE with JSON body serialization and typed response parsing.

#### Scenario: GET with JSON response

- GIVEN a server returns `{ "id": 1, "name": "test" }` with status 200
- WHEN `await http.get<User>("https://api.example.com/users/1")` is called
- THEN it returns `{ status: 200, data: { id: 1, name: "test" } }`
- AND the data is typed as `User`

#### Scenario: POST with request body

- GIVEN a server accepts JSON body `{ "name": "new" }`
- WHEN `await http.post("https://api.example.com/users", { name: "new" })` is called
- THEN the request body is serialized as JSON
- AND `Content-Type: application/json` header is set

#### Scenario: Non-2xx response throws HttpClientError

- GIVEN a server returns status 404 with body `{ "error": "not found" }`
- WHEN `await http.get("https://api.example.com/missing")` is called
- THEN it throws `HttpClientError` with status 404
- AND the error includes the response body as details

### Requirement: Retry with Exponential Backoff

The system MUST retry failed requests on transient errors (5xx, network) with exponential backoff.

#### Scenario: Retry on 502 then succeed

- GIVEN server returns 502 on first call, 200 on second
- WHEN `http.get(url, { retries: 2 })` is called
- THEN it retries after the 502
- AND returns the 200 response

#### Scenario: Timeout aborts request

- GIVEN `timeout: 100` and a server that takes 500ms to respond
- WHEN `http.get(url, { timeout: 100 })` is called
- THEN it throws `HttpTimeoutError` after 100ms
- AND the request is aborted via AbortController

#### Scenario: Abort signal cancels in-flight request

- GIVEN an in-flight request and an AbortController
- WHEN `controller.abort()` is called
- THEN the request is cancelled
- AND an abort error is thrown (not retried)
