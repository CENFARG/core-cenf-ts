/**
 * In-memory i18n adapter — translation for testing.
 *
 * Implements the I18nManager port with a Map-based resource store.
 * Supports key lookup, `{{param}}` interpolation, and runtime
 * locale switching.
 *
 * @module managers/i18n/adapters/memory.adapter
 */

import type { I18nManager } from '../ports.js';
import type { I18nOptions, TranslationParams } from '../types.js';
import type { HealthStatus } from '@cenf/core';

/**
 * Default configuration for MemoryI18nAdapter.
 */
const DEFAULT_OPTIONS: Required<I18nOptions> = {
  defaultLocale: 'en',
  fallbackLocale: 'en',
};

/**
 * In-memory i18n adapter using Map-based resource store.
 *
 * Features:
 * - Key-based translation with `{{param}}` interpolation
 * - Runtime locale switching via `setLocale()`
 * - Resource loading per locale (merge semantics)
 * - Fallback to raw key when translation is missing
 *
 * Use this adapter:
 * - In unit tests where i18next is not available
 * - For prototyping multi-language support
 * - As a reference implementation for the I18nManager port
 */
export class MemoryI18nAdapter implements I18nManager {
  /** Active locale. */
  private locale: string;

  /** Locale → flat key-value translation map. */
  private readonly resources = new Map<string, Record<string, string>>();

  /** Whether the adapter has been started. */
  private started = false;

  /** Merged configuration. */
  private readonly config: Required<I18nOptions>;

  constructor(options?: I18nOptions) {
    this.config = { ...DEFAULT_OPTIONS, ...options };
    this.locale = this.config.defaultLocale;
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.resources.clear();
    this.started = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        started: this.started,
        locale: this.locale,
        loadedLocales: Array.from(this.resources.keys()),
        resourceCount: this.resources.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // I18nManager — t() translation
  // -----------------------------------------------------------------------

  t(key: string, params?: TranslationParams): string {
    const localeResources = this.resources.get(this.locale);

    // If no resources loaded for the locale, return the key itself
    if (!localeResources || !(key in localeResources)) {
      return key;
    }

    const rawTemplate = localeResources[key];
    if (rawTemplate === undefined) {
      return key;
    }
    let template: string = rawTemplate;

    // Interpolate {{param}} placeholders
    if (params) {
      for (const [param, value] of Object.entries(params)) {
        template = template.replace(
          new RegExp(`\\{\\{${param}\\}\\}`, 'g'),
          String(value),
        );
      }
    }

    return template;
  }

  // -----------------------------------------------------------------------
  // I18nManager — locale management
  // -----------------------------------------------------------------------

  async setLocale(locale: string): Promise<void> {
    this.locale = locale;
  }

  getLocale(): string {
    return this.locale;
  }

  // -----------------------------------------------------------------------
  // I18nManager — loadResources
  // -----------------------------------------------------------------------

  async loadResources(
    locale: string,
    resources: Record<string, string>,
  ): Promise<void> {
    // Merge into existing resources for the locale
    const existing = this.resources.get(locale) ?? {};
    this.resources.set(locale, { ...existing, ...resources });
  }
}
