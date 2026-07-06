/**
 * Tests for InMemoryStateMachineAdapter — dict-backed state machine for testing.
 *
 * TDD: tests written before implementation.
 *
 * @module @cenf/state-machine/__tests__/memory.adapter.test
 */

import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@cenf/core';
import { InMemoryStateMachineAdapter } from '../adapters/memory.adapter.js';
import type { StateDefinition, StateMachineConfig, TransitionRule } from '../types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type TestState = 'idle' | 'processing' | 'done' | 'error';
type TestContext = { count: number; shouldFail?: boolean };

function makeConfig(overrides?: Partial<StateMachineConfig>): StateMachineConfig {
  return {
    initialState: 'idle',
    maxIterations: 100,
    strictMode: true,
    onErrorStrategy: 'stop',
    ...overrides,
  };
}

function buildSimpleMachine(): InMemoryStateMachineAdapter<TestState, TestContext> {
  const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(makeConfig());

  sm.registerState('idle', { name: 'idle', description: 'Waiting' });
  sm.registerState('processing', { name: 'processing', description: 'Working' });
  sm.registerState('done', { name: 'done', description: 'Complete' });

  sm.registerTransition({ fromState: 'idle', toState: 'processing' });
  sm.registerTransition({ fromState: 'processing', toState: 'done' });

  sm.registerHandler('idle', () => 'processing');
  sm.registerHandler('processing', () => 'done');

  return sm;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryStateMachineAdapter', () => {
  describe('registerState', () => {
    it('registers a state definition', () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(makeConfig());
      const def: StateDefinition = { name: 'idle', description: 'Waiting' };
      sm.registerState('idle', def);
      // No throw = success; verify via getValidTransitions later
    });
  });

  describe('registerTransition', () => {
    it('registers a transition rule', () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(makeConfig());
      sm.registerTransition({ fromState: 'idle', toState: 'processing' });
      expect(sm.isValidTransition('idle', 'processing')).toBe(true);
    });
  });

  describe('registerHandler / getHandler', () => {
    it('binds and retrieves a handler', () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(makeConfig());
      const handler = (_ctx: TestContext) => 'done' as TestState;
      sm.registerHandler('idle', handler);
      expect(sm.getHandler('idle')).toBe(handler);
    });

    it('returns undefined for unregistered state', () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(makeConfig());
      expect(sm.getHandler('idle')).toBeUndefined();
    });
  });

  describe('getValidTransitions', () => {
    it('returns transitions from a given state', () => {
      const sm = buildSimpleMachine();
      const transitions = sm.getValidTransitions('idle');
      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.toState).toBe('processing');
    });

    it('returns empty array for state with no transitions', () => {
      const sm = buildSimpleMachine();
      expect(sm.getValidTransitions('done')).toEqual([]);
    });
  });

  describe('isValidTransition', () => {
    it('returns true for registered transition', () => {
      const sm = buildSimpleMachine();
      expect(sm.isValidTransition('idle', 'processing')).toBe(true);
    });

    it('returns false for unregistered transition', () => {
      const sm = buildSimpleMachine();
      expect(sm.isValidTransition('idle', 'done')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('does not throw for valid transition', () => {
      const sm = buildSimpleMachine();
      expect(() => sm.validateTransition('idle', 'processing')).not.toThrow();
    });

    it('throws ValidationError for invalid transition', () => {
      const sm = buildSimpleMachine();
      expect(() => sm.validateTransition('idle', 'done')).toThrow(ValidationError);
    });
  });

  describe('run', () => {
    it('executes the full state machine loop', async () => {
      const sm = buildSimpleMachine();
      const ctx: TestContext = { count: 0 };
      const status = await sm.run(ctx);

      expect(status.isRunning).toBe(false);
      expect(status.isTerminated).toBe(true);
      expect(status.currentState).toBe('done');
      expect(status.transitionCount).toBe(2);
      expect(status.errors).toEqual([]);
    });

    it('uses startState override', async () => {
      const sm = buildSimpleMachine();
      const ctx: TestContext = { count: 0 };
      const status = await sm.run(ctx, 'processing');

      expect(status.currentState).toBe('done');
      expect(status.transitionCount).toBe(1);
    });

    it('stops when no handler is registered for current state', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ initialState: 'done' }),
      );
      sm.registerState('done', { name: 'done' });

      const status = await sm.run({ count: 0 });
      expect(status.isTerminated).toBe(true);
      expect(status.transitionCount).toBe(0);
    });

    it('respects maxIterations guard', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ maxIterations: 2 }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('processing', { name: 'processing' });
      sm.registerTransition({ fromState: 'idle', toState: 'processing' });
      sm.registerTransition({ fromState: 'processing', toState: 'idle' });
      sm.registerHandler('idle', () => 'processing');
      sm.registerHandler('processing', () => 'idle');

      const status = await sm.run({ count: 0 });
      expect(status.isTerminated).toBe(true);
      expect(status.transitionCount).toBe(2);
    });

    it('throws ValidationError in strict_mode on invalid transition', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ strictMode: true }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('error', { name: 'error' });
      // No transition registered from idle to error
      sm.registerHandler('idle', () => 'error');

      await expect(sm.run({ count: 0 })).rejects.toThrow(ValidationError);
    });

    it('appends error in non-strict mode on invalid transition', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ strictMode: false }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('error', { name: 'error' });
      sm.registerHandler('idle', () => 'error');

      const status = await sm.run({ count: 0 });
      expect(status.isTerminated).toBe(true);
      expect(status.errors.length).toBeGreaterThan(0);
    });

    it('records transition events', async () => {
      const sm = buildSimpleMachine();
      await sm.run({ count: 0 });
      const events = sm.getEvents();

      expect(events).toHaveLength(2);
      expect(events[0]!.fromState).toBe('idle');
      expect(events[0]!.toState).toBe('processing');
      expect(events[0]!.success).toBe(true);
      expect(events[1]!.fromState).toBe('processing');
      expect(events[1]!.toState).toBe('done');
    });

    it('fires guard and blocks transition when guard returns false', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig(),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('processing', { name: 'processing' });
      sm.registerTransition({
        fromState: 'idle',
        toState: 'processing',
        guard: () => false,
      });
      sm.registerHandler('idle', () => 'processing');

      const status = await sm.run({ count: 0 });
      expect(status.isTerminated).toBe(true);
      expect(status.transitionCount).toBe(0);
      expect(status.errors.length).toBeGreaterThan(0);
    });

    it('fires onTransition callback', async () => {
      const callback = vi.fn();
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig(),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('processing', { name: 'processing' });
      sm.registerTransition({
        fromState: 'idle',
        toState: 'processing',
        onTransition: callback,
      });
      sm.registerHandler('idle', () => 'processing');

      await sm.run({ count: 0 });
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('error strategies', () => {
    it('stop strategy: halts on handler error', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ onErrorStrategy: 'stop' }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('processing', { name: 'processing' });
      sm.registerTransition({ fromState: 'idle', toState: 'processing' });
      sm.registerHandler('idle', () => {
        throw new Error('boom');
      });

      const status = await sm.run({ count: 0 });
      expect(status.isTerminated).toBe(true);
      expect(status.errors).toContain('boom');
    });

    it('retry strategy: retries the same state', async () => {
      let attempts = 0;
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ onErrorStrategy: 'retry', maxIterations: 5 }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('done', { name: 'done' });
      sm.registerTransition({ fromState: 'idle', toState: 'done' });
      sm.registerHandler('idle', () => {
        attempts++;
        if (attempts < 3) throw new Error('transient');
        return 'done';
      });

      const status = await sm.run({ count: 0 });
      expect(status.currentState).toBe('done');
      expect(attempts).toBe(3);
    });

    it('rollback strategy: rolls back to previous state on error', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ onErrorStrategy: 'rollback', maxIterations: 5 }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerState('processing', { name: 'processing' });
      sm.registerState('done', { name: 'done' });
      sm.registerTransition({ fromState: 'idle', toState: 'processing' });
      sm.registerTransition({ fromState: 'processing', toState: 'done' });
      sm.registerHandler('idle', () => 'processing');
      sm.registerHandler('processing', () => {
        throw new Error('rollback-me');
      });

      const status = await sm.run({ count: 0 });
      // After rollback, current state should be 'idle' (previous)
      expect(status.currentState).toBe('idle');
      expect(status.errors).toContain('rollback-me');
    });
  });

  describe('lifecycle hooks', () => {
    it('fires onEnter hook when entering a state', async () => {
      const sm = buildSimpleMachine();
      const hook = vi.fn();
      sm.registerLifecycleHook('onEnter', 'processing', hook);

      await sm.run({ count: 0 });
      expect(hook).toHaveBeenCalledOnce();
    });

    it('fires onExit hook when leaving a state', async () => {
      const sm = buildSimpleMachine();
      const hook = vi.fn();
      sm.registerLifecycleHook('onExit', 'idle', hook);

      await sm.run({ count: 0 });
      expect(hook).toHaveBeenCalledOnce();
    });

    it('fires onError hook when handler throws', async () => {
      const sm = new InMemoryStateMachineAdapter<TestState, TestContext>(
        makeConfig({ onErrorStrategy: 'stop' }),
      );
      sm.registerState('idle', { name: 'idle' });
      sm.registerHandler('idle', () => {
        throw new Error('hook-test');
      });

      const hook = vi.fn();
      sm.registerLifecycleHook('onError', 'idle', hook);

      await sm.run({ count: 0 });
      expect(hook).toHaveBeenCalledOnce();
    });
  });

  describe('getStatus', () => {
    it('returns current status', () => {
      const sm = buildSimpleMachine();
      const status = sm.getStatus();
      expect(status.currentState).toBe('idle');
      expect(status.isRunning).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears events and resets status', async () => {
      const sm = buildSimpleMachine();
      await sm.run({ count: 0 });

      expect(sm.getEvents().length).toBeGreaterThan(0);

      sm.reset();
      expect(sm.getEvents()).toEqual([]);
      expect(sm.getStatus().currentState).toBe('idle');
      expect(sm.getStatus().transitionCount).toBe(0);
    });

    it('preserves registrations after reset', async () => {
      const sm = buildSimpleMachine();
      await sm.run({ count: 0 });
      sm.reset();

      // Should still be able to run
      const status = await sm.run({ count: 0 });
      expect(status.currentState).toBe('done');
    });
  });

  describe('AsyncLifecycle', () => {
    it('start() is a no-op', async () => {
      const sm = buildSimpleMachine();
      await expect(sm.start()).resolves.toBeUndefined();
    });

    it('stop() is a no-op', async () => {
      const sm = buildSimpleMachine();
      await expect(sm.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy', async () => {
      const sm = buildSimpleMachine();
      const h = await sm.health();
      expect(h.status).toBe('healthy');
    });
  });
});
