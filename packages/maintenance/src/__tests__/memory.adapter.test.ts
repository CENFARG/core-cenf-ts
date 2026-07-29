/**
 * Tests for InMemoryMaintenanceAdapter — dict-backed test double.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMaintenanceAdapter } from '../adapters/memory.adapter.js';
import { ErrorSeverity } from '../types.js';
import type { ErrorReport } from '../types.js';

describe('InMemoryMaintenanceAdapter', () => {
  let adapter: InMemoryMaintenanceAdapter;

  beforeEach(() => {
    adapter = new InMemoryMaintenanceAdapter();
  });

  // -----------------------------------------------------------------------
  // isConsentGranted
  // -----------------------------------------------------------------------

  describe('isConsentGranted()', () => {
    it('returns false by default (GDPR default-off)', async () => {
      const granted = await adapter.isConsentGranted('my-app');
      expect(granted).toBe(false);
    });

    it('returns true after requestConsent', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      const granted = await adapter.isConsentGranted('my-app');
      expect(granted).toBe(true);
    });

    it('returns false after revokeConsent', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      await adapter.revokeConsent('my-app', 'user-1');
      const granted = await adapter.isConsentGranted('my-app');
      expect(granted).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // requestConsent
  // -----------------------------------------------------------------------

  describe('requestConsent()', () => {
    it('returns ConsentResult with GRANTED status', async () => {
      const result = await adapter.requestConsent('my-app', 'user-1');
      expect(result.appId).toBe('my-app');
      expect(result.userId).toBe('user-1');
      expect(result.status).toBe('GRANTED');
      expect(result.timestamp).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // revokeConsent
  // -----------------------------------------------------------------------

  describe('revokeConsent()', () => {
    it('returns ConsentResult with REVOKED status', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      const result = await adapter.revokeConsent('my-app', 'user-1');
      expect(result.status).toBe('REVOKED');
    });

    it('purges telemetry data on revoke', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      await adapter.sendTelemetry('my-app', { event: 'test' });
      const before = adapter.getCapturedMetrics('my-app');
      expect(before).toHaveLength(1);

      await adapter.revokeConsent('my-app', 'user-1');
      const after = adapter.getCapturedMetrics('my-app');
      expect(after).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // captureError
  // -----------------------------------------------------------------------

  describe('captureError()', () => {
    it('returns an ErrorReport with scrubbed data', async () => {
      const error = new Error('test failure');
      const report = await adapter.captureError('my-app', error);

      expect(report.appId).toBe('my-app');
      expect(report.message).toBe('test failure');
      expect(report.severity).toBe(ErrorSeverity.Error);
      expect(report.timestamp).toBeDefined();
      expect(report.stackTrace).toBeDefined();
    });

    it('includes context when provided', async () => {
      const error = new Error('fail');
      const report = await adapter.captureError('my-app', error, { key: 'value' });
      expect(report.context).toEqual({ key: 'value' });
    });

    it('scrubs PII from message', async () => {
      const error = new Error('email: user@example.com');
      const report = await adapter.captureError('my-app', error);
      expect(report.message).toContain('***@example.com');
      expect(report.message).not.toContain('user@example.com');
    });

    it('scrubs PII from context values', async () => {
      const error = new Error('fail');
      const report = await adapter.captureError('my-app', error, {
        userEmail: 'admin@example.com',
        ip: '10.0.0.1',
      });
      expect(report.context!.userEmail).toContain('***@example.com');
      expect(report.context!.ip).toContain('[REDACTED-IP]');
    });

    it('stores captured errors for test access', async () => {
      const error = new Error('fail');
      await adapter.captureError('my-app', error);
      await adapter.captureError('my-app', new Error('second'));

      const captured = adapter.getCapturedErrors('my-app');
      expect(captured).toHaveLength(2);
      expect(captured[0]!.message).toBe('fail');
      expect(captured[1]!.message).toBe('second');
    });

    it('returns empty array for app with no errors', () => {
      const captured = adapter.getCapturedErrors('other-app');
      expect(captured).toEqual([]);
    });

    it('sets default version and os from environment', async () => {
      const error = new Error('fail');
      const report = await adapter.captureError('my-app', error);
      expect(report.version).toBe('0.0.0');
      expect(report.os).toMatch(/^(windows|linux|macos)$/);
    });
  });

  // -----------------------------------------------------------------------
  // reportError
  // -----------------------------------------------------------------------

  describe('reportError()', () => {
    it('reports an error successfully when consent is granted', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      const error = new Error('fail');
      const report = await adapter.captureError('my-app', error);
      const result = await adapter.reportError(report);

      expect(result.success).toBe(true);
      expect(result.target).toBe('in-memory');
    });

    it('fails when consent is not granted', async () => {
      const error = new Error('fail');
      const report = await adapter.captureError('my-app', error);
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('in-memory');
      expect(result.error!.toLowerCase()).toContain('consent');
    });

    it('stores reported errors for test access', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      const report = await adapter.captureError('my-app', new Error('fail'));
      await adapter.reportError(report);

      const reported = adapter.getReportedErrors();
      expect(reported).toHaveLength(1);
      expect(reported[0]!.appId).toBe('my-app');
    });
  });

  // -----------------------------------------------------------------------
  // sendTelemetry
  // -----------------------------------------------------------------------

  describe('sendTelemetry()', () => {
    it('stores telemetry when consent is granted', async () => {
      await adapter.requestConsent('my-app', 'user-1');
      await adapter.sendTelemetry('my-app', { event: 'login', count: 1 });

      const metrics = adapter.getCapturedMetrics('my-app');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]!.event).toBe('login');
    });

    it('does not store telemetry without consent', async () => {
      await adapter.sendTelemetry('my-app', { event: 'login' });
      const metrics = adapter.getCapturedMetrics('my-app');
      expect(metrics).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getJsonSchema
  // -----------------------------------------------------------------------

  describe('getJsonSchema()', () => {
    it('returns a JSON Schema object', () => {
      const schema = adapter.getJsonSchema();
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('title', 'MaintenanceManager');
    });
  });

  // -----------------------------------------------------------------------
  // ErrorSeverity
  // -----------------------------------------------------------------------

  describe('ErrorSeverity usage', () => {
    it('captureError uses ErrorSeverity.Error by default', async () => {
      const error = new Error('fail');
      const report = await adapter.captureError('my-app', error);
      expect(report.severity).toBe(ErrorSeverity.Error);
    });
  });
});
