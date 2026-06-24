# CircuitBreakerManager Specification

## Purpose

Protects downstream services from cascading failures using the circuit breaker pattern. Wraps opossum for state machine management with fallback functions.

## Port Interface

```typescript
interface ICircuitBreakerManager {
  call<T>(name: string, fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
  status(name: string): CircuitBreakerStatus;
  reset(name: string): void;
}

interface CircuitBreakerStatus {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailure?: Date;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `OpossumCircuitBreakerAdapter` | Wraps opossum circuit breaker library |

## Error Types

- `CircuitBreakerOpenError` — Circuit is open, call rejected immediately

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_CB_FAILURE_THRESHOLD` | `number` | `5` | Failures before opening |
| `CENF_CB_RESET_TIMEOUT` | `number` | `30000` | ms before half-open |
| `CENF_CB_SUCCESS_THRESHOLD` | `number` | `3` | Successes to close from half-open |

## Lifecycle

- `start()`: No-op (circuit breakers are created on-demand)
- `stop()`: Resets all open circuit breakers
- `health()`: Returns `{ status: 'healthy', details: { breakers: [{ name, state }] } }`

## Testing Strategy

- **Unit**: State transitions (closed → open → half-open → closed)
- **Integration**: Opossum adapter with mock failing service
- **Edge cases**: Fallback invocation, concurrent calls during half-open

## Requirements

### Requirement: Circuit Breaker State Machine

The system MUST implement the circuit breaker pattern with three states: closed (normal), open (rejecting), half-open (testing recovery).

#### Scenario: Normal operation — closed state

- GIVEN a circuit breaker with 0 failures
- WHEN `cb.call("api", successfulFn)` is called
- THEN the function executes normally
- AND the state remains `closed`

#### Scenario: Open circuit after threshold failures

- GIVEN `failureThreshold: 3` and 3 consecutive failures
- WHEN `cb.call("api", failingFn)` is called a 4th time
- THEN it throws `CircuitBreakerOpenError` immediately
- AND the function is NOT executed
- AND state transitions to `open`

#### Scenario: Half-open recovery test

- GIVEN circuit is `open` and reset timeout has elapsed
- WHEN `cb.call("api", successfulFn)` is called
- THEN the function IS executed (recovery test)
- AND on success, state transitions to `closed`

### Requirement: Fallback Function Invocation

The system MUST invoke the fallback function when the circuit is open or the primary function fails.

#### Scenario: Fallback on open circuit

- GIVEN circuit is `open` and a fallback is provided
- WHEN `cb.call("api", failingFn, fallbackFn)` is called
- THEN the fallback is invoked
- AND the fallback result is returned

#### Scenario: Fallback on primary failure

- GIVEN circuit is `closed` and primary function throws
- WHEN `cb.call("api", failingFn, fallbackFn)` is called
- THEN the fallback is invoked
- AND the fallback result is returned (not the error)

#### Scenario: Manual reset clears state

- GIVEN a circuit breaker in `open` state
- WHEN `cb.reset("api")` is called
- THEN the state is reset to `closed`
- AND failure/success counters are zeroed
