/**
 * HttpClientManager port interface — HTTP client abstraction.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/http-client/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { RequestOptions, HttpResponse } from './types.js';

/**
 * HTTP client manager port for typed HTTP requests.
 *
 * Provides typed get/post/put/delete/patch methods abstracting
 * HTTP clients like undici, fetch, or axios.
 * All methods return `HttpResponse<T>` with typed data.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface HttpClientManager extends AsyncLifecycle {
  /**
   * Perform a GET request.
   *
   * @param url - The request URL.
   * @param options - Optional request configuration (headers, timeout, signal).
   * @returns Typed HTTP response.
   */
  get<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;

  /**
   * Perform a POST request.
   *
   * @param url - The request URL.
   * @param body - The request body (serialized by the adapter).
   * @param options - Optional request configuration.
   * @returns Typed HTTP response.
   */
  post<T>(
    url: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;

  /**
   * Perform a PUT request.
   *
   * @param url - The request URL.
   * @param body - The request body.
   * @param options - Optional request configuration.
   * @returns Typed HTTP response.
   */
  put<T>(
    url: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;

  /**
   * Perform a DELETE request.
   *
   * @param url - The request URL.
   * @param options - Optional request configuration.
   * @returns Typed HTTP response.
   */
  delete<T>(
    url: string,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;

  /**
   * Perform a PATCH request.
   *
   * @param url - The request URL.
   * @param body - The request body.
   * @param options - Optional request configuration.
   * @returns Typed HTTP response.
   */
  patch<T>(
    url: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const HTTP_CLIENT_PORT_VERSION = '0.1.0';
