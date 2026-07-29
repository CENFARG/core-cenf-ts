/**
 * In-memory alert adapter — stores alerts in memory for testing.
 *
 * Implements the AlertManager port with zero external dependencies.
 * Stores dispatched alerts in an in-memory array for retrieval
 * and verification during testing.
 *
 * @module managers/alert/adapters/memory.adapter
 */

import type { AlertManager } from '../ports.js';
import type { AlertLevel, AlertChannel, AlertMessage } from '../types.js';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// InMemoryAlertAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory alert adapter backed by an in-memory store.
 *
 * Stores all dispatched alerts in an array. Useful for testing
 * alert dispatching logic without configuring real channels.
 *
 * Use this adapter:
 * - In unit tests where a real alert backend is not available
 * - For verifying alert formatting and routing logic
 * - As a fallback when the production alert service is unavailable
 */
export class InMemoryAlertAdapter implements AlertManager {
  private alerts: AlertMessage[] = [];
  private channels: AlertChannel[] = [];
  private counter = 0;

  /**
   * Create an in-memory alert adapter.
   *
   * @param channels - Optional list of alert channels. Defaults to a single
   *                   console channel if not provided.
   */
  constructor(channels?: AlertChannel[]) {
    this.channels = channels ?? [
      { id: 'console', name: 'Console', type: 'console', enabled: true },
    ];
  }

  // -----------------------------------------------------------------------
  // AlertManager — sendAlert / getChannels
  // -----------------------------------------------------------------------

  async sendAlert(
    level: AlertLevel,
    title: string,
    message: string,
    channel?: string,
  ): Promise<AlertMessage> {
    this.counter += 1;
    const alert: AlertMessage = {
      id: `alert-${this.counter}`,
      level,
      title,
      message,
      channel,
      timestamp: new Date(),
      delivered: true,
    };
    this.alerts.push(alert);
    return alert;
  }

  async getChannels(): Promise<AlertChannel[]> {
    return [...this.channels];
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.alerts = [];
    this.counter = 0;
  }

  async stop(): Promise<void> {
    this.alerts = [];
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        alertsStored: this.alerts.length,
        channelsConfigured: this.channels.length,
      },
    };
  }
}
