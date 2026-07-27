/**
 * InMemoryStateMachineAdapter — Map-backed state machine adapter for testing.
 *
 * Provides a fully in-memory StateMachineManager implementation for unit tests.
 * All states, transitions, handlers, and events are stored in Maps and arrays.
 * Supports lifecycle hooks, error strategies, and strict mode validation.
 *
 * @module @cenf/state-machine/adapters/memory.adapter
 */

import type { HealthStatus } from '@cenf/core';
import { ValidationError } from '@cenf/core';
import type { StateMachineManager } from '../ports.js';
import type {
  LifecycleHookType,
  StateDefinition,
  StateMachineConfig,
  StateMachineStatus,
  TransitionEvent,
  TransitionRule,
} from '../types.js';

/**
 * Map-backed state machine for unit testing.
 *
 * Stores all registration data in Maps. The run() loop dispatches
 * handlers synchronously, validates transitions, and records events.
 *
 * @typeParam S - String literal union of valid state names.
 * @typeParam C - Context object type passed to every handler.
 */
export class InMemoryStateMachineAdapter<
  S extends string = string,
  C extends Record<string, unknown> = Record<string, unknown>,
> implements StateMachineManager<S, C> {
  private readonly _config: StateMachineConfig;
  private readonly _states: Map<S, StateDefinition> = new Map();
  private readonly _transitions: TransitionRule<S>[] = [];
  private readonly _handlers: Map<S, (ctx: C) => S> = new Map();
  private readonly _hooks: Record<LifecycleHookType, Map<S, Array<(ctx: C) => void>>> = {
    onEnter: new Map(),
    onExit: new Map(),
    onError: new Map(),
  };
  private _events: TransitionEvent[] = [];
  private _status: StateMachineStatus;

  constructor(config: StateMachineConfig) {
    this._config = config;
    this._status = {
      currentState: config.initialState,
      isRunning: false,
      isTerminated: false,
      transitionCount: 0,
      errors: [],
    };
  }

  // -------------------------------------------------------------------
  // Public API — StateMachineManager interface
  // -------------------------------------------------------------------

  registerState(state: S, definition: StateDefinition): void {
    this._states.set(state, definition);
  }

  registerTransition(rule: TransitionRule<S>): void {
    this._transitions.push(rule);
  }

  registerHandler(state: S, handler: (ctx: C) => S): void {
    this._handlers.set(state, handler);
  }

  getHandler(state: S): ((ctx: C) => S) | undefined {
    return this._handlers.get(state);
  }

  getValidTransitions(state: S): TransitionRule<S>[] {
    return this._transitions.filter((r) => r.fromState === state);
  }

  isValidTransition(from: S, to: S): boolean {
    return this._transitions.some(
      (r) => r.fromState === from && r.toState === to,
    );
  }

  validateTransition(from: S, to: S): void {
    if (!this.isValidTransition(from, to)) {
      throw new ValidationError(`Invalid transition: ${from} -> ${to}`);
    }
  }

  async run(ctx: C, startState?: S): Promise<StateMachineStatus> {
    let current: S = startState ?? (this._config.initialState as S);
    let previous: S | undefined;

    this._status = {
      currentState: current,
      isRunning: true,
      isTerminated: false,
      transitionCount: 0,
      errors: [],
      startTime: Date.now(),
    };

    this._fireHook('onEnter', current, ctx);

    for (let i = 0; i < this._config.maxIterations; i++) {
      const handler = this._handlers.get(current);
      if (!handler) break;

      let nextState: S;
      try {
        nextState = handler(ctx);
      } catch (exc) {
        this._handleError(current, ctx, exc);
        if (!this._applyErrorStrategy(previous)) break;
        continue;
      }

      if (!this.isValidTransition(current, nextState)) {
        if (this._config.strictMode) {
          this._status.isRunning = false;
          this._status.isTerminated = true;
          throw new ValidationError(
            `Invalid transition: ${current} -> ${nextState}`,
          );
        }
        this._status.errors.push(
          `Invalid transition: ${current} -> ${nextState}`,
        );
        break;
      }

      const rule = this._getRule(current, nextState);
      if (rule?.guard && !rule.guard(ctx)) {
        this._status.errors.push(`Guard blocked: ${current} -> ${nextState}`);
        break;
      }

      this._fireHook('onExit', current, ctx);
      this._events.push({
        fromState: current,
        toState: nextState,
        timestamp: Date.now(),
        contextSnapshot: {},
        success: true,
      });

      if (rule?.onTransition) {
        rule.onTransition(ctx);
      }

      previous = current;
      current = nextState;
      this._status.transitionCount++;
      this._status.currentState = current;
      this._fireHook('onEnter', current, ctx);
    }

    this._status.isRunning = false;
    this._status.isTerminated = true;
    return this._status;
  }

  getStatus(): StateMachineStatus {
    return this._status;
  }

  reset(): void {
    this._events = [];
    this._status = {
      currentState: this._config.initialState,
      isRunning: false,
      isTerminated: false,
      transitionCount: 0,
      errors: [],
    };
  }

  registerLifecycleHook(
    hookType: LifecycleHookType,
    state: S,
    hook: (ctx: C) => void,
  ): void {
    const hooksMap = this._hooks[hookType];
    const existing = hooksMap.get(state) ?? [];
    existing.push(hook);
    hooksMap.set(state, existing);
  }

  // -------------------------------------------------------------------
  // AsyncLifecycle
  // -------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: in-memory adapter requires no initialization
  }

  async stop(): Promise<void> {
    // No-op: nothing to clean up
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: { adapter: 'memory', events: this._events.length },
    };
  }

  // -------------------------------------------------------------------
  // Test helpers (not part of port interface)
  // -------------------------------------------------------------------

  /** Return all recorded transition events. */
  getEvents(): TransitionEvent[] {
    return [...this._events];
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  private _fireHook(hookType: LifecycleHookType, state: S, ctx: C): void {
    const hooks = this._hooks[hookType].get(state);
    if (hooks) {
      for (const hook of hooks) {
        hook(ctx);
      }
    }
  }

  private _getRule(from: S, to: S): TransitionRule<S> | undefined {
    return this._transitions.find(
      (r) => r.fromState === from && r.toState === to,
    );
  }

  private _handleError(state: S, ctx: C, exc: unknown): void {
    this._fireHook('onError', state, ctx);
    const message = exc instanceof Error ? exc.message : String(exc);
    this._status.errors.push(message);
    this._events.push({
      fromState: state,
      toState: state,
      timestamp: Date.now(),
      contextSnapshot: {},
      success: false,
      error: message,
    });
  }

  private _applyErrorStrategy(previous: S | undefined): boolean {
    const strategy = this._config.onErrorStrategy;
    if (strategy === 'stop') return false;
    if (strategy === 'rollback' && previous !== undefined) {
      this._status.currentState = previous;
      return true;
    }
    return strategy === 'retry';
  }
}
