# Design: core-cenf-ts v0.1.0

## Technical Approach

TypeScript port of core-cenf-py v0.1.0 (21→19 managers) using Clean Architecture / Ports & Adapters. Every manager exposes a single TypeScript `interface` (port) and one or more `class` adapters. Manual constructor injection replaces Python Protocol runtime checks. `AsyncLocalStorage` replaces `contextvars`. BootstrapOrchestrator uses explicit priority registration (not Python `*args`) to satisfy rollback-on-failure requirements.

## Architecture Decisions

| Decision | Options | Trade-offs | Choice |
|----------|---------|------------|--------|
| Port syntax | `interface` vs `abstract class` | Interface is structural-only (no runtime overhead); abstract class allows default methods. | `interface` — matches spec and enables tree-shaking. |
| DI container | Manual vs tsyringe/awilix | Container adds reflect-metadata and magic; manual is explicit and zero-deps. | Manual constructor injection per `openspec/config.yaml`. |
| Bootstrap ordering | `*args` (Python style) vs `register(name, priority)` | `*args` is simple but lacks rollback semantics; `register` enables priority sort and partial rollback. | `register(name, manager, priority)` per bootstrap spec. |
| Error base | Extend `Error` vs custom prototype | Native `Error` preserves stack; custom class adds `code` field. | `abstract class CenfError extends Error { readonly code: string }` |
| Context propagation | `AsyncLocalStorage` vs explicit parameter bags | ALS is implicit (matches Python contextvars); explicit is clearer but invasive. | `AsyncLocalStorage<ContextStore>` — aligns with sibling. |
| Bundler | tsup vs rollup | tsup handles ESM/CJS/dts out-of-the-box with zero config. | `tsup` (already in `package.json`). |

## Data Flow

```
BootstrapOrchestrator
      │ register(name, priority)
      ▼
  [Priority Queue]
      │ start() ──► sequential start in priority order
      │             (if fail: rollback already-started in reverse)
      │ shutdown() ──► reverse order stop()
      │ health() ──► aggregate all managers
      ▼
  ConfigManager ──→ dotenv + Zod schema
  LogManager    ──→ pino (prod) / memory (test)
  SecretManager ──→ env | vault stub | memory
  ...
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/shared/errors.ts` | Create | `CenfError` base + 14 subclasses per taxonomy |
| `src/shared/types.ts` | Create | `JsonValue`, `JsonObject`, `Result<T,E>`, `HealthStatus` |
| `src/shared/context.ts` | Create | `AsyncLocalStorage<ContextStore>` wrapper |
| `src/shared/lifecycle.ts` | Create | `AsyncLifecycle` interface |
| `src/shared/utils.ts` | Create | Retry, exponential backoff, hash helpers |
| `src/managers/*/ports.ts` | Create (×19) | One port interface per manager |
| `src/managers/*/adapters/*.adapter.ts` | Create (×~25) | Env/memory adapters for every manager; real adapters for infra-heavy ones |
| `src/managers/*/errors.ts` | Create (×19) | Manager-specific error subclasses |
| `src/managers/*/types.ts` | Create (×19) | Manager-specific DTOs/interfaces |
| `src/infrastructure/**/*.ts` | Create | Redis, Drizzle, S3, NATS adapters |
| `src/index.ts` | Modify | Barrel exports for all public ports + shared types |
| `package.json` | Modify | Ensure `exports` map covers subpaths; `prepublishOnly` runs tests |
| `tsup.config.ts` | Create | ESM + CJS + dts bundles |
| `__tests__/**/*.test.ts` | Create | Co-located tests; memory adapters for unit, Docker-backed for integration |

## Interfaces / Contracts

```typescript
// shared/lifecycle.ts
export interface AsyncLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<HealthStatus>;
}

// shared/errors.ts
export abstract class CenfError extends Error {
  abstract readonly code: string;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

// managers/config/ports.ts
export interface ConfigManager extends AsyncLifecycle {
  get<T>(key: string, schema: Zod.ZodSchema<T>): T;
  all(): Record<string, unknown>;
  reload(): Promise<void>;
}

// managers/bootstrap/ports.ts
export interface BootstrapOrchestrator extends AsyncLifecycle {
  register(name: string, manager: AsyncLifecycle, priority: number): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<HealthReport>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Port contracts, memory adapters, error classification | vitest, co-located `__tests__` |
| Integration | Real adapters with Docker services (Redis, Postgres, NATS, LocalStack) | `vitest` + `testcontainers` or docker-compose in CI |
| E2E | Bootstrap full startup/shutdown/health | Mock lifecycle managers + real orchestrator |

## PR Decomposition (Chained)

| PR | Scope | Lines (est) |
|----|-------|-------------|
| **#1 Foundation** | `shared/*` + `config/` + `logging/` + `index.ts` | ~200 |
| **#2 Security** | `secret/` + `error-handling/` + `validation/` | ~200 |
| **#3 Mid-tier A** | `observability/` + `auth/` + `cache/` | ~250 |
| **#4 Mid-tier B** | `feature-flag/` + `rate-limiter/` + `database/` + `storage/` | ~300 |
| **#5 Integration** | `http-client/` + `circuit-breaker/` + `event-bus/` + `i18n/` | ~300 |
| **#6 Cross-cutting** | `json-serializer/` + `health/` + `bootstrap/` + build fixes | ~200 |

## Migration / Rollout

No migration required. This is a new library (`v0.1.0`). Consumers will install via npm and wire managers manually.

## Open Questions

- [ ] Should `ConfigManager.get` accept a Zod schema every call, or should schema be provided at `load()` time? (Spec draft shows both; need final call.)
- [ ] Should `EventBusManager` use CloudEvents wrapper or raw NATS messages for v0.1.0? (Defer CloudEvents to v0.2.0 if complexity rises.)
- [ ] Should `DatabaseManager` expose generic repository helper or keep it raw `query` + `transaction`? (Spec shows raw; keep raw to avoid ORM lock-in.)
