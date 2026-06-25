import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { MemoryEventBusAdapter } from '../../src/managers/event-bus/adapters/memory.adapter.js';
import { NativeJsonSerializer } from '../../src/managers/json-serializer/adapters/native.adapter.js';

describe('Orch-b without health aggregator', () => {
  let bootstrap: StandardBootstrapAdapter;
  let eventBus: MemoryEventBusAdapter;
  let jsonSerializer: NativeJsonSerializer;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();
    eventBus = new MemoryEventBusAdapter();
    jsonSerializer = new NativeJsonSerializer();

    bootstrap.register(eventBus, { priority: 15, name: 'eventBus' });
    bootstrap.register(jsonSerializer, { priority: 17, name: 'jsonSerializer' });

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
