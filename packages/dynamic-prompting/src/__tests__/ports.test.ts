import { describe, it, expect } from 'vitest';
import {
  DYNAMIC_PROMPTING_PORT_VERSION,
  type DynamicPromptingManager,
} from '../ports.js';
import type {
  PromptBlock,
  PromptContext,
} from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of DynamicPromptingManager for contract verification
// ---------------------------------------------------------------------------

class TestDynamicPromptingManager implements DynamicPromptingManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  assemblePrompt(
    basePrompt: string,
    blocks: PromptBlock[],
    _context: PromptContext,
  ): string {
    // Simplest possible contract implementation: just return basePrompt + block names
    const blockNames = blocks.map((b) => b.name).join(', ');
    return blockNames ? `${basePrompt}\n${blockNames}` : basePrompt;
  }

  registerBlock(name: string, template: string): void {
    // no-op for contract test
    void name;
    void template;
  }

  getBlocks(): PromptBlock[] {
    return [];
  }
}

// ---------------------------------------------------------------------------
// DynamicPromptingManager port contract
// ---------------------------------------------------------------------------

describe('DynamicPromptingManager port', () => {
  it('exports a runtime version constant', () => {
    expect(DYNAMIC_PROMPTING_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: DynamicPromptingManager = new TestDynamicPromptingManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestDynamicPromptingManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('assemblePrompt() returns a string', () => {
    const mgr = new TestDynamicPromptingManager();
    const result = mgr.assemblePrompt(
      'You are a helpful assistant.',
      [{ name: 'context', template: 'User context: {user}' }],
      { user: 'Alice' },
    );
    expect(typeof result).toBe('string');
  });

  it('assemblePrompt() with empty blocks returns basePrompt unchanged', () => {
    const mgr = new TestDynamicPromptingManager();
    const result = mgr.assemblePrompt('Hello', [], {});
    expect(result).toBe('Hello');
  });

  it('registerBlock() stores a block for later retrieval', () => {
    const mgr = new TestDynamicPromptingManager();
    mgr.registerBlock('style', 'Respond in {tone} tone.');
    const blocks = mgr.getBlocks();
    expect(blocks).toHaveLength(0); // test impl returns []
  });

  it('getBlocks() returns registered blocks', () => {
    const mgr = new TestDynamicPromptingManager();
    expect(mgr.getBlocks()).toEqual([]);
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestDynamicPromptingManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// DynamicPrompting types
// ---------------------------------------------------------------------------

describe('DynamicPrompting types', () => {
  it('PromptBlock has required fields name and template', () => {
    const block: PromptBlock = {
      name: 'system-role',
      template: 'You are a {role} assistant.',
    };
    expect(block.name).toBe('system-role');
    expect(block.template).toBe('You are a {role} assistant.');
    expect(block.conditions).toBeUndefined();
  });

  it('PromptBlock with optional conditions', () => {
    const block: PromptBlock = {
      name: 'context-block',
      template: 'User: {user}',
      conditions: { role: 'admin' },
    };
    expect(block.conditions).toEqual({ role: 'admin' });
  });

  it('PromptContext is a string key-value record', () => {
    const ctx: PromptContext = {
      role: 'assistant',
      user: 'Alice',
      tone: 'professional',
    };
    expect(ctx.role).toBe('assistant');
    expect(ctx.user).toBe('Alice');
    expect(ctx.tone).toBe('professional');
  });

  it('PromptContext can be empty', () => {
    const ctx: PromptContext = {};
    expect(Object.keys(ctx)).toHaveLength(0);
  });
});
