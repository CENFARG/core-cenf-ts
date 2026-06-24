# JsonSerializer Specification

## Purpose

Provides BigInt-safe JSON serialization and deserialization with custom type handling for Date, Map, Set, and other non-standard JSON types.

## Port Interface

```typescript
interface IJsonSerializer {
  serialize<T>(data: T, options?: SerializeOptions): string;
  deserialize<T>(json: string, options?: DeserializeOptions): T;
}

interface SerializeOptions {
  pretty?: boolean;
  dateFormat?: 'iso' | 'timestamp';
}

interface DeserializeOptions {
  dateFormat?: 'iso' | 'timestamp';
  strict?: boolean;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `NativeJsonSerializer` | Handles BigInt, Dates via custom replacer/reviver |

## Error Types

- `JsonSerializationError` — Circular reference, unsupported type
- `JsonDeserializationError` — Invalid JSON, type mismatch in strict mode

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_JSON_BIGINT_MODE` | `string\|number` | `string` | BigInt serialization format |
| `CENF_JSON_DATE_MODE` | `iso\|timestamp` | `iso` | Date serialization format |

## Lifecycle

- `start()`: No-op (stateless)
- `stop()`: No-op
- `health()`: Returns `{ status: 'healthy' }`

## Testing Strategy

- **Unit**: BigInt round-trip, Date serialization modes
- **Integration**: Complex nested objects with mixed types
- **Edge cases**: Circular references, undefined values, null vs missing

## Requirements

### Requirement: BigInt-Safe Serialization

The system MUST serialize BigInt values without throwing `TypeError`. BigInts MUST be converted to strings by default.

#### Scenario: Serialize object with BigInt

- GIVEN an object `{ id: 9007199254740993n, name: "large" }`
- WHEN `serializer.serialize(data)` is called
- THEN it returns `'{"id":"9007199254740993","name":"large"}'`
- AND no TypeError is thrown

#### Scenario: Deserialize BigInt back from string

- GIVEN JSON string `'{"id":"9007199254740993","name":"large"}'`
- WHEN `serializer.deserialize<Record<string, unknown>>(json)` is called
- THEN the `id` value is the string `"9007199254740993"`
- AND the value can be converted back to BigInt by the consumer

### Requirement: Date Handling

The system MUST serialize Date objects according to the configured format. Deserialization MUST restore Date objects.

#### Scenario: Date serialized as ISO string

- GIVEN `dateFormat: 'iso'` and a Date `new Date("2024-01-15T10:30:00Z")`
- WHEN `serializer.serialize({ createdAt: date })` is called
- THEN the output contains `"createdAt":"2024-01-15T10:30:00.000Z"`

#### Scenario: Date deserialized back to Date object

- GIVEN JSON with ISO date string `"2024-01-15T10:30:00.000Z"`
- WHEN `serializer.deserialize(json)` is called
- THEN the value is a `Date` instance
- AND `date.toISOString()` matches the original

#### Scenario: Circular reference detection

- GIVEN an object with circular reference `obj.self = obj`
- WHEN `serializer.serialize(obj)` is called
- THEN it throws `JsonSerializationError`
- AND the error message indicates a circular reference
