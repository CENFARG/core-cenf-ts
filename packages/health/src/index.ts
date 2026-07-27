/**
 * @cenf/health — aggregated health checks for Kubernetes probes.
 *
 * @module @cenf/health
 */

// Port
export { type HealthManager, HEALTH_PORT_VERSION } from './ports.js';

// Types
export type { ComponentHealth, HealthReport } from './types.js';
export { HEALTH_TYPES_VERSION } from './types.js';

// Adapters
export { AggregatedHealthCheckAdapter } from './adapters/aggregated.adapter.js';
