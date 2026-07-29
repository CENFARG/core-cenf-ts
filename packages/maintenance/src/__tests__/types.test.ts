/**
 * Tests for @cenf/maintenance types.
 */

import { describe, it, expect } from 'vitest';
import { ErrorSeverity, MAINTENANCE_TYPES_VERSION, createMaintenanceConfig, DEFAULT_MAINTENANCE_CONFIG } from '../types.js';
import type { ErrorReport, ConsentResult, ReportResult, MaintenanceConfig } from '../types.js';

describe('ErrorSeverity enum', () => {
  it('has all six severity levels', () => {
    expect(ErrorSeverity.Trace).toBe('TRACE');
    expect(ErrorSeverity.Debug).toBe('DEBUG');
    expect(ErrorSeverity.Info).toBe('INFO');
    expect(ErrorSeverity.Warning).toBe('WARNING');
    expect(ErrorSeverity.Error).toBe('ERROR');
    expect(ErrorSeverity.Critical).toBe('CRITICAL');
  });
});

describe('ErrorReport type', () => {
  it('can be constructed with required fields', () => {
    const report: ErrorReport = {
      appId: 'my-app',
      message: 'Something went wrong',
      severity: ErrorSeverity.Error,
      timestamp: '2026-07-29T00:00:00Z',
    };
    expect(report.appId).toBe('my-app');
    expect(report.message).toBe('Something went wrong');
    expect(report.severity).toBe('ERROR');
    expect(report.stackTrace).toBeUndefined();
    expect(report.version).toBeUndefined();
    expect(report.os).toBeUndefined();
    expect(report.context).toBeUndefined();
    expect(report.tags).toBeUndefined();
  });

  it('can be constructed with all optional fields', () => {
    const report: ErrorReport = {
      appId: 'my-app',
      message: 'Error',
      severity: ErrorSeverity.Critical,
      timestamp: '2026-07-29T00:00:00Z',
      stackTrace: 'Error: fail\n    at main (index.ts:1:1)',
      version: '1.0.0',
      os: 'linux',
      arch: 'x64',
      runtimeVersion: 'Node.js v20.6.0',
      context: { requestId: 'abc-123' },
      tags: { region: 'us-east' },
    };
    expect(report.stackTrace).toContain('main');
    expect(report.version).toBe('1.0.0');
    expect(report.os).toBe('linux');
    expect(report.arch).toBe('x64');
    expect(report.runtimeVersion).toBe('Node.js v20.6.0');
    expect(report.context).toEqual({ requestId: 'abc-123' });
    expect(report.tags).toEqual({ region: 'us-east' });
  });
});

describe('ConsentResult type', () => {
  it('can be constructed with required fields', () => {
    const result: ConsentResult = {
      appId: 'my-app',
      userId: 'user-1',
      status: 'GRANTED',
      timestamp: '2026-07-29T00:00:00Z',
    };
    expect(result.appId).toBe('my-app');
    expect(result.userId).toBe('user-1');
    expect(result.status).toBe('GRANTED');
  });

  it('supports REVOKED and PENDING status', () => {
    const revoked: ConsentResult = { appId: 'x', userId: 'u', status: 'REVOKED', timestamp: '' };
    const pending: ConsentResult = { appId: 'x', userId: 'u', status: 'PENDING', timestamp: '' };
    expect(revoked.status).toBe('REVOKED');
    expect(pending.status).toBe('PENDING');
  });
});

describe('ReportResult type', () => {
  it('can represent a success result', () => {
    const result: ReportResult = {
      success: true,
      target: 'in-memory',
    };
    expect(result.success).toBe(true);
    expect(result.target).toBe('in-memory');
    expect(result.error).toBeUndefined();
  });

  it('can represent a failure result', () => {
    const result: ReportResult = {
      success: false,
      target: 'github',
      error: 'HTTP 403 Forbidden',
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 403 Forbidden');
  });
});

describe('MaintenanceConfig type', () => {
  it('has defaults when partially provided', () => {
    const config = createMaintenanceConfig();
    expect(config.enabled).toBe(false);
    expect(config.consentRequired).toBe(true);
    expect(config.appId).toBe('');
    expect(config.appVersion).toBe('0.1.0');
    expect(config.telemetryEnabled).toBe(false);
    expect(config.errorSampleRate).toBe(1.0);
  });

  it('accepts custom values via createMaintenanceConfig', () => {
    const config = createMaintenanceConfig({
      enabled: true,
      appId: 'my-app',
      appVersion: '2.0.0',
      githubRepo: 'owner/repo',
      discordWebhookUrl: 'https://discord.com/api/webhooks/xxx',
      cenfServerUrl: 'https://cenf.example.com',
      glitchtipDsn: 'https://key@glitchtip.example.com/1',
      telemetryEnabled: true,
      errorSampleRate: 0.5,
    });
    expect(config.enabled).toBe(true);
    expect(config.githubRepo).toBe('owner/repo');
    expect(config.errorSampleRate).toBe(0.5);
  });

  it('allows optional URL fields to be undefined', () => {
    const config = createMaintenanceConfig();
    expect(config.githubRepo).toBeUndefined();
    expect(config.discordWebhookUrl).toBeUndefined();
    expect(config.cenfServerUrl).toBeUndefined();
    expect(config.glitchtipDsn).toBeUndefined();
  });

  it('DEFAULT_MAINTENANCE_CONFIG has correct values', () => {
    expect(DEFAULT_MAINTENANCE_CONFIG.enabled).toBe(false);
    expect(DEFAULT_MAINTENANCE_CONFIG.errorSampleRate).toBe(1.0);
  });
});

describe('MAINTENANCE_TYPES_VERSION', () => {
  it('is a semver string', () => {
    expect(MAINTENANCE_TYPES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
