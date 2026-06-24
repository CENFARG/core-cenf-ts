# I18nManager Specification

## Purpose

Provides internationalization with YAML resource files, locale detection, and string interpolation. Enables multi-language support for error messages, notifications, and UI strings.

## Port Interface

```typescript
interface II18nManager {
  t(key: string, options?: TranslateOptions): string;
  setLanguage(lang: string): void;
  getLanguage(): string;
  addResourceBundle(lang: string, ns: string, resources: Record<string, unknown>): void;
}

interface TranslateOptions {
  params?: Record<string, string>;
  defaultValue?: string;
  ns?: string;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `I18nextAdapter` | Wraps i18next with YAML resource loading |
| `MemoryI18nAdapter` | In-memory translation map for testing |

## Error Types

- `I18nConfigurationError` — Missing resource bundle, invalid locale

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_I18N_DEFAULT_LANG` | `string` | `en` | Default language |
| `CENF_I18N_FALLBACK_LANG` | `string` | `en` | Fallback when key missing |
| `CENF_I18N_RESOURCES_PATH` | `string` | `./locales` | YAML resource directory |

## Lifecycle

- `start()`: Loads YAML resource files from configured path
- `stop()`: No-op
- `health()`: Returns `{ status: 'healthy', details: { languages, defaultLang } }`

## Testing Strategy

- **Unit**: `MemoryI18nAdapter` — key lookup, interpolation, fallback
- **Integration**: `I18nextAdapter` with temp YAML locale files
- **Edge cases**: Missing keys, nested interpolation, language switching

## Requirements

### Requirement: Translation with Interpolation

The system MUST translate keys to strings with parameter interpolation. Missing keys MUST fall back to the configured fallback language.

#### Scenario: Simple key translation

- GIVEN resource bundle `en.common` has `{ greeting: "Hello" }`
- WHEN `i18n.t("common.greeting")` is called with language `en`
- THEN it returns `"Hello"`

#### Scenario: Parameter interpolation

- GIVEN resource bundle `en.emails` has `{ welcome: "Welcome, {{name}}!" }`
- WHEN `i18n.t("emails.welcome", { params: { name: "John" } })` is called
- THEN it returns `"Welcome, John!"`

#### Scenario: Fallback to default language

- GIVEN key `common.greeting` exists in `en` but NOT in `es`
- WHEN language is `es` and `i18n.t("common.greeting")` is called
- THEN it returns the English value
- AND no error is thrown

#### Scenario: Missing key returns key or defaultValue

- GIVEN key `nonexistent.key` does not exist in any language
- WHEN `i18n.t("nonexistent.key", { defaultValue: "Fallback text" })` is called
- THEN it returns `"Fallback text"`
- AND without defaultValue, returns the key string `"nonexistent.key"`

#### Scenario: Runtime language switching

- GIVEN resource bundles loaded for `en` and `es`
- WHEN `i18n.setLanguage("es")` is called
- THEN `i18n.getLanguage()` returns `"es"`
- AND subsequent `t()` calls use Spanish translations
