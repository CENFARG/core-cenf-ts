import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FetchHttpClientAdapter } from '../adapters/fetch.adapter.js';
import type { HttpClientManager } from '../ports.js';
import type { HttpResponse } from '../types.js';

interface TestUser {
  id: number;
  name: string;
}

describe('FetchHttpClientAdapter', () => {
  let client: FetchHttpClientAdapter;

  beforeEach(async () => {
    client = new FetchHttpClientAdapter();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  it('start() initializes with empty route map', async () => {
    const h = await client.health();
    expect(h.status).toBe('healthy');
    expect(h.details.adapter).toBe('fetch-memory');
  });

  it('health() reports adapter type and route count', async () => {
    client.register('GET', '/api/users', {
      status: 200,
      data: [],
      headers: {},
    });
    const h = await client.health();
    expect(h.details.routeCount).toBe(1);
  });

  it('stop() clears registered routes', async () => {
    client.register('GET', '/api/users', {
      status: 200,
      data: [],
      headers: {},
    });
    await client.stop();
    const h = await client.health();
    expect(h.details.routeCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // register() — preconfigure responses
  // -----------------------------------------------------------------------

  it('register() preconfigures a GET response', async () => {
    const users: TestUser[] = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    client.register('GET', '/api/users', {
      status: 200,
      data: users,
      headers: { 'content-type': 'application/json' },
    });

    const res = await client.get<TestUser[]>('/api/users');
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
    expect(res.data[0].name).toBe('Alice');
    expect(res.headers['content-type']).toBe('application/json');
  });

  it('register() preconfigures a POST response', async () => {
    const created: TestUser = { id: 3, name: 'Charlie' };
    client.register('POST', '/api/users', {
      status: 201,
      data: created,
      headers: {},
    });

    const res = await client.post<TestUser>('/api/users', {
      name: 'Charlie',
    });
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Charlie');
  });

  it('register() preconfigures a PUT response', async () => {
    client.register('PUT', '/api/users/1', {
      status: 200,
      data: { id: 1, name: 'Updated' },
      headers: {},
    });

    const res = await client.put<TestUser>('/api/users/1', {
      name: 'Updated',
    });
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Updated');
  });

  it('register() preconfigures a DELETE response', async () => {
    client.register('DELETE', '/api/users/1', {
      status: 204,
      data: null,
      headers: {},
    });

    const res = await client.delete('/api/users/1');
    expect(res.status).toBe(204);
  });

  it('register() preconfigures a PATCH response', async () => {
    client.register('PATCH', '/api/users/1', {
      status: 200,
      data: { id: 1, name: 'Patched' },
      headers: {},
    });

    const res = await client.patch<TestUser>('/api/users/1', {
      name: 'Patched',
    });
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Patched');
  });

  // -----------------------------------------------------------------------
  // Unregistered routes — error handling
  // -----------------------------------------------------------------------

  it('get() throws HttpClientError for unregistered route', async () => {
    await expect(client.get('/api/unknown')).rejects.toThrow(
      /No mock registered/,
    );
  });

  it('post() throws HttpClientError for unregistered route', async () => {
    await expect(
      client.post('/api/unknown', { x: 1 }),
    ).rejects.toThrow(/No mock registered/);
  });

  // -----------------------------------------------------------------------
  // Method-specific routing
  // -----------------------------------------------------------------------

  it('different methods on same URL return different responses', async () => {
    client.register('GET', '/api/item', {
      status: 200,
      data: { method: 'GET' },
      headers: {},
    });
    client.register('POST', '/api/item', {
      status: 201,
      data: { method: 'POST' },
      headers: {},
    });

    const getRes = await client.get<{ method: string }>('/api/item');
    const postRes = await client.post<{ method: string }>('/api/item', {});

    expect(getRes.data.method).toBe('GET');
    expect(postRes.data.method).toBe('POST');
  });

  // -----------------------------------------------------------------------
  // Response shape
  // -----------------------------------------------------------------------

  it('returns full HttpResponse with status, data, and headers', async () => {
    client.register('GET', '/api/data', {
      status: 200,
      data: { value: 42 },
      headers: { 'x-custom': 'yes' },
    });

    const res = await client.get<{ value: number }>('/api/data');
    expect(res.status).toBe(200);
    expect(res.data.value).toBe(42);
    expect(res.headers['x-custom']).toBe('yes');
  });
});
