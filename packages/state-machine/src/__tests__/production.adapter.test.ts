/**
 * Tests for ProductionStateMachineAdapter — production state machine with logging and metrics.
 *
 * TDD: tests written before implementation.
 * Uses MemoryLogAdapter from @cenf/logging and a mock ObservabilityManager.
 *
 * @module @cenf/state-machine/__tests__/production.adapter.test
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ValidationError } from '@cenf/core';
import type { ILogManager } from '@cenf/logging';
import type { ObservabilityManager, Span } from '@cenf/observability';
import { ProductionStateMachineAdapter } from '../adapters/production.adapter.js';
import type { StateMachineConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type TestState = 'idle' | 'processing' | 'done' | 'error';
type TestContext = { count: number };

function makeConfig(overrides?: Partial<StateMachineConfig>): StateMachineConfig {
  return {
    initialState: 'idle',
    maxIterations: 100,
    strictMode: true,
    onErrorStrategy: 'stop',
    ...overrides,
  };
}

/** Create a mock ILogManager that captures log calls. */
function createMockLogger(): ILogManager {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockResolvedValue({ status: 'healthy', details: {} }),
  };
}

/** Create a mock Span. */
function createMockSpan(): Span {
  return {
    context: { traceId: 'abc', spanId: 'def', traceFlags: 1 },
    end: vi.fn(),
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    addEvent: vi.fn(),
    recordException: vi.fn(),
  };
}

/** Create a mock ObservabilityManager. */
function createMockObservability(): ObservabilityManager {
  const span = createMockSpan();
  return {
    createSpan: vi.fn().mockReturnValue(span),
    getActiveSpan: vi.fn().mockReturnValue(undefined),
    setAttribute: vi.fn(),
    recordException: vi.fn(),
    addEvent: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockResolvedValue({ status: 'healthy', details: {} }),
  };
}

function buildSimpleMachine(): {
  sm: ProductionStateMachineAdapter<TestState, TestContext>;
  logger: ILogManager;
  obs: ObservabilityManager;
} {
  const logger = createMockLogger();
  const obs = createMockObservability();
  const sm = new ProductionStateMachineAdapter<TestState, TestContext>(
    makeConfig(),
    logger,
    obs,
  );

  sm.registerState('idle', { name: 'idle', description: 'Waiting' });
  sm.registerState('processing', { name: 'processing', description: 'Working' });
  sm.registerState('done', { name: 'done', description: 'Complete' });

  sm.registerTransition({ fromState: 'idle', toState: 'processing' });
  sm.registerTransition({ fromState: 'processing', toState: 'done' });

  sm.registerHandler('idle', () => 'processing');
  sm.registerHandler('processing', () => 'done');

  return { sm, logger, obs };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductionStateMachineAdapter', () => {
  describe('run — basic execution', () => {
    it('executes the full state machine loop', async () => {
      const { sm } = buildSimpleMachine();
      const status = await sm.run({ count: 0 });

      expect(status.isRunning).toBe(false);
      expect(status.isTerminated).toBe(true);
      expect(status.currentState).toBe('done');
      expect(status.transitionCount).toBe(2);
    });

    it('logs start and termination', async () => {
      const { sm, logger } = buildSimpleMachine();
      await sm.run({ count: 0 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'state_machine.started' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'state_machine.terminated' }),
      );
    });

    it('logs each transition', async () => {
      const { sm, logger } = buildSimpleMachine();
      await sm.run({ count: 0 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'state_machine.transition' }),
      );
    });

    it('creates spans for transitions', async () => {
      const { sm, obs } = buildSimpleMachine();
      await sm.run({ count: 0 });

      expect(obs.createSpan).toHaveBeenCalled();
    });
  });

  describe('run — async handler support', () => {
    it('supports async handlers', async () => {
      const logger = createMockLogger();
      const obs = createMockObservability();
      const sm = new ProductionStateMachineAdapter<TestState, TestContext>(
        makeConfig(),
        logger,
        obs,
      );

      sm.registerState('idle', { name: 'idle' });
      sm.registerState('done', { name: 'done' });
      sm.registerTransition({ fromState: 'idle', toState: 'done' });
      sm.registerHandler('idle', async () => 'done');

      const status = await sm.run({ count: 0 });
      expect(status.currentState).toBe('done');
    });
  });

  describe('run — error handling', () => {
    it('logs handler errors', async () => {
      const logger = createMockLogger();
      const obs = createMockObservability();
      const sm = new ProductionStateMachineAdapter<TestState, TestContext>(
        makeConfig({ onErrorStrategy: 'stop' }),
        logger,
        obs,
      );

      sm.registerState('idle', { name: 'idle' });
      sm.registerHandler('idle', () => {
        throw new Error('production-boom');
      });

      const status = await sm.run({ count: 0 });
      expect(status.errors).toContain('production-boom');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'state_machine.handler_error' }),
      );
    });

    it('records exceptions on observability span', async () => {
      const logger = createMockLogger();
      const obs = createMockObservability();
      const sm = new ProductionStateMachineAdapter<TestState, TestContext>(
        makeConfig({ onErrorStrategy: 'stop' }),
        logger,
        obs,
      );

      sm.registerState('idle', { name: 'idle' });
      sm.registerHandler('idle', () => {
        throw new Error('obs-error');
      });

      await sm.run({ count: 0 });
      expect(obs.recordException).toHaveBeenCalled();
    });

    it('throws ValidationError in strict mode on invalid transition', async () => {
      const logger = createMockLogger();
      const obs = createMockObservability();
      const sm = new ProductionStateMachineAdapter<TestState, TestContext>(
        makeConfig({ strictMode: true }),
        logger,
        obs,
      );

      sm.registerState('idle', { name: 'idle' });
      sm.registerState('error', { name: 'error' });
      sm.registerHandler('idle', () => 'error');

      await expect(sm.run({ count: 0 })).rejects.toThrow(ValidationError);
    });
  });

  describe('run — guard and callbacks', () => {
    it('blocks transition when guard returns false', async () => {
      const logger = createMockLogger();
      const obs = createMockObservability();
      const sm = new ProductionStateMachineAdapter<TestState, TestContext>(
        makeConfig(),
        logger,
        obs,
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
      expect(status.transitionCount).toBe(0);
      expect(status.errors.length).toBeGreaterThan(0);
    });
  });

  describe('lifecycle hooks', () => {
    it('fires onEnter and onExit hooks', async () => {
      const { sm } = buildSimpleMachine();
      const enterHook = vi.fn();
      const exitHook = vi.fn();
      sm.registerLifecycleHook('onEnter', 'processing', enterHook);
      sm.registerLifecycleHook('onExit', 'idle', exitHook);

      await sm.run({ count: 0 });
      expect(enterHook).toHaveBeenCalledOnce();
      expect(exitHook).toHaveBeenCalledOnce();
    });
  });

  describe('getStatus / reset', () => {
    it('returns current status', () => {
      const { sm } = buildSimpleMachine();
      const status = sm.getStatus();
      expect(status.currentState).toBe('idle');
    });

    it('reset clears events and status', async () => {
      const { sm } = buildSimpleMachine();
      await sm.run({ count: 0 });
      sm.reset();

      expect(sm.getEvents()).toEqual([]);
      expect(sm.getStatus().currentState).toBe('idle');
    });
  });

  describe('validateTransition', () => {
    it('throws ValidationError for invalid transition', () => {
      const { sm } = buildSimpleMachine();
      expect(() => sm.validateTransition('idle', 'done')).toThrow(ValidationError);
    });
  });

  describe('AsyncLifecycle', () => {
    it('health() returns healthy', async () => {
      const { sm } = buildSimpleMachine();
      const h = await sm.health();
      expect(h.status).toBe('healthy');
    });
  });
});
