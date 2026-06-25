# Delta for ConfigManager

## MODIFIED Requirements

### Requirement: Schema-Validated Config Loading

The system MUST load configuration from environment variables and validate against a provided Zod schema. All values MUST be typed — no `any` returns from `load()`. Environment loading MUST use Node.js native `process.loadEnvFile()` (Node >=20.6.0) instead of the `dotenv` package.

(Previously: Used `import dotenv from 'dotenv'` for .env file loading)

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

#### Scenario: Native dotenv file loading before env read

- GIVEN a `.env` file exists with `DATABASE_URL=postgres://localhost:5432/db`
- WHEN `config.load(schema)` is called
- THEN `process.loadEnvFile()` is invoked internally
- AND the value is available via `config.get("DATABASE_URL")`
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

### Requirement: Dotenv Dependency Elimination

The system MUST NOT depend on the `dotenv` npm package in production dependencies. The `dotenv` package MUST be removed from `package.json`. Environment file loading MUST use `process.loadEnvFile()` exclusively. The `engines` field in `package.json` MUST specify `node >= "20.6.0"`.

(Previously: `dotenv` was a production dependency with BSD-2-Clause license)

#### Scenario: Zero dotenv imports in source code

- GIVEN the project source tree is scanned
- WHEN searching for `import.*dotenv` or `require.*dotenv`
- THEN zero matches are found in `src/` files
- AND `dotenv` is absent from `package.json` `dependencies`

#### Scenario: process.loadEnvFile() replaces dotenv behavior

- GIVEN a `.env` file exists in the project root
- WHEN `EnvConfigAdapter.start()` is called
- THEN `process.loadEnvFile()` is invoked
- AND all `.env` variables are available in `process.env`
- AND no `dotenv.config()` call is made

#### Scenario: Node version requirement enforced

- GIVEN `package.json` engines specifies `node >= "20.6.0"`
- WHEN `npm install` is run on Node 20.5.0
- THEN npm warns or fails due to engine mismatch
- AND the installation does not proceed silently
