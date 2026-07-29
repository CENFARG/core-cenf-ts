/**
 * @cenf/alert — multi-channel alert dispatching.
 *
 * @module @cenf/alert
 */

// Port
export { type AlertManager, ALERT_PORT_VERSION } from './ports.js';

// Types
export type { AlertLevel, AlertChannel, AlertMessage } from './types.js';
export { ALERT_TYPES_VERSION } from './types.js';

// Adapters
export { InMemoryAlertAdapter } from './adapters/memory.adapter.js';
