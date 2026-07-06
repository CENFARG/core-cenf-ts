/**
 * Tests for types.ts — Zod schema validation and type inference.
 *
 * @module @cenf/state-machine/__tests__/types.test
 */

import { describe, expect, it } from 'vitest';
import {
  StateDefinitionSchema,
  StateMachineConfigSchema,
  StateMachineStatusSchema,
  TransitionEventSchema,
  TransitionRuleSchema,
  STATE_MACHINE_TYPES_VERSION,
} from '../types.js';

describe('types', () => {
  describe('StateDefinitionSchema', () => {
    it('accepts a valid state definition', () => {
      const result = StateDefinitionSchema.parse({
        name: 'idle',
        description: 'Waiting state',
      });
      expect(result.name).toBe('idle');
      expect(result.description).toBe('Waiting state');
      expect(result.metadata).toEqual({});
    });

    it('accepts metadata', () => {
      const result = StateDefinitionSchema.parse({
        name: 'processing',
        metadata: { priority: 'high' },
      });
      expect(result.metadata).toEqual({ priority: 'high' });
    });

    it('rejects empty name', () => {
      expect(() => StateDefinitionSchema.parse({ name: '' })).toThrow();
    });

    it('rejects missing name', () => {
      expect(() => StateDefinitionSchema.parse({})).toThrow();
    });
  });

  describe('TransitionRuleSchema', () => {
    it('accepts a valid transition rule', () => {
      const result = TransitionRuleSchema.parse({
        fromState: 'idle',
        toState: 'processing',
      });
      expect(result.fromState).toBe('idle');
      expect(result.toState).toBe('processing');
    });

    it('rejects empty fromState', () => {
      expect(() =>
        TransitionRuleSchema.parse({ fromState: '', toState: 'done' }),
      ).toThrow();
    });

    it('rejects empty toState', () => {
      expect(() =>
        TransitionRuleSchema.parse({ fromState: 'idle', toState: '' }),
      ).toThrow();
    });
  });

  describe('TransitionEventSchema', () => {
    it('accepts a valid transition event', () => {
      const result = TransitionEventSchema.parse({
        fromState: 'idle',
        toState: 'processing',
        timestamp: Date.now(),
        success: true,
      });
      expect(result.success).toBe(true);
      expect(result.contextSnapshot).toEqual({});
    });

    it('accepts error events', () => {
      const result = TransitionEventSchema.parse({
        fromState: 'processing',
        toState: 'processing',
        timestamp: Date.now(),
        success: false,
        error: 'Handler failed',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler failed');
    });
  });

  describe('StateMachineConfigSchema', () => {
    it('accepts a valid config with defaults', () => {
      const result = StateMachineConfigSchema.parse({
        initialState: 'idle',
      });
      expect(result.initialState).toBe('idle');
      expect(result.maxIterations).toBe(100);
      expect(result.strictMode).toBe(true);
      expect(result.onErrorStrategy).toBe('stop');
    });

    it('accepts custom values', () => {
      const result = StateMachineConfigSchema.parse({
        initialState: 'start',
        maxIterations: 50,
        strictMode: false,
        onErrorStrategy: 'rollback',
      });
      expect(result.maxIterations).toBe(50);
      expect(result.strictMode).toBe(false);
      expect(result.onErrorStrategy).toBe('rollback');
    });

    it('rejects invalid onErrorStrategy', () => {
      expect(() =>
        StateMachineConfigSchema.parse({
          initialState: 'idle',
          onErrorStrategy: 'invalid',
        }),
      ).toThrow();
    });

    it('rejects maxIterations < 1', () => {
      expect(() =>
        StateMachineConfigSchema.parse({
          initialState: 'idle',
          maxIterations: 0,
        }),
      ).toThrow();
    });
  });

  describe('StateMachineStatusSchema', () => {
    it('accepts a valid status', () => {
      const result = StateMachineStatusSchema.parse({
        currentState: 'idle',
      });
      expect(result.currentState).toBe('idle');
      expect(result.isRunning).toBe(false);
      expect(result.isTerminated).toBe(false);
      expect(result.transitionCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('accepts a running status', () => {
      const result = StateMachineStatusSchema.parse({
        currentState: 'processing',
        isRunning: true,
        transitionCount: 3,
        startTime: Date.now(),
      });
      expect(result.isRunning).toBe(true);
      expect(result.transitionCount).toBe(3);
    });
  });

  describe('STATE_MACHINE_TYPES_VERSION', () => {
    it('exports a version string', () => {
      expect(STATE_MACHINE_TYPES_VERSION).toBe('0.1.0');
    });
  });
});
