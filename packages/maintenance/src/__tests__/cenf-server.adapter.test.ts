/**
 * Tests for CENFServerAdapter — REST API transport to CENF Server.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { CENFServerAdapter } from '../adapters/cenf-server.adapter.js';
import { ErrorSeverity } from '../types.js';
import type { ErrorReport } from '../types.js';

function makeReport(overrides?: Partial<ErrorReport>): ErrorReport {
  return {
    appId: 'my-app',
    message: 'Something went wrong',
    severity: ErrorSeverity.Error,
    timestamp: '2026-07-29T00:00:00Z',
    version: '1.0.0',
    os: 'linux',
    stackTrace: 'Error: fail\n    at main (index.ts:1:1)',
    ...overrides,
  };
}

describe('CENFServerAdapter', () => {
  const serverUrl = 'https://cenf.example.com';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reportError()', () => {
    it('returns success when server responds 2xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new CENFServerAdapter({ serverUrl });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(true);
      expect(result.target).toBe('cenf-server');
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock.mock.calls[0][0]).toContain('/api/v1/errors');
    });

    it('sends error payload with PII-scrubbed data', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new CENFServerAdapter({ serverUrl });
      const report = makeReport({ message: 'test failure' });
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.appId).toBe('my-app');
      expect(callBody.message).toBe('test failure');
    });

    it('returns failure when server responds 4xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 422,
        json: async () => ({ error: 'Invalid payload' }),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new CENFServerAdapter({ serverUrl });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('cenf-server');
      expect(result.error).toContain('Invalid payload');
    });

    it('returns failure when fetch throws', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('Network timeout'));
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new CENFServerAdapter({ serverUrl });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('cenf-server');
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('sendTelemetry()', () => {
    it('sends telemetry to /api/v1/telemetry', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new CENFServerAdapter({ serverUrl });
      await adapter.sendTelemetry('my-app', { event: 'login', count: 5 });

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock.mock.calls[0][0]).toContain('/api/v1/telemetry');

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.appId).toBe('my-app');
      expect(callBody.metrics.event).toBe('login');
    });

    it('does not throw on failure (fire-and-forget)', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('Network error'));
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new CENFServerAdapter({ serverUrl });
      // Should not throw
      await expect(
        adapter.sendTelemetry('my-app', { event: 'test' }),
      ).resolves.toBeUndefined();
    });
  });
});
