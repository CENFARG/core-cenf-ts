# BootstrapOrchestrator Specification

## Purpose

Coordinates startup and shutdown of all managers in dependency order. Ensures graceful lifecycle management with parallel startup (fast-fail) and sequential reverse-order shutdown.

## Port Interface

```typescript
interface IBootstrapOrchestrator {
  register(name: string, manager: AsyncLifecycle, priority: number): void;
  start(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<HealthReport>;
}

interface AsyncLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<HealthStatus>;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `StandardBootstrapOrchestrator` | Priority-ordered lifecycle management |

## Error Types

- `BootstrapError` — Startup failed, first exception propagated
- `ShutdownError` — Shutdown failed (logged, not thrown)

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_BOOT_STARTUP_TIMEOUT` | `number` | `30000` | Max ms for total startup |
| `CENF_BOOT_SHUTDOWN_TIMEOUT` | `number` | `10000` | Max ms per manager shutdown |

## Lifecycle

- `start()`: Starts all registered managers in priority order (lowest first)
- `stop()`: Stops all managers in reverse priority order (highest first)
- `health()`: Delegates to HealthManager for aggregated report

## Testing Strategy

- **Unit**: Priority ordering, startup failure propagation
- **Integration**: Full lifecycle with mock managers (start/stop/health)
- **Edge cases**: Partial startup failure, shutdown error handling, duplicate registration

## Requirements

### Requirement: Priority-Ordered Startup

The system MUST start managers in ascending priority order. If ANY manager fails to start, remaining managers MUST be stopped and the error propagated.

#### Scenario: Successful startup in order

- GIVEN managers registered: `config(priority=0)`, `logger(priority=1)`, `db(priority=10)`
- WHEN `await bootstrap.start()` is called
- THEN managers start in order: config → logger → db
- AND all managers are in started state

#### Scenario: Startup failure triggers rollback

- GIVEN managers: `config(0)` starts ok, `logger(1)` starts ok, `db(10)` throws
- WHEN `await bootstrap.start()` is called
- THEN `db.start()` failure is propagated as `BootstrapError`
- AND already-started managers (config, logger) are stopped in reverse order

#### Scenario: Duplicate registration rejected

- GIVEN a manager named "config" is already registered
- WHEN `bootstrap.register("config", anotherManager, 0)` is called
- THEN it throws an error indicating duplicate name
- AND the original registration is preserved

### Requirement: Reverse-Order Graceful Shutdown

The system MUST stop managers in reverse priority order. Individual shutdown failures MUST be logged but NOT block remaining shutdowns.

#### Scenario: Successful shutdown in reverse order

- GIVEN all managers are started: config(0), logger(1), db(10)
- WHEN `await bootstrap.shutdown()` is called
- THEN managers stop in order: db → logger → config
- AND all managers are in stopped state

#### Scenario: Shutdown error does not block others

- GIVEN `db.stop()` throws but `logger.stop()` and `config.stop()` succeed
- WHEN `await bootstrap.shutdown()` is called
- THEN the db error is logged
- AND logger and config are still stopped
- AND no exception is thrown from shutdown()

#### Scenario: Shutdown with no started managers

- GIVEN no managers have been started
- WHEN `await bootstrap.shutdown()` is called
- THEN it completes without error
- AND no stop() calls are made
