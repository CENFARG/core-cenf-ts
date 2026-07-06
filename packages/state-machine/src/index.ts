/**
 * @cenf/state-machine — deterministic state machine with guards, hooks, and error strategies.
 *
 * @module @cenf/state-machine
 */

// Port
export {
  type StateMachineManager,
  STATE_MACHINE_PORT_VERSION,
} from './ports.js';

// Types
export type {
  StateDefinition,
  TransitionRule,
  TransitionEvent,
  StateMachineConfig,
  StateMachineStatus,
  LifecycleHookType,
} from './types.js';
export {
  StateDefinitionSchema,
  TransitionRuleSchema,
  TransitionEventSchema,
  StateMachineConfigSchema,
  StateMachineStatusSchema,
  STATE_MACHINE_TYPES_VERSION,
} from './types.js';

// Adapters
export { InMemoryStateMachineAdapter } from './adapters/memory.adapter.js';
export { ProductionStateMachineAdapter } from './adapters/production.adapter.js';
