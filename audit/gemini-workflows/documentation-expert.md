# Documentation Audit: core-cenf-ts (Diátaxis)

## 1. Tutorials (learning-oriented)

**Status: 🔴 Missing**

No getting-started tutorial exists. `AGENTS.md` includes a 4-line "Quick Start" (npm install → build → test) but that is a reference snippet, not a tutorial.

The closest thing is `examples/blind_agent_demo.test.ts` (466 lines) — a full integration test that boots all 19 managers. Useful as a proof-of-concept but functions as test code, not a learning walkthrough. No explanations, no incremental steps, no "why does this work".

**What's needed**: A `docs/tutorials/getting-started.md` that walks through bootstrapping ConfigManager → adding LogManager → wiring BootstrapOrchestrator → verifying health, with prose explaining each step.

---

## 2. How-to Guides (task-oriented)

**Status: 🔴 Missing**

Zero task-oriented documentation. Common questions with no written answer:
- "How do I add a new adapter?" (e.g., swap MemoryCacheAdapter for RedisCacheAdapter)
- "How do I create a custom manager?"
- "How do I configure the BootstrapOrchestrator for production?"
- "How do I run integration tests?"

The only task-level artifact is the CI/CD pipeline spec in `openspec/`, which is a requirements document, not a user-facing guide.

**What's needed**: `docs/how-to/*.md` files for the top 5 tasks: add an adapter, configure a manager, wire BootstrapOrchestrator, run tests, deploy.

---

## 3. Reference (information-oriented)

**Status: 🟢 Well-covered**

Strongest quadrant by far:

- **`AGENTS.md`** — Manager table (19 managers), file structure, architecture principle, agent rules (@ai-directive).
- **`AGENTS_API.md`** — Structured catalog: Port interface → Adapters → Errors for all 19 managers, plus Common Types section with 15+ shared interfaces.
- **`api-catalog.json`** — Machine-parseable reference for tooling/agents.
- **`package.json`** — Scripts, exports, metadata.
- **Source code** — `src/index.ts` barrel exports provide the canonical public API surface.

**Minor gaps**: Some manager types referenced in the demo (`MemoryCacheOptions`, `FlagConfig`, `JwtPayload`, `HealthStatus`) are not documented in `AGENTS_API.md`. Type import paths could be more explicit.

---

## 4. Explanation (understanding-oriented)

**Status: 🟡 Minimal**

Architecture is stated but not explained:
- "Depend on Protocols, inject Adapters" is asserted (with a code example) but never justified.
- No ADRs (Architecture Decision Records) exist.
- No comparison with alternatives (why Ports & Adapters vs. dependency injection container? Why this error hierarchy? Why 19 managers — what's the cohesion criterion?).
- `openspec/changes/` dir has design docs but those are per-change SDD artifacts, not evergreen architecture rationale.

**What's needed**: A `docs/architecture/decisions.md` or `docs/explanation/why-ports-and-adapters.md` covering the key architectural choices and their tradeoffs.

---

## Summary

| Quadrant    | Status | Coverage                                    |
|-------------|--------|---------------------------------------------|
| Tutorials   | 🔴     | None (4-line Quick Start in AGENTS.md only) |
| How-to      | 🔴     | None                                        |
| Reference   | 🟢     | Strong — AGENTS.md, AGENTS_API.md, catalog  |
| Explanation | 🟡     | Minimal — principle stated, not justified   |

**First priority**: How-to guides (unblocks users). **Second**: Tutorial (lowers onboarding friction). **Third**: Explanation (supports long-term maintenance).
