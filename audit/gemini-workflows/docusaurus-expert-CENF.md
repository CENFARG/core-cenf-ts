# Audit: Docusaurus Docs for core-cenf-ts

**Source**: `core-cenf-py/docs/` — 30 pages (6 concept+setup, 21 managers, 2 guides, 1 API ref)
**Target**: `core-cenf-ts` — 19 managers. Removed from Python: TaskQueue, Dependency, DynamicPrompting, Alert, Permission, Licence, Update (7). Added: Validation, CircuitBreaker, JsonSerializer, Health, Bootstrap as manager (5). Net -2.

---

## 1. 30 Pages

| # | Page | Diátaxis | Source |
|---|------|----------|--------|
| 01 | `intro` | Explanation | Adapt from AGENTS.md |
| 02 | `getting-started/installation` | Tutorial | Write (npm) |
| 03 | `getting-started/quick-start` | Tutorial | Write |
| 04 | `core-concepts/ports-and-adapters` | Explanation | Adapt (TS code) |
| 05 | `core-concepts/context-propagation` | Explanation | Adapt (AsyncLocalStorage) |
| 06 | `core-concepts/agent-experience` | Explanation | Write (@ai-directive ref) |
| 07-25 | `managers/{...}` (19 pages) | Reference | Extract from AGENTS_API.md |
| 26 | `guides/bootstrap-guide` | How-to | Adapt (TS wiring) |
| 27 | `guides/testing-guide` | How-to | Write (vitest) |
| 28 | `guides/production-guide` | How-to | Write |
| 29 | `guides/migration-guide` | How-to | Write (from core-cenf-py) |
| 30 | `reference/api/overview` | Reference | Extract from api-catalog.json |

**19 managers**: config, log, secret, error-handling, validation, observability, auth, cache, feature-flag, rate-limiter, database, storage, http-client, circuit-breaker, event-bus, i18n, json-serializer, health, bootstrap-orchestrator.

---

## 2. Diátaxis Summary

- **Tutorial** (2): installation, quick-start
- **How-to** (4): bootstrap, testing, production, migration
- **Reference** (21): 19 managers + API overview + agent-experience (directive catalog)
- **Explanation** (3): intro, ports-and-adapters, context-propagation

---

## 3. Content Status

- **✅ Extract** (AGENTS_API.md): 20 pages — 19 managers + API overview. Need TS examples.
- **✏️ Adapt** (from Python): 5 pages — intro, install, ports-and-adapters, context-propagation, bootstrap.
- **✏️ Write** (no source): 5 pages — agent-experience, quick-start, testing, production, migration.

---

## 4. Priority

```
P0 → intro, install, quick-start, bootstrap-guide        (zero-to-running)
P1 → All 19 manager pages (parallel — independent)        (reference surface)
P2 → ports-and-adapters, context-propagation, agent-experience
P3 → testing-guide + API overview
P4 → production-guide + migration-guide
```

---

## 5. Deviations from Python

21→19 managers, `get_string`→`get<T>`, `contextvars`→`AsyncLocalStorage` (highest risk), ExternalAPI split into HttpClient+CircuitBreaker, SQLAlchemy→Drizzle, pytest→vitest, pip→npm.

---

## 6. Risks

- **Sidebar must differ** from Python — copying blind breaks nav
- **5 pages** from zero (quick-start, agent-experience, testing, production, migration)
- **AsyncLocalStorage** semantics differ from contextvars — accurate doc is critical
