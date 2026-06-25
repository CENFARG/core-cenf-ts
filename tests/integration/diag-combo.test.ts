import { describe, it, expect } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { AggregatedHealthCheckAdapter } from '../../src/managers/health/adapters/aggregated.adapter.js';
import { MemoryEventBusAdapter } from '../../src/managers/event-bus/adapters/memory.adapter.js';
import { NativeJsonSerializer } from '../../src/managers/json-serializer/adapters/native.adapter.js';

describe('Combined import test', () => {
  it('can instantiate all', () => {
    const b = new StandardBootstrapAdapter();
    const h = new AggregatedHealthCheckAdapter();
    const e = new MemoryEventBusAdapter();
    const j = new NativeJsonSerializer();
    expect(b).toBeDefined();
    expect(h).toBeDefined();
    expect(e).toBeDefined();
    expect(j).toBeDefined();
  });
});
