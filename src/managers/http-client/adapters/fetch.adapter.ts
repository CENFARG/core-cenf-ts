/**
 * In-memory HTTP client adapter — preconfigured URL→response map for testing.
 *
 * Implements the HttpClientManager port with no real network calls.
 * Test code preconfigures expected responses via `register()`,
 * then calls get/post/put/delete/patch which return the registered responses.
 *
 * @module managers/http-client/adapters/fetch.adapter
 */

import type { HttpClientManager } from '../ports.js';
import type { RequestOptions, HttpResponse } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';

/** HTTP method union for route registration. */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Key for the route map: `${method}:${url}`. */
type RouteKey = `${HttpMethod}:${string}`;

/**
 * In-memory HTTP client adapter for testing.
 *
 * Maintains a `Map<RouteKey, HttpResponse<unknown>>` of preconfigured
 * responses. Test code calls `register()` to set up expected responses
 * before making requests. Throws `HttpClientError` for unregistered routes.
 *
 * Use this adapter:
 * - In unit tests where real HTTP calls are not desired
 * - For prototyping without backend availability
 * - As a reference implementation for the HttpClientManager port
 */
export class FetchHttpClientAdapter implements HttpClientManager {
  /** Route map: `"METHOD:/path"` → response. */
  private routes = new Map<string, HttpResponse<unknown>>();

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.routes.clear();
  }

  async stop(): Promise<void> {
    this.routes.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'fetch-memory',
        routeCount: this.routes.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Route registration
  // -----------------------------------------------------------------------

  /**
   * Register a preconfigured response for a method + URL combination.
   *
   * @param method - The HTTP method (GET, POST, PUT, DELETE, PATCH).
   * @param url - The request URL path.
   * @param response - The response to return for this route.
   */
  register(
    method: HttpMethod,
    url: string,
    response: HttpResponse<unknown>,
  ): void {
    const key: RouteKey = `${method}:${url}`;
    this.routes.set(key, response);
  }

  // -----------------------------------------------------------------------
  // HttpClientManager — HTTP methods
  // -----------------------------------------------------------------------

  async get<T>(
    url: string,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.lookup<T>('GET', url);
  }

  async post<T>(
    url: string,
    _body: unknown,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.lookup<T>('POST', url);
  }

  async put<T>(
    url: string,
    _body: unknown,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.lookup<T>('PUT', url);
  }

  async delete<T>(
    url: string,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.lookup<T>('DELETE', url);
  }

  async patch<T>(
    url: string,
    _body: unknown,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.lookup<T>('PATCH', url);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Look up a registered route and return its response.
   *
   * @throws HttpClientError if no route is registered for the method+URL.
   */
  private lookup<T>(method: HttpMethod, url: string): HttpResponse<T> {
    const key: RouteKey = `${method}:${url}`;
    const response = this.routes.get(key);
    if (!response) {
      throw new HttpClientError(
        `No mock registered for ${method} ${url}`,
      );
    }
    return response as HttpResponse<T>;
  }
}

/**
 * HTTP client error — thrown for unregistered routes in memory adapter.
 *
 * Mirror of the shared/errors.ts HttpClientError for adapter-local use.
 */
class HttpClientError extends Error {
  readonly code = 'ERR_HTTP_CLIENT';

  constructor(message: string) {
    super(message);
    this.name = 'HttpClientError';
  }
}
