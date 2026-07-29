/**
 * AlertManager port interface — multi-channel alert dispatching.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/alert/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { AlertLevel, AlertChannel, AlertMessage } from './types.js';

/**
 * Alert manager port for dispatching alerts across multiple channels.
 *
 * Provides severity-based alerting with configurable delivery channels.
 * Supports INFO, WARNING, ERROR, and CRITICAL levels.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface AlertManager extends AsyncLifecycle {
  /**
   * Dispatch an alert message.
   *
   * Creates an alert at the given severity level. If a specific channel
   * is provided, the alert is routed to that channel; otherwise, the
   * default channel is used.
   *
   * @param level - Severity level of the alert.
   * @param title - Short summary of the alert.
   * @param message - Detailed description of the alert condition.
   * @param channel - Optional target channel ID.
   * @returns The created alert message with delivery status.
   */
  sendAlert(
    level: AlertLevel,
    title: string,
    message: string,
    channel?: string,
  ): Promise<AlertMessage>;

  /**
   * Retrieve all configured alert delivery channels.
   *
   * Returns the list of available channels with their type,
   * name, and enabled status.
   *
   * @returns An array of configured alert channels.
   */
  getChannels(): Promise<AlertChannel[]>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const ALERT_PORT_VERSION = '0.1.0';
