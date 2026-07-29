/**
 * In-memory dynamic prompting adapter — block registry and prompt assembly.
 *
 * Implements the DynamicPromptingManager port with zero external dependencies.
 * Stores blocks in memory, evaluates conditions via dict equality,
 * and interpolates `{variable}` placeholders from context.
 *
 * @module managers/dynamic-prompting/adapters/memory.adapter
 */

import type { DynamicPromptingManager } from '../ports.js';
import type { PromptBlock, PromptContext } from '../types.js';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// InMemoryDynamicPromptingAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory dynamic prompting adapter.
 *
 * Maintains a registry of named prompt blocks and assembles final
 * prompt strings by:
 * 1. Evaluating block conditions against the provided context
 * 2. Interpolating `{variable}` placeholders with context values
 * 3. Appending rendered blocks to the base prompt, separated by newlines
 *
 * Use this adapter:
 * - In unit tests where a persistent block store is not needed
 * - For single-process prompting with no shared state
 * - As a fallback when a database-backed adapter is unavailable
 */
export class InMemoryDynamicPromptingAdapter
  implements DynamicPromptingManager
{
  private blocks = new Map<string, PromptBlock>();

  // -----------------------------------------------------------------------
  // DynamicPromptingManager — registerBlock / getBlocks
  // -----------------------------------------------------------------------

  /**
   * Register a block template for later use.
   *
   * Overwrites any existing block with the same name.
   *
   * @param name - The name of the block.
   * @param template - The template string with `{variable}` placeholders.
   */
  registerBlock(name: string, template: string): void {
    this.blocks.set(name, { name, template });
  }

  /**
   * Get all currently registered blocks.
   *
   * Returns a snapshot of the current registry as an array.
   *
   * @returns An array of all registered `PromptBlock` objects.
   */
  getBlocks(): PromptBlock[] {
    return Array.from(this.blocks.values());
  }

  // -----------------------------------------------------------------------
  // DynamicPromptingManager — assemblePrompt
  // -----------------------------------------------------------------------

  /**
   * Assemble a prompt from a base and blocks.
   *
   * If `blocks` is provided, uses those blocks directly.
   * If `blocks` is undefined, uses the registered blocks.
   *
   * @param basePrompt - The initial prompt text.
   * @param blocks - Optional explicit blocks. Falls back to registered blocks.
   * @param context - Key-value pairs for interpolation and condition evaluation.
   * @returns The fully assembled prompt string.
   */
  assemblePrompt(
    basePrompt: string,
    blocks: PromptBlock[] | undefined,
    context: PromptContext,
  ): string {
    const targetBlocks = blocks ?? Array.from(this.blocks.values());

    const renderedParts: string[] = [];

    for (const block of targetBlocks) {
      if (!this.evaluateConditions(block, context)) {
        continue;
      }

      const rendered = this.interpolate(block.template, context);
      if (rendered === '') {
        continue;
      }

      renderedParts.push(rendered);
    }

    if (renderedParts.length === 0) {
      return basePrompt;
    }

    const separator = basePrompt === '' ? '' : '\n';
    return `${basePrompt}${separator}${renderedParts.join('\n')}`;
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.blocks = new Map<string, PromptBlock>();
  }

  async stop(): Promise<void> {
    this.blocks.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        registeredBlocks: this.blocks.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Evaluate whether a block should be included based on its conditions.
   *
   * Conditions use AND logic — ALL key-value pairs must match the context.
   * If `conditions` is undefined or empty, the block is always included.
   *
   * @param block - The prompt block to evaluate.
   * @param context - The current context for evaluation.
   * @returns `true` if the block should be included.
   */
  private evaluateConditions(
    block: PromptBlock,
    context: PromptContext,
  ): boolean {
    const conditions = block.conditions;
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = context[key];
      // Missing key or mismatched value → block excluded
      if (actualValue === undefined || actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Interpolate `{variable}` placeholders in a template with context values.
   *
   * Replaces every occurrence of `{key}` with `context[key]`.
   * If a variable is not present in the context, the placeholder is left
   * as-is in the output.
   *
   * @param template - The template string containing `{variable}` placeholders.
   * @param context - The context providing values for interpolation.
   * @returns The interpolated string.
   */
  private interpolate(
    template: string,
    context: PromptContext,
  ): string {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = context[key];
      return value !== undefined ? value : _match;
    });
  }
}
