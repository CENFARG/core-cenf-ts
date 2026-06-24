/**
 * HttpClientManager-specific types.
 *
 * Types for HTTP requests, responses, and options.
 *
 * @module managers/http-client/types
 */

// ---------------------------------------------------------------------------
// HttpResponse<T> — typed HTTP response
// ---------------------------------------------------------------------------

/**
 * Typed HTTP response from an HttpClientManager method.
 *
 * Contains the HTTP status code, typed response data,
 * and response headers.
 *
 * @typeParam T - The expected shape of the response body.
 */
export interface HttpResponse<T = unknown> {
  /** HTTP status code (e.g., 200, 404, 500). */
  status: number;

  /** Parsed response body, typed as `T`. */
  data: T;

  /** Response headers as a key-value map. */
  headers: Record<string, string>;
}

// ---------------------------------------------------------------------------
// RequestOptions — per-request configuration
// ---------------------------------------------------------------------------

/**
 * Optional configuration for an individual HTTP request.
 *
 * Supports custom headers, timeout, and abort signal.
 */
export interface RequestOptions {
  /** Custom HTTP headers for the request. */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds. */
  timeoutMs?: number;

  /** AbortSignal for cancelling the request. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const HTTP_CLIENT_TYPES_VERSION = '0.1.0';
