# ConfigManager Specification

## Purpose

Provides typed, validated configuration loading from environment variables and file sources. Eliminates `process.env` scattering and ensures all config is schema-validated at startup.

## Port Interface

```typescript
interface IConfigManager {
  load<T>(schema: Zod.ZodSchema<T>): Promise<T>;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  reload(): Promise<void>;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `EnvConfigAdapter` | Reads `process.env`, applies dotenv loading, validates with Zod |
| `FileConfigAdapter` | Reads YAML/JSON config files, merges with env overrides |

## Error Types

- `ConfigValidationError` — Zod schema validation failed (extends `CenfError`)
- `ConfigNotFoundError` — Required key missing, no default provided

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_ENV` | `local\|dev\|staging\|prod` | `local` | Deployment environment |
| `CENF_CONFIG_PATH` | `string` | `./config` | Config file directory |
| `CENF_CONFIG_FORMAT` | `env\|yaml\|json` | `env` | Config source format |

## Lifecycle

- `start()`: Loads dotenv, validates schema, populates internal store
- `stop()`: No-op (config is read-only after load)
- `health()`: Returns `{ status: 'healthy', details: { env, keysLoaded } }`

## Testing Strategy

- **Unit**: `EnvConfigAdapter` with mocked `process.env`, verify Zod validation
- **Integration**: `FileConfigAdapter` with temp YAML files, verify merge order
- **Edge cases**: Missing required vars, invalid types, dotenv reload races

## Requirements

### Requirement: Schema-Validated Config Loading

The system MUST load configuration from environment variables and validate against a provided Zod schema. All values MUST be typed — no `any` returns from `load()`.

#### Scenario: Successful config load with valid env vars

- GIVEN environment variables match a Zod schema `{ NODE_ENV: z.string(), PORT: z.number() }`
- WHEN `config.load(schema)` is called
- THEN it returns a typed object `{ NODE_ENV: "dev", PORT: 3000 }`
- AND no errors are thrown

#### Scenario: Validation failure on missing required field

- GIVEN a Zod schema requires `DATABASE_URL: z.string()` but env var is absent
- WHEN `config.load(schema)` is called
- THEN it throws `ConfigValidationError` with the missing field name
- AND the error message includes which keys failed validation

#### Scenario: Dotenv file loading before env read

- GIVEN a `.env` file exists with `DATABASE_URL=postgres://localhost:5432/db`
- WHEN `config.load(schema)` is called
- THEN the value is available via `config.get("DATABASE_URL")`
- AND `process.env.DATABASE_URL` is populated

#### Scenario: Runtime override via set()

- GIVEN config has been loaded with `NODE_ENV=dev`
- WHEN `config.set("NODE_ENV", "staging")` is called
- THEN `config.get("NODE_ENV")` returns `"staging"`
- AND the original env var in `process.env` is NOT modified

#### Scenario: Reload with file source

- GIVEN config source is YAML file at `config/app.yaml`
- WHEN `config.reload()` is called after file modification
- THEN the new values are reflected in subsequent `get()` calls
- AND a reload event is logged at INFO level
