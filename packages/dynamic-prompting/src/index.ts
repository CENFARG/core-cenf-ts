/**
 * @cenf/dynamic-prompting — prompt assembly with blocks.
 *
 * @module @cenf/dynamic-prompting
 */

// Port
export {
  type DynamicPromptingManager,
  DYNAMIC_PROMPTING_PORT_VERSION,
} from './ports.js';

// Types
export type { PromptBlock, PromptContext } from './types.js';
export { DYNAMIC_PROMPTING_TYPES_VERSION } from './types.js';

// Adapters
export { InMemoryDynamicPromptingAdapter } from './adapters/memory.adapter.js';
