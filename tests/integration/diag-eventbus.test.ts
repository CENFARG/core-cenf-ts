import { describe, it, expect } from 'vitest';
import { MemoryEventBusAdapter } from '../../src/managers/event-bus/adapters/memory.adapter.js';

describe('EventBus Adapter — import test', () => {
  it('can instantiate event bus', () => {
    const bus = new MemoryEventBusAdapter();
    expect(bus).toBeDefined();
  });

  it('can publish and subscribe', async () => {
    const bus = new MemoryEventBusAdapter();
    const received: string[] = [];
    await bus.subscribe<string>('test', async (data) => {
      received.push(data);
    });
    await bus.publish('test', 'hello');
    expect(received).toEqual(['hello']);
  });
});
