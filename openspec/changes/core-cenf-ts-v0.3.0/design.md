# Design: core-cenf-ts v0.3.0 — Monorepo Migration

## Technical Approach

Extract the monolithic `core-cenf-ts` package into 25 `@cenf/*` scoped packages under a pnpm workspace with turborepo orchestration. The shared layer (`src/shared/`) becomes `@cenf/core` (zero deps). Each manager becomes its own package with a `tsup` single-entry ESM build. Cross-package imports switch from relative paths (`../../shared/errors.js`) to `workspace:*` protocol (`@cenf/core`). Migration is **incremental**: extract `@cenf/core` first, then migrate managers one at a time, verifying 819 tests at each step.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Package manager | pnpm | npm workspaces, yarn | `workspace:*` protocol, fast installs, disk-efficient store |
| Build | tsup per package | tsc, esbuild, rollup | Already used; single-entry ESM + dts; fast |
| Shared layer | Single `@cenf/core` package | Multiple tiny packages | errors/types/lifecycle/context/utils are tightly coupled — splitting them just adds overhead |
| Versioning | Independent (changesets) | Fixed/locked | 19 managers evolve at different rates; independent allows patch-only releases |
| Port imports | Each package re-exports its port from `@cenf/core` | Ports live in own packages | Follows core-cenf-py pattern; all interfaces accessible from one import |
| Test migration | Tests move into each package | Keep tests at root | Each package is independently testable; turbo can parallelize |

## Data Flow

```
@cenf/core (errors, types, lifecycle, context, utils)
     │
     ▼
@cenf/config ──→ @cenf/logging ──→ ...19 managers...
     │                   │
     ▼                   ▼
@cenf/bootstrap (wires all managers via constructor injection)
```

Managers depend ONLY on `@cenf/core` + their own external deps. No manager depends on another manager. `@cenf/bootstrap` is the sole integrator, wiring managers via manual constructor injection.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `pnpm-workspace.yaml` | Create | `packages: ['packages/*']` |
| `turbo.json` | Create | Pipeline: build, test, lint, typecheck |
| `packages/core/` | Create | Extracted from `src/shared/`: errors, types, lifecycle, context, utils |
| `packages/config/` | Create | Extracted from `src/managers/config/` + zod dep |
| `packages/*/` (×17) | Create | Remaining 17 managers + bootstrap |
| `packages/task-queue/` | Create | New: TaskQueueManager (bullmq) |
| `packages/permission/` | Create | New: PermissionManager (casbin) |
| `packages/licence/` | Create | New: LicenceManager (jose) |
| `package.json` (root) | Modify | `private: true`, scripts → `turbo run` |
| `src/` | Delete | Entire monolithic src after full migration verified |

## Per-Package Structure (canonical)

```
packages/core/
├── package.json      # "name": "@cenf/core", "exports": "./dist/index.js"
├── tsconfig.json      # extends root tsconfig, outDir dist/
├── tsup.config.ts     # entry: ['src/index.ts'], format: ['esm'], dts: true
├── src/
│   ├── index.ts       # barrel: re-exports all shared modules
│   ├── errors.ts
│   ├── types.ts
│   ├── lifecycle.ts
│   ├── context.ts
│   └── utils.ts
└── __tests__/         # co-located tests
```

All 25 packages follow this structure. External deps stay with their package (e.g., `zod` only in `@cenf/config` and `@cenf/validation`).

## Interfaces / Contracts

```typescript
// packages/core/src/index.ts — base package barrel
export { CenfError, ConfigError, ValidationError, /* ... */ } from './errors.js';
export type { JsonValue, JsonObject, Result, HealthStatus, ContextStore } from './types.js';
export type { AsyncLifecycle } from './lifecycle.js';
export { runInContext, getContext, setContext } from './context.js';
export { retry, exponentialBackoff, sha256Hash, isCenfError } from './utils.js';
```

```jsonc
// packages/config/package.json — dependency contract
{
  "name": "@cenf/config",
  "dependencies": {
    "@cenf/core": "workspace:*",
    "zod": "^3.24.0"
  }
}
```

All imports change from `../../shared/errors.js` to `@cenf/core`.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (per package) | Each manager's ports, types, adapters, errors | `vitest` in package dir; `turbo run test` aggregates |
| Integration | Cross-manager wiring via `@cenf/bootstrap` | Root-level integration tests stay until all managers migrated |
| E2E | Real adapter integration (Redis, S3, NATS) | `examples/` tests with docker-compose; run via turbo |

Each package inherits coverage thresholds from root (80% stmts, 75% branches). All 819 existing tests must pass after migration — no test deletion without replacement.

## Migration / Rollout

1. Scaffold workspace skeleton (root config, turbo, pnpm-workspace)
2. Extract `@cenf/core`, verify tests pass with dual paths (old + new)
3. Migrate zero-dep managers first (secret, rate-limiter, feature-flag, json-serializer, health)
4. Migrate light-dep managers (config, logging, validation, errors)
5. Migrate heavy managers (cache, database, storage, etc.)
6. Migrate `@cenf/bootstrap`, delete monolithic `src/`

Rollback: each extraction is a single commit. Revert the commit to restore prior state. Old `src/` stays intact until all packages verified.

## Open Questions

- [ ] npm `@cenf` scope registered? (blocker for publish — R7.4 prerequisite)
- [ ] Shared tsconfig: extend root or copy per package? (extend avoids drift; copy lets packages diverge)
- [ ] JetStream KV semantics: does `@nats-io/nats-core` v3 KV API match Python NatsBus surface? (needs spike during apply)
