# RateLimiterManager Specification

## Purpose

Implements token bucket rate limiting with zero external dependencies. Protects APIs and resources from abuse by controlling request throughput per key.

## Port Interface

```typescript
interface IRateLimiterManager {
  consume(key: string, tokens?: number): Promise<RateLimitResult>;
  status(key: string): Promise<RateLimitStatus>;
  reset(key: string): Promise<void>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

interface RateLimitStatus {
  key: string;
  tokensRemaining: number;
  capacity: number;
  refillRate: number;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `TokenBucketAdapter` | Pure TypeScript token bucket implementation |
| `SlidingWindowAdapter` | Sliding window counter implementation |

## Error Types

- `RateLimitExceededError` — Bucket exhausted, request denied

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_RATE_CAPACITY` | `number` | `100` | Max tokens per bucket |
| `CENF_RATE_REFILL` | `number` | `10` | Tokens refilled per second |
| `CENF_RATE_ALGORITHM` | `token-bucket\|sliding-window` | `token-bucket` | Rate limiting algorithm |

## Lifecycle

- `start()`: Initializes bucket store, starts refill interval
- `stop()`: Clears refill interval, resets all buckets
- `health()`: Returns `{ status: 'healthy', details: { activeBuckets, algorithm } }`

## Testing Strategy

- **Unit**: Token bucket math — consume, refill, capacity limits
- **Integration**: Multiple keys, concurrent consumption
- **Edge cases**: Zero tokens, burst consumption, refill timing precision

## Requirements

### Requirement: Token Bucket Rate Limiting

The system MUST implement a token bucket algorithm with configurable capacity and refill rate. Consumption MUST be atomic per key.

#### Scenario: Consume within capacity

- GIVEN a bucket with capacity=10 and 10 tokens available
- WHEN `await limiter.consume("api:user-1", 1)` is called
- THEN it returns `{ allowed: true, remaining: 9 }`
- AND the token count is decremented

#### Scenario: Consumption exceeds available tokens

- GIVEN a bucket with 2 tokens remaining
- WHEN `await limiter.consume("api:user-1", 5)` is called
- THEN it returns `{ allowed: false, remaining: 2, retryAfterMs: 300 }`
- AND no tokens are consumed

#### Scenario: Token refill over time

- GIVEN a bucket with capacity=10, refillRate=2/s, currently at 0 tokens
- WHEN 3 seconds pass
- THEN the bucket has 6 tokens (capped at capacity)
- AND `consume("key", 1)` returns `{ allowed: true, remaining: 5 }`

#### Scenario: Status check without consuming

- GIVEN a bucket has been used by key "api:user-1"
- WHEN `await limiter.status("api:user-1")` is called
- THEN it returns current tokens, capacity, and refill rate
- AND no tokens are consumed

#### Scenario: Reset clears bucket state

- GIVEN a bucket for key "api:user-1" is exhausted (0 tokens)
- WHEN `await limiter.reset("api:user-1")` is called
- THEN the bucket is refilled to full capacity
- AND subsequent `consume()` returns `{ allowed: true }`
