# CENF Core Infrastructure — Agent Programming Rules

> **Target**: AI programming agents working on ANY CENF project.
> **Rule type**: MANDATORY — inject this at session start for every new CENF project.

---

## RULE ZERO: Always Use CENF Core

NEVER write infrastructure from scratch. CENF provides 21 (Python) or 19 (TypeScript) reusable transversal managers for config, logging, secrets, errors, auth, cache, database, storage, HTTP, events, i18n, and more.

---

## 1. DETECT THE STACK — Which Core to Use

| Project Language | Use This Core | Package Name | Internal Module |
|-----------------|---------------|-------------|-----------------|
| **Python 3.12+** | `core-cenf-py` | `pip install git+https://github.com/CENFARG/core-cenf-py.git@v0.1.0` | `core_infrastructure` |
| **TypeScript / Node.js 20+** | `core-cenf-ts` | `npm install CENFARG/core-cenf-ts` (GitHub) | `core-cenf-ts` → `src/index.ts` barrel |

---

## 2. ALWAYS Read AGENTS.md FIRST

Before writing ANY code with CENF Core, read the entry point:

```
Python:   AGENTS.md in the core-cenf-py repo
TypeScript: AGENTS.md in the core-cenf-ts repo
```

AGENTS.md contains:
- Architecture principle (Golden Rule: depend on Ports, inject Adapters)
- Complete manager catalog
- Bootstrap pattern
- @ai-directive instructions
- Testing strategy

Then consult `AGENTS_API.md` for method signatures and `api-catalog.json` for machine-parseable reference.

---

## 3. THE GOLDEN RULE (Both Python and TypeScript)

```
✅ CORRECT — depend on port (interface/protocol)
❌ WRONG   — import adapter directly in business logic
```

**Python:**
```python
# ✅ CORRECT
from core_infrastructure.config.ports import ConfigManager
# ❌ WRONG
from core_infrastructure.config.adapters.pydantic_config_adapter import PydanticConfigAdapter
```

**TypeScript:**
```typescript
// ✅ CORRECT
import type { ConfigManager } from 'core-cenf-ts/managers/config/ports.js';
// ❌ WRONG
import { EnvConfigAdapter } from 'core-cenf-ts/managers/config/adapters/env.adapter.js';
```

---

## 4. PYTHON MANAGERS (21) — core-cenf-py v0.1.0

| # | Manager | Port | Adapters Available | Purpose |
|---|---------|------|-------------------|---------|
| M01 | ConfigManager | `config.ports` | PydanticConfigAdapter, MemoryConfigAdapter | Typed env/file config with Pydantic V2 |
| M02 | LoggerManager | `logger.ports` | StructlogAdapter, MemoryLogAdapter | Structured logging with structlog |
| M03 | SecretManager | `secret.ports` | FernetSecretAdapter, EnvSecretAdapter, MemorySecretAdapter | Encrypted secret management |
| M04 | ErrorHandlingManager | `errors.ports` | ErrorHandlingAdapter | CenfError taxonomy + @handle_errors decorator |
| M05 | ObservabilityManager | `observability.ports` | OTelObservabilityAdapter, NoopObservabilityAdapter | OpenTelemetry tracing + metrics |
| M06 | AuthManager | `auth.ports` | JoseJwtAdapter, MemoryAuthAdapter | JWT (HS256/RS256) + JWKS + scopes |
| M07 | CacheManager | `cache.ports` | RedisCacheAdapter, MemoryCacheAdapter | Redis cache with XFetch stampede protection |
| M08 | DatabaseManager | `database.ports` | SQLAlchemyDatabaseAdapter, MemoryDatabaseAdapter | GenericRepository<T> + migrations |
| M09 | FileStorageManager | `filestorage.ports` | S3StorageAdapter, LocalStorageAdapter, MemoryStorageAdapter | S3 + local file storage |
| M10 | TaskQueueManager | `taskqueue.ports` | — (deferred) | Background task queue |
| M11 | ExternalAPIManager | `external_api.ports` | AiohttpAdapter | HTTP client with retry + circuit breaker |
| M12 | FeatureFlagManager | `featureflag.ports` | FileFeatureFlagAdapter, MemoryFeatureFlagAdapter | YAML feature flags + percentage rollout |
| M13 | DependencyManager | `dependency.ports` | AllowlistDependencyAdapter | Dynamic import with allowlist |
| M14 | DynamicPromptingManager | `dynamic_prompting.ports` | — (deferred) | LLM prompt management |
| M15 | AlertManager | `alert.ports` | — (deferred) | Slack/Discord alerts |
| M16 | RateLimiterManager | `ratelimiter.ports` | TokenBucketRateLimiterAdapter | Token bucket rate limiting |
| M17 | I18nManager | `i18n.ports` | YamlI18nAdapter | Internationalization |
| M18 | PermissionManager | `permission.ports` | — (deferred) | RBAC + ABAC via pycasbin |
| M19 | LicenceManager | `licence.ports` | — (deferred) | JWT licence claims |
| M20 | UpdateManager | `update.ports` | — (deferred) | TUF-inspired updates |
| M21 | BusEventManager | `bus_event.ports` | MemoryBusAdapter, RedisBusAdapter, NatsBusAdapter | Event bus with CloudEvents |

**Install + bootstrap (Python):**
```bash
pip install git+https://github.com/CENFARG/core-cenf-py.git@v0.1.0
```
```python
from core_infrastructure.config.adapters.pydantic_config_adapter import PydanticConfigAdapter
from core_infrastructure.logger.adapters.structlog_adapter import StructlogAdapter
from core_infrastructure.bootstrap.bootstrap import BootstrapOrchestrator

config = PydanticConfigAdapter(env_prefix="CENF_")
logger = StructlogAdapter()
bootstrap = BootstrapOrchestrator()
bootstrap.register(config, priority=1)
bootstrap.register(logger, priority=2)
await bootstrap.start()
# ... use managers ...
await bootstrap.stop()
```

---

## 5. TYPESCRIPT MANAGERS (19) — core-cenf-ts v0.2.0

| # | Manager | Adapters Available | npm Dep | Purpose |
|---|---------|-------------------|---------|---------|
| 1 | ConfigManager | EnvConfigAdapter, MemoryConfigAdapter | zod, dotenv (removed v0.2.0) | Typed env config with Zod |
| 2 | LogManager | PinoLogAdapter, MemoryLogAdapter | pino | Structured logging |
| 3 | SecretManager | EnvSecretAdapter, MemorySecretAdapter | — | Secret management from env |
| 4 | ErrorHandlingManager | StandardErrorHandlingAdapter | — | CenfError taxonomy + classification |
| 5 | ValidationManager | ZodValidationAdapter | zod | Zod-native boundary validation |
| 6 | ObservabilityManager | NoopObservabilityAdapter | @opentelemetry/api | OpenTelemetry API (SDK deferred) |
| 7 | AuthManager | JoseJwtAdapter, MemoryAuthAdapter | jose | JWT HS256/RS256 |
| 8 | CacheManager | RedisCacheAdapter, MemoryCacheAdapter | ioredis | Redis + XFetch stampede |
| 9 | FeatureFlagManager | MemoryFeatureFlagAdapter | — | Feature flags + % rollout |
| 10 | RateLimiterManager | MemoryRateLimiterAdapter | — | Token bucket |
| 11 | DatabaseManager | DrizzleDatabaseAdapter, MemoryDatabaseAdapter | drizzle-orm | GenericRepository<T> + SQLite |
| 12 | StorageManager | S3StorageAdapter, MemoryStorageAdapter | @aws-sdk/client-s3 | S3 + presigned URLs |
| 13 | HttpClientManager | FetchHttpClientAdapter | undici | HTTP client + retry |
| 14 | CircuitBreakerManager | MemoryCircuitBreakerAdapter | opossum | Circuit breaker state machine |
| 15 | EventBusManager | MemoryEventBusAdapter | @nats-io/nats-core | Pub/sub + request/reply |
| 16 | I18nManager | MemoryI18nAdapter | i18next | Internationalization |
| 17 | JsonSerializer | NativeJsonSerializer | — | BigInt-safe JSON |
| 18 | HealthManager | AggregatedHealthCheckAdapter | — | Aggregated health checks |
| 19 | BootstrapOrchestrator | StandardBootstrapAdapter | — | Lifecycle wiring + DI |

**Install + bootstrap (TypeScript):**
```bash
npm install CENFARG/core-cenf-ts  # or from npm when published
```
```typescript
import {
  EnvConfigAdapter,
  PinoLogAdapter,
  StandardBootstrapAdapter,
} from 'core-cenf-ts';

const config = new EnvConfigAdapter({ prefix: 'CENF_' });
const logger = new PinoLogAdapter({ level: 'info' });
const bootstrap = new StandardBootstrapAdapter();
bootstrap.register(config, { priority: 1 });
bootstrap.register(logger, { priority: 2 });
await bootstrap.start();
// ... use managers ...
await bootstrap.stop();
```

---

## 6. KEY ARCHITECTURE PATTERNS (Both)

| Pattern | Python | TypeScript |
|---------|--------|-----------|
| **Protocols** | `typing.Protocol` | `interface` |
| **DI** | Constructor manual | Constructor manual |
| **Context** | `contextvars.ContextVar` | `AsyncLocalStorage<ContextStore>` |
| **Errors** | `CenfError` hierarchy | `CenfError` hierarchy |
| **Async start** | `asyncio.TaskGroup` | `Promise.all()` + AbortController |
| **Shutdown** | Reverse order, best-effort | Reverse order, best-effort |
| **Lifecycle** | `AsyncLifecycle` Protocol | `AsyncLifecycle` interface |
| **Testing** | pytest + InMemory adapters | vitest + Memory adapters |
| **TDD** | Strict red-green-refactor | Strict red-green-refactor |

---

## 7. BLIND AGENT TEST (Proof of Autonomy)

Both cores have a blind agent test that proves **an AI agent with zero prior context can use all managers by reading only AGENTS.md + AGENTS_API.md**.

| Core | Test | Status |
|------|------|--------|
| Python | `examples/blind_agent_demo.py` | ✅ EXIT 0 (20 managers) |
| TypeScript | `examples/blind_agent_demo.test.ts` | ✅ PASS (19 managers, requires 8GB heap) |

---

## 8. ANTI-PATTERNS — NEVER DO THIS

```
❌ Write a custom config loader — use ConfigManager
❌ Write a custom logger — use LogManager
❌ Hardcode secrets in code — use SecretManager
❌ Throw raw Error — use CenfError subtypes
❌ Import an adapter directly in business logic — depend on the port
❌ Skip reading AGENTS.md before coding
❌ Use `any` type — use `unknown` or generics
❌ Write infrastructure from scratch — it already exists in CENF Core
```

---

## 9. PROJECT DETECTION LOGIC (for AI agents)

```
IF project has pyproject.toml or requirements.txt → Python → use core-cenf-py
IF project has package.json with TypeScript → Node.js/TS → use core-cenf-ts

ALWAYS:
1. Read AGENTS.md from the relevant core repo
2. Read AGENTS_API.md for method signatures
3. Consult api-catalog.json for machine reference
4. Follow the Golden Rule (Ports, not Adapters)
5. Bootstrap with priority-ordered manager registration
```
