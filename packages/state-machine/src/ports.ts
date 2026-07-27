/**
 * StateMachineManager port interface — deterministic state machine contract.
 *
 * Defines the state machine interface for deterministic workflow execution.
 * States are registered with definitions, transitions are governed by rules
 * with optional guards, and handlers drive the execution loop.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module @cenf/state-machine/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type {
  LifecycleHookType,
  StateDefinition,
  StateMachineStatus,
  TransitionRule,
} from './types.js';

/**
 * Deterministic state machine contract for workflow execution.
 *
 * All CENF programs that need deterministic workflow execution consume
 * this interface. Concrete adapters provide in-memory execution for
 * testing and production-grade execution with logging and metrics.
 *
 * @typeParam S - String literal union of valid state names.
 * @typeParam C - Context object type passed to every handler.
 */
export interface StateMachineManager<
  S extends string = string,
  C extends Record<string, unknown> = Record<string, unknown>,
> extends AsyncLifecycle {
  /**
   * Register a named state in the machine.
   *
   * @param state - The state identifier.
   * @param definition - State metadata and description.
   */
  registerState(state: S, definition: StateDefinition): void;

  /**
   * Register a valid transition between two states.
   *
   * @param rule - Transition rule with optional guard and callback.
   */
  registerTransition(rule: TransitionRule<S>): void;

  /**
   * Bind a handler to a state.
   *
   * The handler receives the context and returns the next state.
   *
   * @param state - The state to bind the handler to.
   * @param handler - Function that takes context and returns next state.
   */
  registerHandler(state: S, handler: (ctx: C) => S): void;

  /**
   * Get the handler registered for a state.
   *
   * @param state - The state to look up.
   * @returns The handler function, or undefined if none registered.
   */
  getHandler(state: S): ((ctx: C) => S) | undefined;

  /**
   * Get all valid transitions from a given state.
   *
   * @param state - The source state.
   * @returns Array of TransitionRule objects from the given state.
   */
  getValidTransitions(state: S): TransitionRule<S>[];

  /**
   * Check if a transition between two states is registered.
   *
   * @param from - Source state.
   * @param to - Target state.
   * @returns True if the transition is registered.
   */
  isValidTransition(from: S, to: S): boolean;

  /**
   * Validate a transition, throwing ValidationError if invalid.
   *
   * @param from - Source state.
   * @param to - Target state.
   * @throws {ValidationError} If the transition is not registered.
   */
  validateTransition(from: S, to: S): void;

  /**
   * Execute the state machine loop until termination.
   *
   * @param ctx - The context object passed to every handler.
   * @param startState - Optional override for the initial state.
   * @returns Final status after execution.
   */
  run(ctx: C, startState?: S): Promise<StateMachineStatus>;

  /**
   * Get the current runtime status.
   *
   * @returns Current status snapshot.
   */
  getStatus(): StateMachineStatus;

  /**
   * Reset the machine to its initial configuration.
   *
   * Clears runtime state (events, status) but preserves registered
   * states, transitions, and handlers.
   */
  reset(): void;

  /**
   * Register a lifecycle hook for a specific state.
   *
   * @param hookType - When the hook fires (onEnter, onExit, or onError).
   * @param state - The state the hook is bound to.
   * @param hook - Function invoked with the context.
   */
  registerLifecycleHook(
    hookType: LifecycleHookType,
    state: S,
    hook: (ctx: C) => void,
  ): void;
}

/** Runtime version constant — ensures module existence for TDD. */
export const STATE_MACHINE_PORT_VERSION = '0.1.0';
