/**
 * @cenf/i18n — internationalization.
 *
 * @module @cenf/i18n
 */

// Port
export { type I18nManager, I18N_PORT_VERSION } from './ports.js';

// Types
export type { TranslationParams, I18nOptions } from './types.js';
export { I18N_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryI18nAdapter } from './adapters/memory.adapter.js';
