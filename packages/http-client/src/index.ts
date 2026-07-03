/**
 * @cenf/http-client — HTTP client abstraction.
 *
 * @module @cenf/http-client
 */

// Port
export { type HttpClientManager, HTTP_CLIENT_PORT_VERSION } from './ports.js';

// Types
export type { HttpResponse, RequestOptions } from './types.js';
export { HTTP_CLIENT_TYPES_VERSION } from './types.js';

// Adapters
export { FetchHttpClientAdapter } from './adapters/fetch.adapter.js';
