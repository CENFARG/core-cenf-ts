/**
 * I18nManager port interface — internationalization.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/i18n/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { TranslationParams } from './types.js';

/**
 * Internationalization manager port for multi-language support.
 *
 * Provides key-based translation with parameter interpolation
 * and runtime locale switching. Resources are loaded per-locale
 * as flat key-value pairs.
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface I18nManager extends AsyncLifecycle {
  /**
   * Translate a key using the current locale.
   *
   * If the key is not found in the current locale's resources,
   * the key itself is returned as a fallback.
   *
   * Supports `{{param}}` interpolation when `params` is provided.
   *
   * @param key - The translation key.
   * @param params - Optional key-value pairs for interpolation.
   * @returns The translated string with interpolated values.
   */
  t(key: string, params?: TranslationParams): string;

  /**
   * Set the active locale.
   *
   * Subsequent calls to `t()` will use this locale's resources.
   *
   * @param locale - The locale code (e.g., 'en', 'es', 'fr').
   */
  setLocale(locale: string): Promise<void>;

  /**
   * Get the currently active locale.
   *
   * @returns The current locale code.
   */
  getLocale(): string;

  /**
   * Load translation resources for a locale.
   *
   * Resources are merged into existing entries for the same locale.
   * Keys that already exist are overwritten.
   *
   * @param locale - The locale code.
   * @param resources - Flat key-value map of translation strings.
   */
  loadResources(locale: string, resources: Record<string, string>): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const I18N_PORT_VERSION = '0.1.0';
