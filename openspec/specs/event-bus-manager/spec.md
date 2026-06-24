# EventBusManager Specification

## Purpose

Provides publish-subscribe messaging via NATS. Supports pub/sub, request/reply patterns, and CloudEvents envelope wrapping for interoperability.

## Port Interface

```typescript
interface IEventBusManager {
  publish<T>(subject: string, data: T): Promise<void>;
  subscribe<T>(subject: string, handler: (data: T) => Promise<void>): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  health(): Promise<EventBusHealth>;
}

interface EventBusHealth {
  connected: boolean;
  subscriptions: number;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `NatsEventBusAdapter` | Wraps `@nats-io/nats-core` v3 |
| `MemoryEventBusAdapter` | In-process pub/sub for testing |

## Error Types

- `EventBusConnectionError` — NATS server unreachable
- `EventBusPublishError` — Message publish failed
- `EventBusSubscriptionError` — Subscription creation failed

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_EVENT_NATS_URL` | `string` | `nats://localhost:4222` | NATS server URL |
| `CENF_EVENT_SUBJECT_PREFIX` | `string` | `cenf` | Subject namespace prefix |
| `CENF_EVENT_CLOUDEVENTS` | `boolean` | `true` | Wrap messages in CloudEvents envelope |

## Lifecycle

- `start()`: Connects to NATS server, validates connection
- `stop()`: Drains subscriptions, closes NATS connection
- `health()`: Returns connection status and active subscription count

## Testing Strategy

- **Unit**: `MemoryEventBusAdapter` — publish/subscribe round-trip
- **Integration**: `NatsEventBusAdapter` with embedded NATS server
- **Edge cases**: Handler errors, unsubscribe during publish, reconnection

## Requirements

### Requirement: Publish-Subscribe Messaging

The system MUST publish messages to subjects and deliver them to all active subscribers. Subscriptions MUST be exact-match (no wildcards for MVP).

#### Scenario: Publish and receive message

- GIVEN a subscriber is registered for subject `user.created`
- WHEN `await bus.publish("user.created", { id: "1", name: "John" })` is called
- THEN the subscriber handler receives `{ id: "1", name: "John" }`
- AND the handler is called asynchronously

#### Scenario: Multiple subscribers receive same message

- GIVEN two subscribers registered for `order.placed`
- WHEN `await bus.publish("order.placed", { orderId: "123" })` is called
- THEN BOTH subscribers receive the message
- AND one subscriber's error does NOT block the other

#### Scenario: Unsubscribe stops message delivery

- GIVEN a subscriber with ID `sub-1` for `user.created`
- WHEN `await bus.unsubscribe("sub-1")` is called
- THEN subsequent publishes to `user.created` do NOT reach that handler
- AND the subscription count decreases by 1

#### Scenario: CloudEvents envelope wrapping

- GIVEN `CENF_EVENT_CLOUDEVENTS=true`
- WHEN `await bus.publish("event.test", { data: "value" })` is called
- THEN the message is wrapped in a CloudEvents envelope
- AND includes `specversion`, `type`, `source`, `id`, and `time` fields

#### Scenario: Health reports connection and subscriptions

- GIVEN 3 active subscriptions and a connected NATS server
- WHEN `await bus.health()` is called
- THEN it returns `{ connected: true, subscriptions: 3 }`
- AND if NATS is disconnected, returns `{ connected: false, subscriptions: 0 }`
