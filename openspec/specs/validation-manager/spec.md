# ValidationManager Specification

## Purpose

Provides boundary validation using Zod schemas. Ensures all external input (API requests, config, events) is validated before entering the domain layer.

## Port Interface

```typescript
interface IValidationManager {
  validate<T>(schema: Zod.ZodSchema<T>, data: unknown): T;
  validateAsync<T>(schema: Zod.ZodSchema<T>, data: unknown): Promise<T>;
  validateArray<T>(schema: Zod.ZodSchema<T>, data: unknown[]): T[];
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `ZodValidationAdapter` | Wraps Zod's safeParse/safeParseAsync |

## Error Types

- `ValidationError` — Schema validation failed (extends `CenfError`)
- `ValidationArrayError` — One or more items in array failed validation

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_VALIDATION_MAX_ARRAY` | `number` | `1000` | Max items for validateArray |

## Lifecycle

- `start()`: No-op (pure logic)
- `stop()`: No-op
- `health()`: Returns `{ status: 'healthy' }`

## Testing Strategy

- **Unit**: Zod schema validation with valid/invalid data
- **Integration**: Complex nested schemas, async refinements
- **Edge cases**: Empty arrays, circular refs, max array limit exceeded

## Requirements

### Requirement: Sync Boundary Validation

The system MUST validate data against a Zod schema synchronously. Invalid data MUST throw `ValidationError` with field-level error details.

#### Scenario: Valid data passes sync validation

- GIVEN a Zod schema `z.object({ name: z.string(), age: z.number() })`
- WHEN `validate(schema, { name: "John", age: 30 })` is called
- THEN it returns the validated object with correct types
- AND no error is thrown

#### Scenario: Invalid data throws with field details

- GIVEN the same schema as above
- WHEN `validate(schema, { name: "John", age: "not-a-number" })` is called
- THEN it throws `ValidationError`
- AND the error details include `{ field: "age", message: "Expected number" }`

#### Scenario: Async validation with refinements

- GIVEN a schema with `.refine(async (data) => checkUnique(data.email))`
- WHEN `validateAsync(schema, { email: "test@example.com" })` is called
- THEN the async refinement is executed
- AND the result is returned or `ValidationError` is thrown

#### Scenario: Array validation with partial failures

- GIVEN a schema `z.string().email()` and data `["a@b.com", "invalid", "c@d.com"]`
- WHEN `validateArray(schema, data)` is called
- THEN it throws `ValidationArrayError`
- AND the error identifies index 1 as the failing item

#### Scenario: Array size limit enforcement

- GIVEN `CENF_VALIDATION_MAX_ARRAY=100` and an array of 101 items
- WHEN `validateArray(schema, data)` is called
- THEN it throws `ValidationError` with message about max array size
- AND no individual item validation is attempted
