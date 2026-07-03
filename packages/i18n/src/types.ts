/**
 * I18nManager-specific types.
 *
 * Types for translation parameters and i18n configuration.
 *
 * @module managers/i18n/types
 */

// ---------------------------------------------------------------------------
// TranslationParams — key-value map for interpolation
// ---------------------------------------------------------------------------

/**
 * Parameter map for `{{placeholder}}` interpolation in translations.
 *
 * Values are converted to strings via `String()` during interpolation.
 * Supports both string and number values.
 */
export type TranslationParams = Record<string, string | number>;

// ---------------------------------------------------------------------------
// I18nOptions — configuration for the i18n manager
// ---------------------------------------------------------------------------

/**
 * Configuration options for the I18nManager.
 */
export interface I18nOptions {
  /** Default locale to use when none is set. Default: 'en'. */
  defaultLocale?: string;

  /** Fallback locale when a key is missing in the active locale. */
  fallbackLocale?: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const I18N_TYPES_VERSION = '0.1.0';
