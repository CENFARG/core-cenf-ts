import { describe, it, expect } from 'vitest';
import {
  ALERT_PORT_VERSION,
  type AlertManager,
} from '../ports.js';
import type { AlertLevel, AlertChannel, AlertMessage } from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of AlertManager for contract verification
// ---------------------------------------------------------------------------

class TestAlertManager implements AlertManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async sendAlert(
    _level: AlertLevel,
    _title: string,
    _message: string,
    _channel?: string,
  ): Promise<AlertMessage> {
    return {
      id: 'test-1',
      level: 'INFO',
      title: 'Test',
      message: 'Test alert',
      timestamp: new Date(),
      delivered: true,
    };
  }

  async getChannels(): Promise<AlertChannel[]> {
    return [
      { id: 'console', name: 'Console', type: 'console', enabled: true },
    ];
  }
}

// ---------------------------------------------------------------------------
// AlertManager port contract
// ---------------------------------------------------------------------------

describe('AlertManager port', () => {
  it('exports a runtime version constant', () => {
    expect(ALERT_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: AlertManager = new TestAlertManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestAlertManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('sendAlert() returns an AlertMessage with required fields', async () => {
    const mgr = new TestAlertManager();
    const msg = await mgr.sendAlert('ERROR', 'Test Error', 'Something went wrong');
    expect(msg.id).toBe('test-1');
    expect(msg.level).toBe('INFO');
    expect(msg.title).toBe('Test');
    expect(msg.delivered).toBe(true);
  });

  it('sendAlert() with specific channel', async () => {
    const mgr = new TestAlertManager();
    const msg = await mgr.sendAlert('CRITICAL', 'Critical!', 'System down', 'slack');
    expect(msg.level).toBe('INFO');
  });

  it('getChannels() returns available channels', async () => {
    const mgr = new TestAlertManager();
    const channels = await mgr.getChannels();
    expect(channels).toHaveLength(1);
    expect(channels[0]!.id).toBe('console');
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestAlertManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

describe('Alert types', () => {
  it('AlertLevel accepts INFO, WARNING, ERROR, CRITICAL', () => {
    const levels: AlertLevel[] = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    expect(levels).toHaveLength(4);
  });

  it('AlertChannel has required fields', () => {
    const channel: AlertChannel = {
      id: 'slack',
      name: 'Slack Alerts',
      type: 'slack',
      enabled: true,
    };
    expect(channel.id).toBe('slack');
    expect(channel.type).toBe('slack');
    expect(channel.enabled).toBe(true);
  });

  it('AlertChannel supports all types', () => {
    const email: AlertChannel = { id: 'e1', name: 'Email', type: 'email', enabled: true };
    const slack: AlertChannel = { id: 's1', name: 'Slack', type: 'slack', enabled: true };
    const webhook: AlertChannel = { id: 'w1', name: 'Webhook', type: 'webhook', enabled: true };
    const console: AlertChannel = { id: 'c1', name: 'Console', type: 'console', enabled: true };

    expect(email.type).toBe('email');
    expect(slack.type).toBe('slack');
    expect(webhook.type).toBe('webhook');
    expect(console.type).toBe('console');
  });

  it('AlertMessage has all required fields', () => {
    const msg: AlertMessage = {
      id: 'alert-42',
      level: 'ERROR',
      title: 'Disk Full',
      message: '/dev/sda1 is 95% full',
      channel: 'slack',
      timestamp: new Date('2026-07-29'),
      delivered: true,
    };
    expect(msg.id).toBe('alert-42');
    expect(msg.level).toBe('ERROR');
    expect(msg.title).toBe('Disk Full');
    expect(msg.message).toBe('/dev/sda1 is 95% full');
    expect(msg.channel).toBe('slack');
    expect(msg.delivered).toBe(true);
  });

  it('AlertMessage allows optional channel', () => {
    const msg: AlertMessage = {
      id: 'alert-1',
      level: 'INFO',
      title: 'Info',
      message: 'Something happened',
      timestamp: new Date(),
      delivered: true,
    };
    expect(msg.channel).toBeUndefined();
  });

  it('AlertMessage channel is optional', () => {
    const msg: AlertMessage = {
      id: 'alert-3',
      level: 'WARNING',
      title: 'Warning',
      message: 'Disk space low',
      timestamp: new Date(),
      delivered: false,
    };
    expect(msg.channel).toBeUndefined();
  });
});
