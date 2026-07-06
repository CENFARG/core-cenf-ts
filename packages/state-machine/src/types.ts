/**
 * CENF StateMachineManager types — Zod schemas and TypeScript types.
 *
 * Defines state definitions, transition rules, transition events,
 * machine configuration, and runtime status. All models use Zod
 * for runtime validation with inferred TypeScript types.
 *
 * @module @cenf/state-machine/types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// StateDefinition
// ---------------------------------------------------------------------------

/** Zod schema for a named state definition. */
export const StateDefinitionSchema = z.object({
  /** Unique state identifier. */
  name: z.string().min(1),
  /** Optional human-readable description. */
  description: z.string().optional(),
  /** Arbitrary metadata for extensibility. */
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/** Inferred type from StateDefinitionSchema. */
export type StateDefinition = z.infer<typeof StateDefinitionSchema>;

// ---------------------------------------------------------------------------
// TransitionRule
// ---------------------------------------------------------------------------

/**
 * Zod schema for a transition rule between two states.
 *
 * Guard and onTransition callables are NOT part of the Zod schema
 * (excluded from serialization). They are added as optional fields
 * in the TypeScript type.
 */
export const TransitionRuleSchema = z.object({
  /** Source state name. */
  fromState: z.string().min(1),
  /** Target state name. */
  toState: z.string().min(1),
});

/** Base inferred type from TransitionRuleSchema. */
type TransitionRuleBase = z.infer<typeof TransitionRuleSchema>;

/**
 * Full transition rule including optional guard and callback.
 *
 * Guard and onTransition are callables excluded from Zod validation
 * to prevent serialization of function references.
 */
export interface TransitionRule<S extends string = string>
  extends TransitionRuleBase {
  /** Guard callable; return false to block the transition. */
  guard?: (ctx: unknown) => boolean;
  /** Callback invoked after a successful transition. */
  onTransition?: (ctx: unknown) => void;
}

// ---------------------------------------------------------------------------
// TransitionEvent
// ---------------------------------------------------------------------------

/** Zod schema for a transition audit event. */
export const TransitionEventSchema = z.object({
  /** Source state name. */
  fromState: z.string().min(1),
  /** Target state name. */
  toState: z.string().min(1),
  /** Unix timestamp (ms) of the transition. */
  timestamp: z.number(),
  /** Snapshot of relevant context at transition time. */
  contextSnapshot: z.record(z.string(), z.unknown()).default({}),
  /** Whether the transition succeeded. */
  success: z.boolean().default(true),
  /** Error message if the transition failed. */
  error: z.string().optional(),
});

/** Inferred type from TransitionEventSchema. */
export type TransitionEvent = z.infer<typeof TransitionEventSchema>;

// ---------------------------------------------------------------------------
// StateMachineConfig
// ---------------------------------------------------------------------------

/** Zod schema for state machine configuration. */
export const StateMachineConfigSchema = z.object({
  /** The state the machine starts in. */
  initialState: z.string().min(1),
  /** Safety limit to prevent infinite loops. */
  maxIterations: z.number().int().min(1).default(100),
  /** If true, invalid transitions throw ValidationError. */
  strictMode: z.boolean().default(true),
  /** Recovery strategy on handler errors. */
  onErrorStrategy: z.enum(['rollback', 'stop', 'retry']).default('stop'),
});

/** Inferred type from StateMachineConfigSchema. */
export type StateMachineConfig = z.infer<typeof StateMachineConfigSchema>;

// ---------------------------------------------------------------------------
// StateMachineStatus
// ---------------------------------------------------------------------------

/** Zod schema for runtime status snapshot. */
export const StateMachineStatusSchema = z.object({
  /** Current active state. */
  currentState: z.string(),
  /** True while the run loop is executing. */
  isRunning: z.boolean().default(false),
  /** True after the run loop completes. */
  isTerminated: z.boolean().default(false),
  /** Number of successful transitions. */
  transitionCount: z.number().int().min(0).default(0),
  /** List of error messages encountered. */
  errors: z.array(z.string()).default([]),
  /** Unix timestamp (ms) when run() started. */
  startTime: z.number().optional(),
});

/** Inferred type from StateMachineStatusSchema. */
export type StateMachineStatus = z.infer<typeof StateMachineStatusSchema>;

// ---------------------------------------------------------------------------
// Lifecycle hook type
// ---------------------------------------------------------------------------

/** Valid lifecycle hook types for state machine events. */
export type LifecycleHookType = 'onEnter' | 'onExit' | 'onError';

// ---------------------------------------------------------------------------
// Runtime version constant
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const STATE_MACHINE_TYPES_VERSION = '0.1.0';
