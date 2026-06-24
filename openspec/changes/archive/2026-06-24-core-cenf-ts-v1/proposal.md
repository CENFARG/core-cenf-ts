# Proposal: core-cenf-ts v0.1.0

## Intent

TypeScript port of core-cenf-py v0.1.0 (21 → 19 managers). Eliminates infra boilerplate in Node.js services.

## Scope

### In Scope (19)
| Group | Managers |
|-------|----------|
| Foundation (6) | Config, Logging, Secret, ErrorHandling, Validation, Observability |
| Data & Security (4) | Auth, Cache, FeatureFlag, RateLimiter |
| Integration (5) | Database, Storage, HttpClient, CircuitBreaker, EventBus |
| Cross-cutting (4) | I18n, JsonSerializer, Health, Bootstrap |

### Out of Scope (v0.2.0)
TaskQueue, DynamicPrompting, Alert, Licence, Update, Permission

## Capabilities

### New
- `secret-manager`: Credentials (env, vault stub, memory)
- `error-handling`: CenfError taxonomy + @handle_errors
- `feature-flag-manager`: YAML flags, memory adapter
- `rate-limiter-manager`: Token bucket, zero deps

### Modified
- `config-manager`: dotenv integration
- `event-bus-manager`: nats → @nats-io/nats-core v3
- `database-manager`: drizzle-orm → ^0.45.2
- `http-client-manager`: undici for retry

## Approach

Ports & Adapters via `interface` + `implements`. Manual DI. `AsyncLocalStorage` replaces Python `contextvars`. `CenfError` hierarchy. Bootstrap: `Promise.all()` + AbortController. Vitest + memory adapters. TDD strict.

**Order**: Config → Logger → Secret → Error → Observability → Validation → Auth → Cache → FeatureFlags → RateLimiter → Database → Storage → HttpClient → CircuitBreaker → EventBus → I18n → JsonSerializer → Health → Bootstrap

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Fix nats, drizzle CVE, add deps |
| `src/managers/{secret,error-handling,feature-flag,rate-limiter}/` | New | 4 managers |
| `src/shared/` | New | Errors, types, context, lifecycle |
| `AGENTS.md`, `AGENTS_API.md` | Modified | 15→19 catalog |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| @nats-io/nats-core v3 API diff | Medium | Read docs; memory adapter first |
| drizzle ^0.45.2 breaking | Medium | Test new API; Prisma fallback |
| Scope creep | High | Strict v0.2.0 deferrals |

## Rollback

`git revert` feature branch. Pure library — zero migration risk. Partial: exclude exports from `index.ts`.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| dotenv | ^16.4.7 | Config env loading |
| undici | ^7.0.0 | HttpClient retry |
| @nats-io/nats-core | ^3.0.0 | EventBus |
| drizzle-orm | ^0.45.2 | DB (CVE fix) |

## Success Criteria

- [ ] 19 managers pass tests ≥80% coverage
- [ ] Memory adapters for every manager
- [ ] BootstrapOrchestrator starts/stops in order
- [ ] `npm test` clean, `npm run build` valid ESM + types

## REGLAS INVIOLABLES

1. NUNCA fuera de `core-cenf-ts`
2. TDD estricto
3. Work-unit commits
4. Gitflow: main ← develop ← feature/*
5. mem_save por decisión/tarea

## First PR Slice (~200 lines)

`shared/errors.ts` + `shared/types.ts` + `shared/context.ts` + `shared/lifecycle.ts` + `managers/config/` + `managers/logging/` + `index.ts`

**Commit**: `feat(core): foundation — ConfigManager + LogManager + shared`
