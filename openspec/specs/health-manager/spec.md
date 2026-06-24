# HealthManager Specification

## Purpose

Aggregates health checks across all registered managers. Provides readiness (dependencies ready) and liveness (process alive) probes for Kubernetes and load balancers.

## Port Interface

```typescript
interface IHealthManager {
  register(name: string, check: () => Promise<HealthStatus>): void;
  check(): Promise<HealthReport>;
  check(name: string): Promise<HealthStatus>;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
  timestamp: Date;
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthStatus>;
  timestamp: Date;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `AggregatedHealthAdapter` | Manages registry, runs checks, aggregates report |

## Error Types

- `HealthCheckTimeoutError` — Individual check exceeded timeout

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_HEALTH_CHECK_TIMEOUT` | `number` | `5000` | Max ms per individual check |
| `CENF_HEALTH_READINESS_DEPS` | `string[]` | `[]` | Checks required for readiness |

## Lifecycle

- `start()`: No-op (checks registered by other managers during their start)
- `stop()`: Clears registry
- `health()`: Returns self-health (always healthy if started)

## Testing Strategy

- **Unit**: Registration, aggregation logic, status computation
- **Integration**: Multiple mock checks with varying results
- **Edge cases**: Check timeout, check throws, empty registry

## Requirements

### Requirement: Health Check Registration and Aggregation

The system MUST allow managers to register health checks and aggregate results into a single report. The overall status MUST reflect the worst individual status.

#### Scenario: Register and run single check

- WHEN `health.register("db", async () => ({ status: "healthy", timestamp: new Date() }))` is called
- THEN `await health.check("db")` returns the registered check result
- AND the timestamp is recent

#### Scenario: Aggregate multiple checks

- GIVEN checks registered: `db: healthy`, `cache: healthy`, `redis: degraded`
- WHEN `await health.check()` is called
- THEN the report status is `degraded` (worst of all)
- AND `checks` contains all three individual results

#### Scenario: Check timeout produces unhealthy status

- GIVEN a check that takes 10 seconds and timeout is 5 seconds
- WHEN `await health.check("slow-service")` is called
- THEN it returns `{ status: "unhealthy", details: { error: "timeout" } }`
- AND the check is not allowed to run indefinitely

#### Scenario: Check throwing exception is caught

- GIVEN a check that throws `new Error("crashed")`
- WHEN `await health.check("broken-service")` is called
- THEN it returns `{ status: "unhealthy", details: { error: "crashed" } }`
- AND the exception does NOT propagate

#### Scenario: Empty registry returns healthy

- GIVEN no checks are registered
- WHEN `await health.check()` is called
- THEN it returns `{ status: "healthy", checks: {}, timestamp: ... }`
- AND no error is thrown
