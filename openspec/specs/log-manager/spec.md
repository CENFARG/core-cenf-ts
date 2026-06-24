# LogManager Specification

## Purpose

Provides structured, leveled logging with child logger support. Replaces `console.log` with production-ready pino-based logging that includes correlation IDs, JSON output, and level control.

## Port Interface

```typescript
interface ILogManager {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  fatal(obj: unknown, msg?: string): void;
  child(bindings: Record<string, unknown>): ILogManager;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `PinoLogAdapter` | Wraps pino, provides structured JSON logging |
| `MemoryLogAdapter` | In-memory log capture for testing |

## Error Types

- `LogConfigurationError` — Invalid log level, transport misconfiguration

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_LOG_LEVEL` | `trace\|debug\|info\|warn\|error\|fatal` | `info` | Minimum log level |
| `CENF_LOG_FORMAT` | `json\|pretty` | `json` | Output format |
| `CENF_LOG_CORRELATION` | `boolean` | `true` | Inject correlation ID |

## Lifecycle

- `start()`: Initializes pino instance with configured level and transports
- `stop()`: Flushes pending log writes, closes transports
- `health()`: Returns `{ status: 'healthy', details: { level, format } }`

## Testing Strategy

- **Unit**: `MemoryLogAdapter` captures log entries, verify structure
- **Integration**: `PinoLogAdapter` writes to stream, verify JSON output
- **Edge cases**: Child logger inheritance, circular object handling, level filtering

## Requirements

### Requirement: Structured Leveled Logging

The system MUST provide five log levels (debug, info, warn, error, fatal) with structured JSON output. Each log entry MUST include timestamp, level, and message.

#### Scenario: Info-level log entry with context object

- GIVEN log level is set to `info`
- WHEN `logger.info({ userId: "123" }, "User logged in")` is called
- THEN the output contains `{ level: "info", msg: "User logged in", userId: "123", time: "..." }`
- AND debug-level calls are suppressed

#### Scenario: Child logger inherits parent bindings

- GIVEN a parent logger with binding `{ service: "auth" }`
- WHEN `child = logger.child({ requestId: "abc" })` is called
- THEN `child.info({}, "test")` outputs both `service: "auth"` AND `requestId: "abc"`
- AND the parent logger does NOT include `requestId`

#### Scenario: Error-level log includes stack trace

- GIVEN an error object with stack trace
- WHEN `logger.error(err, "Operation failed")` is called
- THEN the output includes the error message AND stack trace string
- AND the log level is `error`

#### Scenario: Log level filtering at runtime

- GIVEN log level is `warn`
- WHEN `logger.debug({}, "debug msg")` and `logger.warn({}, "warn msg")` are called
- THEN only the warn message appears in output
- AND the debug message is silently dropped

#### Scenario: Pretty format for local development

- GIVEN `CENF_LOG_FORMAT=pretty` and `CENF_ENV=local`
- WHEN any log method is called
- THEN output is human-readable with colored level labels
- AND NOT raw JSON
