/**
 * AlertManager-specific types.
 *
 * Types for alert levels, channels, and messages.
 *
 * @module managers/alert/types
 */

// ---------------------------------------------------------------------------
// AlertLevel — severity classification
// ---------------------------------------------------------------------------

/**
 * Severity level for an alert message.
 *
 * - `INFO`: Informational message, no action required.
 * - `WARNING`: Potential issue, attention recommended.
 * - `ERROR`: Operation failure, immediate attention needed.
 * - `CRITICAL`: System-level failure, urgent action required.
 */
export type AlertLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

// ---------------------------------------------------------------------------
// AlertChannel — delivery channel configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for an alert delivery channel.
 *
 * Defines how alerts are dispatched and whether the channel
 * is currently active.
 */
export interface AlertChannel {
  /** Unique identifier for the channel. */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** Channel type determining the delivery mechanism. */
  type: 'email' | 'slack' | 'webhook' | 'console';

  /** Whether this channel is currently active. */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// AlertMessage — a single alert instance
// ---------------------------------------------------------------------------

/**
 * A single alert message that has been dispatched.
 *
 * Contains the full payload including severity, content,
 * delivery routing, and delivery status.
 */
export interface AlertMessage {
  /** Unique identifier for this alert instance. */
  id: string;

  /** Severity level of the alert. */
  level: AlertLevel;

  /** Short, human-readable summary of the alert. */
  title: string;

  /** Detailed description of the alert condition. */
  message: string;

  /** Optional target channel ID. Omit for default routing. */
  channel?: string;

  /** Timestamp when the alert was created. */
  timestamp: Date;

  /** Whether the alert was successfully delivered. */
  delivered: boolean;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const ALERT_TYPES_VERSION = '0.1.0';
