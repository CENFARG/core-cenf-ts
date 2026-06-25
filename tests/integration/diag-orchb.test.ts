import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { AggregatedHealthCheckAdapter } from '../../src/managers/health/adapters/aggregated.adapter.js';
import { MemoryEventBusAdapter } from '../../src/managers/event-bus/adapters/memory.adapter.js';
import { NativeJsonSerializer } from '../../src/managers/json-serializer/adapters/native.adapter.js';

describe('Incremental orch-b test', () => {
  let bootstrap: StandardBootstrapAdapter;
  let health: AggregatedHealthCheckAdapter;
  let eventBus: MemoryEventBusAdapter;
  let jsonSerializer: NativeJsonSerializer;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();
    health = new AggregatedHealthCheckAdapter();
    eventBus = new MemoryEventBusAdapter();
    jsonSerializer = new NativeJsonSerializer();

    bootstrap.register(eventBus, { priority: 15, name: 'eventBus' });
    bootstrap.register(jsonSerializer, { priority: 17, name: 'jsonSerializer' });
    bootstrap.register(health, { priority: 18, name: 'health' });
    bootstrap.register(bootstrap, { priority: 19, name: 'bootstrap' });

    health.register(eventBus, 'eventBus');
    health.register(jsonSerializer, 'jsonSerializer');

    await bootstrap.start();
  });

  afterAll(async () => {
    await bootstrap.stop();
  });

  it('bootstrap reports healthy', async () => {
    const h = await bootstrap.health();
    expect(h.status).toBe('healthy');
  });
});
