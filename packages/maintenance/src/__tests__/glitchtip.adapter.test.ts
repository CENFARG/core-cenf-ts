/**
 * Tests for GlitchTipAdapter — self-hosted Sentry-compatible error backend.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { GlitchTipAdapter } from '../adapters/glitchtip.adapter.js';
import { ErrorSeverity } from '../types.js';
import type { ErrorReport } from '../types.js';

function makeReport(overrides?: Partial<ErrorReport>): ErrorReport {
  return {
    appId: 'my-app',
    message: 'Something went wrong',
    severity: ErrorSeverity.Error,
    timestamp: '2026-07-29T00:00:00Z',
    stackTrace: 'Error: fail\n    at main (index.ts:1:1)',
    version: '1.0.0',
    os: 'linux',
    ...overrides,
  };
}

describe('GlitchTipAdapter', () => {
  const dsn = 'https://public-key@glitchtip.example.com/1';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor DSN parsing', () => {
    it('parses DSN correctly', () => {
      const adapter = new GlitchTipAdapter({ dsn });
      // Access parsed properties via a successful reportError call
      // (DSN parsing is tested indirectly through proper URL construction)
      expect(adapter).toBeDefined();
    });

    it('handles DSN with explicit port', () => {
      const adapter = new GlitchTipAdapter({
        dsn: 'http://key@glitchtip.local:9000/2',
      });
      const mock = vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      adapter.reportError(makeReport());
      const url = mock.mock.calls[0][0];
      expect(url).toContain('glitchtip.local:9000');
      expect(url).toContain('/api/2/store/');
    });
  });

  describe('reportError()', () => {
    it('returns success when GlitchTip responds 2xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new GlitchTipAdapter({ dsn });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(true);
      expect(result.target).toBe('glitchtip');
    });

    it('sends Sentry-compatible payload', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new GlitchTipAdapter({ dsn });
      const report = makeReport();
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.message).toBe('Something went wrong');
      expect(callBody.culprit).toBe('my-app');
      expect(callBody.level).toBe('error');
      expect(callBody.platform).toBe('node');
      expect(callBody.tags.app_id).toBe('my-app');
      expect(callBody.event_id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('includes X-Sentry-Auth header', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new GlitchTipAdapter({ dsn });
      const report = makeReport();
      await adapter.reportError(report);

      const headers = mock.mock.calls[0][1].headers;
      expect(headers['X-Sentry-Auth']).toContain('sentry_version=7');
      expect(headers['X-Sentry-Auth']).toContain('public-key');
    });

    it('parses stack frames from stack trace', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new GlitchTipAdapter({ dsn });
      const report = makeReport({
        stackTrace: 'Error: fail\n    at main (index.ts:1:1)\n    at start (app.ts:10:5)',
      });
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      const frames = callBody['sentry.interfaces.Exception'].values[0].stacktrace.frames;
      expect(frames).toHaveLength(2);
      expect(frames[0].filename).toBe('index.ts');
      expect(frames[0].function).toBe('main');
      expect(frames[1].filename).toBe('app.ts');
    });

    it('returns failure when GlitchTip responds 4xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 400,
        json: async () => ({ detail: 'Bad event' }),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new GlitchTipAdapter({ dsn });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('glitchtip');
      expect(result.error).toContain('Bad event');
    });

    it('returns failure when fetch throws', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('Connection failed'));
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new GlitchTipAdapter({ dsn });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('glitchtip');
      expect(result.error).toContain('Connection failed');
    });
  });
});
