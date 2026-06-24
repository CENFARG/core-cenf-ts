import { describe, it, expect } from 'vitest';
import {
  HTTP_CLIENT_PORT_VERSION,
  type HttpClientManager,
} from '../ports.js';
import type { RequestOptions, HttpResponse } from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// Test implementation of HttpClientManager for contract verification
// ---------------------------------------------------------------------------

class TestHttpClientManager implements HttpClientManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async get<T>(_url: string, _options?: RequestOptions): Promise<HttpResponse<T>> {
    return { status: 200, data: null as unknown as T, headers: {} };
  }

  async post<T>(
    _url: string,
    _body: unknown,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return { status: 201, data: null as unknown as T, headers: {} };
  }

  async put<T>(
    _url: string,
    _body: unknown,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return { status: 200, data: null as unknown as T, headers: {} };
  }

  async delete<T>(
    _url: string,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return { status: 204, data: null as unknown as T, headers: {} };
  }

  async patch<T>(
    _url: string,
    _body: unknown,
    _options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return { status: 200, data: null as unknown as T, headers: {} };
  }
}

// ---------------------------------------------------------------------------
// HttpClientManager port contract tests
// ---------------------------------------------------------------------------

describe('HttpClientManager port', () => {
  it('exports a runtime version constant', () => {
    expect(HTTP_CLIENT_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: HttpClientManager = new TestHttpClientManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestHttpClientManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('get() returns HttpResponse with status 200', async () => {
    const mgr = new TestHttpClientManager();
    const res = await mgr.get<{ name: string }>('/api/users');
    expect(res.status).toBe(200);
    expect(res.headers).toEqual({});
  });

  it('post() returns HttpResponse with status 201', async () => {
    const mgr = new TestHttpClientManager();
    const res = await mgr.post<{ id: number }>('/api/users', { name: 'New' });
    expect(res.status).toBe(201);
  });

  it('put() returns HttpResponse with status 200', async () => {
    const mgr = new TestHttpClientManager();
    const res = await mgr.put<{ ok: boolean }>('/api/users/1', { name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('delete() returns HttpResponse with status 204', async () => {
    const mgr = new TestHttpClientManager();
    const res = await mgr.delete('/api/users/1');
    expect(res.status).toBe(204);
  });

  it('patch() returns HttpResponse with status 200', async () => {
    const mgr = new TestHttpClientManager();
    const res = await mgr.patch<{ ok: boolean }>('/api/users/1', { name: 'Patched' });
    expect(res.status).toBe(200);
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestHttpClientManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// HTTP types tests
// ---------------------------------------------------------------------------

describe('HTTP types', () => {
  it('HttpResponse<T> has status, data, and headers', () => {
    const res: HttpResponse<{ id: number }> = {
      status: 200,
      data: { id: 1 },
      headers: { 'content-type': 'application/json' },
    };
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(1);
    expect(res.headers['content-type']).toBe('application/json');
  });

  it('RequestOptions supports headers and timeout', () => {
    const opts: RequestOptions = {
      headers: { Authorization: 'Bearer token' },
      timeoutMs: 5000,
    };
    expect(opts.headers?.Authorization).toBe('Bearer token');
    expect(opts.timeoutMs).toBe(5000);
  });

  it('RequestOptions has optional signal', () => {
    const ctrl = new AbortController();
    const opts: RequestOptions = { signal: ctrl.signal };
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });
});
