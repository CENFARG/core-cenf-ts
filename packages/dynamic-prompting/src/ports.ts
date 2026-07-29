/**
 * DynamicPromptingManager port interface — prompt assembly with blocks.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/dynamic-prompting/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { PromptBlock, PromptContext } from './types.js';

/**
 * Dynamic prompting manager port for assembling prompts from blocks.
 *
 * Assembles a final prompt string from a base prompt, a set of
 * prompt blocks, and a context. Blocks can be conditionally included
 * based on context values, and variables within block templates are
 * interpolated from the context.
 *
 * Also provides a block registry for persistent storage of blocks
 * that can be reused across assembly calls.
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface DynamicPromptingManager extends AsyncLifecycle {
  /**
   * Assemble a prompt from a base and blocks.
   *
   * Starts with `basePrompt`, evaluates each block's conditions against
   * `context`, and appends the rendered template of included blocks.
   * Variables in block templates are replaced with values from `context`.
   *
   * If `blocks` is provided, it is used directly. If `blocks` is undefined,
   * the registered blocks from `registerBlock` are used instead.
   *
   * @param basePrompt - The initial prompt text.
   * @param blocks - Optional explicit blocks to use. Falls back to registered blocks.
   * @param context - Key-value pairs for interpolation and condition evaluation.
   * @returns The fully assembled prompt string.
   */
  assemblePrompt(
    basePrompt: string,
    blocks: PromptBlock[] | undefined,
    context: PromptContext,
  ): string;

  /**
   * Register a block template for later use.
   *
   * If a block with the same name already exists, it is overwritten.
   * Registered blocks are used by `assemblePrompt()` when no explicit
   * `blocks` parameter is provided.
   *
   * @param name - The name of the block (key for registry).
   * @param template - The template string with `{variable}` placeholders.
   */
  registerBlock(name: string, template: string): void;

  /**
   * Get all currently registered blocks.
   *
   * @returns An array of all registered `PromptBlock` objects.
   */
  getBlocks(): PromptBlock[];
}

/** Runtime version constant — ensures module existence for TDD. */
export const DYNAMIC_PROMPTING_PORT_VERSION = '0.1.0';
