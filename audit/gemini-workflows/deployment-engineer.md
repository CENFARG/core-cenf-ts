# Deployment Engineer — CI/CD Audit

**Project**: core-cenf-ts | **Date**: 2026-06-25 | **Scope**: Read-only

---

## 1. CI Pipeline — `ci.yml`

**Exists (good)**: checkout@v4, setup-node@v4 (`cache: npm`), typecheck, lint, vitest+coverage (8GB heap), `npm audit --audit-level=high --omit=dev`, CycloneDX SBOM, artifact uploads (sbom + coverage).

**Missing**:

| Gap | Impact | Priority |
|-----|--------|----------|
| ❌ No `npm run build` (tsup) | Dist rots silently; bundling errors undetected | **High** |
| ❌ Node matrix `['22']` only (min engine is 20.6) | No regression guard for Node 20 | **Med** |
| ❌ No `concurrency: cancel-in-progress` | Wasted runs on fast pushes | Low |

**Fix**: Add build step before lint. Expand matrix to `['20', '22']`.

---

## 2. npm Publish Readiness

**Exists**: `prepublishOnly` → build, `files: ["dist"]`, exports map (`.` + `./*`), `types`, ESM-only.

| Gap | Detail | Fix |
|-----|--------|-----|
| ❌ No `publishConfig` | No `access: public` | Add `"publishConfig": { "access": "public" }` |
| ❌ No `--provenance` | No attestation | `npm publish --provenance` + `id-token: write` |
| ❌ No `release.yml` workflow | No publish automation | Create workflow (tag-triggered) |
| ❌ No `sideEffects` | Blocks consumer tree-shaking | Add `"sideEffects": false` |
| ❌ No `repository` field | Required for provenance | Add `"repository": "github:CENFARG/core-cenf-ts"` |
| ⚠️ `version` 0.1.0 vs AGENTS.md v0.2.0 | Mismatch | Bump to 0.2.0 |
| ⚠️ Description says "17 managers" | Code has 19 | Update to 19 |

---

## 3. Security

**Exists**: `npm audit --high --omit=dev` in CI, CycloneDX SBOM archived per build.

**Missing**:

| Gap | Priority |
|-----|----------|
| ❌ No `.github/dependabot.yml` | **High** |
| ❌ No CodeQL analysis | **Med** |
| ❌ No npm provenance attestation | **Med** |
| ❌ No `id-token: write` permission set | **Med** |

---

## 4. Missing Infra Artifacts

| Artifact | Verdict | Why |
|----------|---------|-----|
| Dockerfile | ❌ Not needed | npm library, not a service |
| docker-compose | ❌ Not needed | Adapter infra lives in `vitest.*.config.ts` files |
| K8s / Helm | ❌ Not needed | Consuming apps own their deploy |

Core-cenf-ts is a **library**. The existing vitest configs (`vitest.dc.config.ts`, `vitest.ob.config.ts`, etc.) serve as the integration-test harness.

---

## 5. Action Items — Priority Order

### Release-blocking
1. Bump `version` to 0.2.0 + fix description
2. Add `repository` field (provenance prerequisite)
3. Add `publishConfig.access` + `"sideEffects": false`
4. Add `npm run build` to CI
5. Create `release.yml` with `--provenance` + `id-token: write`
6. Add `.github/dependabot.yml`

### Should-fix
7. Expand Node matrix to `['20', '22']`
8. Add CodeQL analysis

### Won't-fix (library-appropriate)
Dockerfile, compose, K8s — consuming apps own these.

---

**Refs**: `ci.yml` (57ℓ), `package.json` (67ℓ), `tsup.config.ts` (13ℓ), `.gitignore`
