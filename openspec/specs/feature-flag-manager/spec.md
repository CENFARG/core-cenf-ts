# FeatureFlagManager Specification

## Purpose

Manages runtime feature toggles with YAML file source (MVP) and percentage-based rollout support. Enables gradual feature releases without code deploys.

## Port Interface

```typescript
interface IFeatureFlagManager {
  isEnabled(flag: string, context?: FlagContext): Promise<boolean>;
  getVariant(flag: string, context?: FlagContext): Promise<string>;
  getAll(context?: FlagContext): Promise<Record<string, boolean>>;
  refresh(): Promise<void>;
}

interface FlagContext {
  userId?: string;
  groupId?: string;
  [key: string]: unknown;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `YamlFeatureFlagAdapter` | Reads flags from YAML config file |
| `MemoryFeatureFlagAdapter` | In-memory flag map for testing |

## Error Types

- `FeatureFlagNotFoundError` — Requested flag does not exist
- `FeatureFlagParseError` — YAML file is malformed

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_FLAGS_SOURCE` | `yaml\|memory\|unleash` | `yaml` | Flag backend |
| `CENF_FLAGS_FILE_PATH` | `string` | `./config/flags.yaml` | YAML flags file |
| `CENF_FLAGS_DEFAULT` | `boolean` | `false` | Default when flag missing |

## Lifecycle

- `start()`: Loads flags from YAML file, validates structure
- `stop()`: No-op
- `health()`: Returns `{ status: 'healthy', details: { source, flagsLoaded } }`

## Testing Strategy

- **Unit**: `MemoryFeatureFlagAdapter` — enable/disable, percentage rollout
- **Integration**: `YamlFeatureFlagAdapter` with temp YAML files
- **Edge cases**: Missing flags, malformed YAML, percentage edge cases (0%, 100%)

## Requirements

### Requirement: Flag Evaluation with Context

The system MUST evaluate feature flags by name, optionally using context (userId, groupId) for percentage rollouts. Missing flags MUST return the configured default.

#### Scenario: Simple boolean flag

- GIVEN flags YAML contains `newDashboard: true`
- WHEN `await flags.isEnabled("newDashboard")` is called
- THEN it returns `true`

#### Scenario: Percentage rollout with userId

- GIVEN flag `betaFeature` has `{ enabled: true, rollout: 50 }`
- WHEN `await flags.isEnabled("betaFeature", { userId: "user-123" })` is called
- THEN the result is deterministic for the same userId
- AND approximately 50% of unique userIds get `true`

#### Scenario: Missing flag returns default

- GIVEN flag `nonexistent` is not defined
- WHEN `await flags.isEnabled("nonexistent")` is called
- THEN it returns `false` (CENF_FLAGS_DEFAULT)
- AND no error is thrown

#### Scenario: Variant selection for A/B testing

- GIVEN flag `checkoutFlow` has variants `{ control: 70, new: 30 }`
- WHEN `await flags.getVariant("checkoutFlow", { userId: "user-1" })` is called
- THEN it returns either `"control"` or `"new"`
- AND the distribution matches the configured percentages

#### Scenario: Bulk flag evaluation

- GIVEN flags `flagA: true`, `flagB: false`, `flagC: true` exist
- WHEN `await flags.getAll()` is called
- THEN it returns `{ flagA: true, flagB: false, flagC: true }`
- AND flags not in context are excluded
