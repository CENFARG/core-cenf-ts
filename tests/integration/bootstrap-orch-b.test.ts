/**
 * Integration test: BootstrapOrchestrator with 4 ORCHESTRATION managers (Part B).
 *
 * Managers under test:
 * - EventBus (MemoryEventBusAdapter)
 * - JsonSerializer (NativeJsonSerializer)
 * - Health (AggregatedHealthCheckAdapter)
 * - Bootstrap (StandardBootstrapAdapter)
 *
 * All adapters are in-memory — no external dependencies required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { AggregatedHealthCheckAdapter } from '../../src/managers/health/adapters/aggregated.adapter.js';
import { MemoryEventBusAdapter } from '../../src/managers/event-bus/adapters/memory.adapter.js';
import { NativeJsonSerializer } from '../../src/managers/json-serializer/adapters/native.adapter.js';

describe('BootstrapOrchestrator — Orchestration Managers B (4)', () => {
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

    // Register with health aggregator
    health.register(eventBus, 'eventBus');
    health.register(jsonSerializer, 'jsonSerializer');

    await bootstrap.start();
  });

  afterAll(async () => {
    await bootstrap.stop();
  });

  it('bootstrap reports healthy with 3 managers', async () => {
    const h = await bootstrap.health();
    expect(h.status).toBe('healthy');
    expect(h.details!.registeredManagers).toHaveLength(3);
  });

  // Health aggregation
  it('aggregated health reports all registered managers', async () => {
    const report = await health.check();
    expect(report.status).toBe('healthy');
    const names = Object.keys(report.components!);
    expect(names).toContain('eventBus');
    expect(names).toContain('jsonSerializer');
  });

  // EventBus
  it('eventBus.publish() / subscribe() round-trip', async () => {
    const received: unknown[] = [];
    await eventBus.subscribe<{ msg: string }>('test.topic', async (data) => {
      received.push(data);
    });
    await eventBus.publish('test.topic', { msg: 'hello-world' });
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]).toEqual({ msg: 'hello-world' });
  });

  it('eventBus.publish() to empty topic does not throw', async () => {
    await expect(eventBus.publish('empty.topic', { data: 1 })).resolves.toBeUndefined();
  });

  // JsonSerializer
  it('serialize + deserialize round-trip', () => {
    const obj = { name: 'test', count: 42, active: true };
    const serialized = jsonSerializer.serialize(obj);
    const deserialized = jsonSerializer.deserialize<typeof obj>(serialized);
    expect(deserialized).toEqual(obj);
  });

  it('serializer handles BigInt round-trip', () => {
    const withBigInt = { id: BigInt('9007199254740991'), label: 'big' };
    const serialized = jsonSerializer.serialize(withBigInt);
    const deserialized = jsonSerializer.deserialize<{ id: bigint; label: string }>(serialized);
    expect(typeof deserialized.id).toBe('bigint');
    expect(deserialized.id).toBe(BigInt('9007199254740991'));
  });

  it('serializer handles Date round-trip', () => {
    const date = new Date('2025-01-15T12:00:00Z');
    const withDate = { timestamp: date };
    const serialized = jsonSerializer.serialize(withDate);
    const deserialized = jsonSerializer.deserialize<{ timestamp: Date }>(serialized);
    expect(deserialized.timestamp).toBeInstanceOf(Date);
    expect(deserialized.timestamp.getTime()).toBe(date.getTime());
  });

  // Bootstrap lifecycle
  it('bootstrap start → health → stop → degraded', async () => {
    const isoBootstrap = new StandardBootstrapAdapter();
    const isoBus = new MemoryEventBusAdapter();
    isoBootstrap.register(isoBus, { priority: 15, name: 'eventBus' });
    await isoBootstrap.start();
    expect((await isoBootstrap.health()).status).toBe('healthy');
    await isoBootstrap.stop();
    expect((await isoBootstrap.health()).status).toBe('degraded');
  });

  // Health checks
  it('all managers report healthy', async () => {
    expect((await eventBus.health()).status).toBe('healthy');
    expect((await jsonSerializer.health()).status).toBe('healthy');
    expect((await health.health()).status).toBe('healthy');
  });
});
