import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryDynamicPromptingAdapter } from '../adapters/memory.adapter.js';
import type { DynamicPromptingManager } from '../ports.js';
import type { PromptBlock, PromptContext } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(): InMemoryDynamicPromptingAdapter {
  return new InMemoryDynamicPromptingAdapter();
}

// ---------------------------------------------------------------------------
// InMemoryDynamicPromptingAdapter
// ---------------------------------------------------------------------------

describe('InMemoryDynamicPromptingAdapter', () => {
  let adapter: DynamicPromptingManager;

  // -------------------------------------------------------------------------
  // registerBlock / getBlocks
  // -------------------------------------------------------------------------

  describe('registerBlock and getBlocks', () => {
    beforeEach(async () => {
      adapter = makeAdapter();
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('getBlocks() returns empty array after start', () => {
      expect(adapter.getBlocks()).toEqual([]);
    });

    it('registerBlock() stores a block without conditions', () => {
      adapter.registerBlock('system-role', 'You are a {role} assistant.');
      const blocks = adapter.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.name).toBe('system-role');
      expect(blocks[0]!.template).toBe('You are a {role} assistant.');
      expect(blocks[0]!.conditions).toBeUndefined();
    });

    it('registerBlock() stores multiple blocks', () => {
      adapter.registerBlock('block-a', 'Template A');
      adapter.registerBlock('block-b', 'Template B');
      expect(adapter.getBlocks()).toHaveLength(2);
    });

    it('registerBlock() overwrites a block with the same name', () => {
      adapter.registerBlock('greeting', 'Hello {user}!');
      adapter.registerBlock('greeting', 'Hi {user}!');
      const blocks = adapter.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.template).toBe('Hi {user}!');
    });
  });

  // -------------------------------------------------------------------------
  // assemblePrompt — basic variable interpolation
  // -------------------------------------------------------------------------

  describe('assemblePrompt — variable interpolation', () => {
    beforeEach(async () => {
      adapter = makeAdapter();
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('substitutes a single {variable} with context value', () => {
      const blocks: PromptBlock[] = [
        { name: 'greeting', template: 'Hello, {user}!' },
      ];
      const result = adapter.assemblePrompt('System: You are an AI.', blocks, {
        user: 'Alice',
      });
      expect(result).toBe('System: You are an AI.\nHello, Alice!');
    });

    it('substitutes multiple {variables} in one template', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'intro',
          template: 'User is {user}, role is {role}.',
        },
      ];
      const result = adapter.assemblePrompt('Start', blocks, {
        user: 'Bob',
        role: 'admin',
      });
      expect(result).toBe('Start\nUser is Bob, role is admin.');
    });

    it('leaves {variables} intact when missing from context', () => {
      const blocks: PromptBlock[] = [
        { name: 'msg', template: 'Hello {user}, your {item} is ready.' },
      ];
      const result = adapter.assemblePrompt('Base', blocks, {
        user: 'Alice',
      });
      // {item} is not in context — left as-is
      expect(result).toBe('Base\nHello Alice, your {item} is ready.');
    });

    it('interpolates same variable used multiple times', () => {
      const blocks: PromptBlock[] = [
        { name: 'repeat', template: '{name} is {name}.' },
      ];
      const result = adapter.assemblePrompt('', blocks, { name: 'X' });
      expect(result).toBe('X is X.');
    });

    it('renders multiple blocks in order', () => {
      const blocks: PromptBlock[] = [
        { name: 'a', template: 'First: {x}' },
        { name: 'b', template: 'Second: {y}' },
        { name: 'c', template: 'Third: {z}' },
      ];
      const result = adapter.assemblePrompt('Header', blocks, {
        x: '1',
        y: '2',
        z: '3',
      });
      expect(result).toBe('Header\nFirst: 1\nSecond: 2\nThird: 3');
    });

    it('returns basePrompt unchanged when blocks array is empty', () => {
      const result = adapter.assemblePrompt('Just this.', [], {});
      expect(result).toBe('Just this.');
    });
  });

  // -------------------------------------------------------------------------
  // assemblePrompt — conditional assembly (dict equality)
  // -------------------------------------------------------------------------

  describe('assemblePrompt — conditional assembly', () => {
    beforeEach(async () => {
      adapter = makeAdapter();
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('includes a block when single condition matches', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'admin-block',
          template: 'Admin override: full access.',
          conditions: { role: 'admin' },
        },
      ];
      const result = adapter.assemblePrompt('Base', blocks, {
        role: 'admin',
      });
      expect(result).toContain('Admin override: full access.');
    });

    it('excludes a block when single condition does not match', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'admin-block',
          template: 'Admin override: full access.',
          conditions: { role: 'admin' },
        },
      ];
      const result = adapter.assemblePrompt('Base', blocks, {
        role: 'user',
      });
      expect(result).not.toContain('Admin override: full access.');
      expect(result).toBe('Base');
    });

    it('includes a block when ALL conditions match (AND logic)', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'restricted',
          template: 'Restricted area for {role}.',
          conditions: { role: 'admin', department: 'security' },
        },
      ];
      const result = adapter.assemblePrompt('Start', blocks, {
        role: 'admin',
        department: 'security',
      });
      expect(result).toContain('Restricted area for admin.');
    });

    it('excludes a block when ANY condition does not match (AND logic)', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'restricted',
          template: 'Restricted area for {role}.',
          conditions: { role: 'admin', department: 'security' },
        },
      ];
      // department does not match
      const result = adapter.assemblePrompt('Start', blocks, {
        role: 'admin',
        department: 'engineering',
      });
      expect(result).not.toContain('Restricted area');
      expect(result).toBe('Start');
    });

    it('includes a block with no conditions always', () => {
      const blocks: PromptBlock[] = [
        { name: 'always', template: 'Always included.' },
        {
          name: 'conditional',
          template: 'Only when {x}.',
          conditions: { x: 'yes' },
        },
      ];
      const result = adapter.assemblePrompt('Base', blocks, { x: 'no' });
      expect(result).toContain('Always included.');
      expect(result).not.toContain('Only when');
    });

    it('handles mixed conditions — some blocks included, some excluded', () => {
      const blocks: PromptBlock[] = [
        { name: 'greeting', template: 'Hello {user}.' },
        {
          name: 'admin-note',
          template: 'You have admin privileges.',
          conditions: { role: 'admin' },
        },
        {
          name: 'guest-note',
          template: 'Limited access mode.',
          conditions: { role: 'guest' },
        },
      ];
      const result = adapter.assemblePrompt('System', blocks, {
        user: 'Alice',
        role: 'admin',
      });
      expect(result).toContain('Hello Alice.');
      expect(result).toContain('You have admin privileges.');
      expect(result).not.toContain('Limited access mode.');
    });

    it('condition with empty string value must match exactly', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'empty-cond',
          template: 'Empty role block.',
          conditions: { role: '' },
        },
      ];
      const matches = adapter.assemblePrompt('X', blocks, { role: '' });
      const noMatch = adapter.assemblePrompt('X', blocks, { role: 'admin' });
      expect(matches).toContain('Empty role block.');
      expect(noMatch).not.toContain('Empty role block.');
    });

    it('condition key missing from context excludes the block', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'needs-tenant',
          template: 'Tenant: {tenant}',
          conditions: { tenant: 'acme' },
        },
      ];
      const result = adapter.assemblePrompt('Start', blocks, {});
      expect(result).not.toContain('Tenant:');
      expect(result).toBe('Start');
    });
  });

  // -------------------------------------------------------------------------
  // assemblePrompt — combined: conditions + interpolation
  // -------------------------------------------------------------------------

  describe('assemblePrompt — combined conditions and interpolation', () => {
    beforeEach(async () => {
      adapter = makeAdapter();
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('interpolates variables only for included conditional blocks', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'welcome',
          template: 'Welcome, {user}!',
          conditions: { active: 'true' },
        },
      ];
      const result = adapter.assemblePrompt('Start', blocks, {
        user: 'Alice',
        active: 'true',
      });
      expect(result).toBe('Start\nWelcome, Alice!');
    });

    it('does not interpolate variables for excluded conditional blocks', () => {
      const blocks: PromptBlock[] = [
        {
          name: 'welcome',
          template: 'Welcome, {user}!',
          conditions: { active: 'true' },
        },
      ];
      const result = adapter.assemblePrompt('Start', blocks, {
        user: 'Alice',
        active: 'false',
      });
      expect(result).toBe('Start');
    });
  });

  // -------------------------------------------------------------------------
  // assemblePrompt — using registered blocks
  // -------------------------------------------------------------------------

  describe('assemblePrompt — using registered blocks', () => {
    beforeEach(async () => {
      adapter = makeAdapter();
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('uses registered blocks when no blocks param passed', () => {
      adapter.registerBlock('greeting', 'Hello, {user}!');
      const result = adapter.assemblePrompt('Base', undefined, {
        user: 'Alice',
      });
      expect(result).toBe('Base\nHello, Alice!');
    });

    it('uses explicit blocks param over registered blocks', () => {
      adapter.registerBlock('registered', 'Registered: {x}');
      const explicit: PromptBlock[] = [
        { name: 'explicit', template: 'Explicit: {y}' },
      ];
      const result = adapter.assemblePrompt('Start', explicit, {
        y: 'hello',
      });
      expect(result).toContain('Explicit: hello');
      expect(result).not.toContain('Registered:');
    });

    it('uses registered blocks when blocks is undefined', () => {
      adapter.registerBlock('a', 'Block A: {val}');
      adapter.registerBlock('b', 'Block B: {val}');
      const result = adapter.assemblePrompt('Header', undefined, { val: 'X' });
      expect(result).toBe('Header\nBlock A: X\nBlock B: X');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    beforeEach(async () => {
      adapter = makeAdapter();
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('handles template with no variables', () => {
      const blocks: PromptBlock[] = [
        { name: 'static', template: 'Static block content.' },
      ];
      const result = adapter.assemblePrompt('Base', blocks, {});
      expect(result).toBe('Base\nStatic block content.');
    });

    it('handles empty basePrompt', () => {
      const blocks: PromptBlock[] = [
        { name: 'only', template: 'Only content.' },
      ];
      const result = adapter.assemblePrompt('', blocks, {});
      expect(result).toBe('Only content.');
    });

    it('handles empty template string', () => {
      const blocks: PromptBlock[] = [{ name: 'empty', template: '' }];
      const result = adapter.assemblePrompt('Base', blocks, {});
      expect(result).toBe('Base');
    });

    it('handles many blocks efficiently', () => {
      const blocks: PromptBlock[] = Array.from({ length: 100 }, (_, i) => ({
        name: `block-${i}`,
        template: `Block ${i}: {value}`,
      }));
      const result = adapter.assemblePrompt('Start', blocks, { value: 'X' });
      expect(result).toContain('Block 0: X');
      expect(result).toContain('Block 99: X');
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() prepares empty state', async () => {
      const fresh = makeAdapter();
      await fresh.start();
      expect(fresh.getBlocks()).toEqual([]);
      await fresh.stop();
    });

    it('stop() clears all blocks', async () => {
      const fresh = makeAdapter();
      await fresh.start();
      fresh.registerBlock('a', 'Template A');
      expect(fresh.getBlocks()).toHaveLength(1);
      await fresh.stop();
      // After stop, state should be reset
      expect(fresh.getBlocks()).toEqual([]);
    });

    it('health() reports status and block count', async () => {
      const fresh = makeAdapter();
      await fresh.start();
      fresh.registerBlock('x', 'X');
      fresh.registerBlock('y', 'Y');
      const h = await fresh.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('registeredBlocks', 2);
      await fresh.stop();
    });
  });
});
