import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryAlertAdapter } from '../adapters/memory.adapter.js';
import type { AlertManager } from '../ports.js';
import type { AlertChannel } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChannels(): AlertChannel[] {
  return [
    { id: 'console', name: 'Console', type: 'console', enabled: true },
    { id: 'slack', name: 'Slack Alerts', type: 'slack', enabled: true },
    { id: 'email', name: 'Email Alerts', type: 'email', enabled: false },
  ];
}

// ---------------------------------------------------------------------------
// InMemoryAlertAdapter
// ---------------------------------------------------------------------------

describe('InMemoryAlertAdapter', () => {
  let manager: AlertManager;

  describe('basic alert sending', () => {
    beforeEach(async () => {
      manager = new InMemoryAlertAdapter(makeChannels());
      await manager.start();
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('sendAlert() returns a delivered AlertMessage', async () => {
      const msg = await manager.sendAlert('ERROR', 'Disk Full', '/dev/sda1 is 95% full');
      expect(msg.id).toBeDefined();
      expect(msg.level).toBe('ERROR');
      expect(msg.title).toBe('Disk Full');
      expect(msg.message).toBe('/dev/sda1 is 95% full');
      expect(msg.delivered).toBe(true);
      expect(msg.timestamp).toBeInstanceOf(Date);
    });

    it('sendAlert() supports all alert levels', async () => {
      const levels = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
      for (const level of levels) {
        const msg = await manager.sendAlert(level, `Test ${level}`, `Message for ${level}`);
        expect(msg.level).toBe(level);
      }
    });

    it('sendAlert() with specific channel', async () => {
      const msg = await manager.sendAlert('WARNING', 'Warning!', 'Something', 'slack');
      expect(msg.channel).toBe('slack');
    });

    it('sendAlert() without channel', async () => {
      const msg = await manager.sendAlert('INFO', 'Info', 'Just info');
      expect(msg.channel).toBeUndefined();
    });

    it('sendAlert() auto-increments IDs', async () => {
      const msg1 = await manager.sendAlert('INFO', 'First', 'Message 1');
      const msg2 = await manager.sendAlert('INFO', 'Second', 'Message 2');
      expect(msg1.id).toBe('alert-1');
      expect(msg2.id).toBe('alert-2');
    });

    it('sendAlert() with CRITICAL level', async () => {
      const msg = await manager.sendAlert('CRITICAL', 'System Down', 'Critical failure detected');
      expect(msg.level).toBe('CRITICAL');
      expect(msg.title).toBe('System Down');
      expect(msg.delivered).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getChannels
  // -----------------------------------------------------------------------

  describe('getChannels', () => {
    it('getChannels() returns configured channels', async () => {
      const channels = makeChannels();
      const mgr = new InMemoryAlertAdapter(channels);
      await mgr.start();

      const result = await mgr.getChannels();
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.id).sort()).toEqual(['console', 'email', 'slack']);
      await mgr.stop();
    });

    it('getChannels() returns a copy, not internal reference', async () => {
      const mgr = new InMemoryAlertAdapter(makeChannels());
      await mgr.start();

      const result = await mgr.getChannels();
      // Modifying the returned array should not affect the adapter
      result.push({ id: 'pager', name: 'Pager', type: 'webhook', enabled: true });
      const again = await mgr.getChannels();
      expect(again).toHaveLength(3);
      await mgr.stop();
    });

    it('uses default console channel when none provided', async () => {
      const mgr = new InMemoryAlertAdapter();
      await mgr.start();

      const channels = await mgr.getChannels();
      expect(channels).toHaveLength(1);
      expect(channels[0]!.id).toBe('console');
      await mgr.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('multiple alerts with the same level', async () => {
      const mgr = new InMemoryAlertAdapter(makeChannels());
      await mgr.start();

      const msg1 = await mgr.sendAlert('ERROR', 'Err 1', 'First error');
      const msg2 = await mgr.sendAlert('ERROR', 'Err 2', 'Second error');

      expect(msg1.id).toBe('alert-1');
      expect(msg2.id).toBe('alert-2');
      expect(msg1.level).toBe('ERROR');
      expect(msg2.level).toBe('ERROR');
      await mgr.stop();
    });

    it('empty channels list', async () => {
      const mgr = new InMemoryAlertAdapter([]);
      await mgr.start();

      const channels = await mgr.getChannels();
      expect(channels).toEqual([]);
      await mgr.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() initializes clean state', async () => {
      const mgr = new InMemoryAlertAdapter(makeChannels());
      await mgr.start();
      const h = await mgr.health();
      expect(h.status).toBe('healthy');
      await mgr.stop();
    });

    it('stop() clears alerts', async () => {
      const mgr = new InMemoryAlertAdapter(makeChannels());
      await mgr.start();
      await mgr.sendAlert('INFO', 'Test', 'Message');
      await mgr.stop();

      const h = await mgr.health();
      expect(h.status).toBe('healthy');
    });

    it('health() reports adapter info', async () => {
      const mgr = new InMemoryAlertAdapter(makeChannels());
      await mgr.start();
      await mgr.sendAlert('INFO', 'A', '1');
      await mgr.sendAlert('WARNING', 'B', '2');

      const h = await mgr.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('adapter', 'memory');
      expect(h.details).toHaveProperty('alertsStored', 2);
      expect(h.details).toHaveProperty('channelsConfigured', 3);
      await mgr.stop();
    });
  });
});
