/**
 * Tests for DiscordAlertAdapter — webhook-based Discord alerts.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { DiscordAlertAdapter } from '../adapters/discord-alert.adapter.js';
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

describe('DiscordAlertAdapter', () => {
  const webhookUrl = 'https://discord.com/api/webhooks/123/abc';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reportError()', () => {
    it('returns success when Discord responds 2xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 204,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new DiscordAlertAdapter({ webhookUrl });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(true);
      expect(result.target).toBe('discord');
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock.mock.calls[0][0]).toBe(webhookUrl);
    });

    it('sends rich embed payload', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 204,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new DiscordAlertAdapter({ webhookUrl });
      const report = makeReport();
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.embeds).toHaveLength(1);
      expect(callBody.embeds[0].title).toContain('my-app');
      expect(callBody.embeds[0].color).toBe(0xFF0000); // ERROR = red
      expect(callBody.username).toBe('CENF Error Reporter');
    });

    it('maps severity to embed color', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 204,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new DiscordAlertAdapter({ webhookUrl });

      // Critical severity
      const criticalReport = makeReport({ severity: ErrorSeverity.Critical });
      await adapter.reportError(criticalReport);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.embeds[0].color).toBe(0x8B0000); // Dark red
    });

    it('returns failure when Discord responds 4xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 400,
        json: async () => ({ message: 'Invalid Webhook Token' }),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new DiscordAlertAdapter({ webhookUrl });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('discord');
      expect(result.error).toContain('Invalid Webhook Token');
    });

    it('returns failure when fetch throws', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('Connection refused'));
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new DiscordAlertAdapter({ webhookUrl });
      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('discord');
      expect(result.error).toContain('Connection refused');
    });

    it('truncates stack trace to 2000 chars', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 204,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const adapter = new DiscordAlertAdapter({ webhookUrl });
      const longStack = 'x'.repeat(3000);
      const report = makeReport({ stackTrace: longStack });
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      const description = callBody.embeds[0].description;
      expect(description).toContain('x'.repeat(2000));
      expect(description).not.toContain('x'.repeat(2001));
    });
  });
});
