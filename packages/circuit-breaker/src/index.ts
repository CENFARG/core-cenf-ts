/**
 * @cenf/circuit-breaker — fault-tolerance pattern.
 *
 * @module @cenf/circuit-breaker
 */

// Port
export { type CircuitBreakerManager, CIRCUIT_BREAKER_PORT_VERSION } from './ports.js';

// Types
export type { CircuitState, CircuitOptions } from './types.js';
export { CIRCUIT_BREAKER_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryCircuitBreakerAdapter } from './adapters/memory.adapter.js';
