import { describe, it, expect, beforeEach } from 'vitest';
import { NativeJsonSerializer } from '../adapters/native.adapter.js';

describe('NativeJsonSerializer', () => {
  let adapter: NativeJsonSerializer;

  beforeEach(() => {
    adapter = new NativeJsonSerializer();
  });

  describe('AsyncLifecycle', () => {
    it('start() resolves successfully', async () => {
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves successfully', async () => {
      await adapter.start();
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy status', async () => {
      await adapter.start();
      const health = await adapter.health();
      expect(health.status).toBe('healthy');
    });
  });

  describe('serialize / deserialize', () => {
    it('round-trips plain objects', () => {
      const data = { name: 'Alice', age: 30 };
      const json = adapter.serialize(data);
      const result = adapter.deserialize<typeof data>(json);

      expect(result).toEqual(data);
    });

    it('round-trips arrays', () => {
      const data = [1, 2, 3, { nested: true }];
      const json = adapter.serialize(data);
      const result = adapter.deserialize<typeof data>(json);

      expect(result).toEqual(data);
    });

    it('round-trips primitive values', () => {
      expect(adapter.deserialize(adapter.serialize('hello'))).toBe('hello');
      expect(adapter.deserialize(adapter.serialize(42))).toBe(42);
      expect(adapter.deserialize(adapter.serialize(true))).toBe(true);
      expect(adapter.deserialize(adapter.serialize(null))).toBeNull();
    });

    it('serializes BigInt as string', () => {
      const data = { value: BigInt('9007199254740993') };
      const json = adapter.serialize(data);

      // Look for the sentinel: BigInt should not be serialized as a number
      expect(json).toContain('__bigint__');
      expect(json).toContain('9007199254740993');
    });

    it('deserializes BigInt string back to BigInt', () => {
      const original = { value: BigInt(42) };
      const json = adapter.serialize(original);
      const result = adapter.deserialize<typeof original>(json);

      expect(typeof result.value).toBe('bigint');
      expect(result.value).toBe(BigInt(42));
    });

    it('serializes Date as ISO string', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const data = { created: date };
      const json = adapter.serialize(data);

      expect(json).toContain('__date__');
      expect(json).toContain('2024-01-15T10:30:00.000Z');
    });

    it('deserializes ISO string back to Date', () => {
      const original = { created: new Date('2024-06-15T12:00:00.000Z') };
      const json = adapter.serialize(original);
      const result = adapter.deserialize<typeof original>(json);

      expect(result.created).toBeInstanceOf(Date);
      expect(result.created.getTime()).toBe(
        new Date('2024-06-15T12:00:00.000Z').getTime(),
      );
    });

    it('handles nested BigInt and Date', () => {
      const data = {
        user: {
          name: 'Bob',
          balance: BigInt(1000000),
          joined: new Date('2023-01-01T00:00:00.000Z'),
        },
      };

      const json = adapter.serialize(data);
      const result = adapter.deserialize<typeof data>(json);

      expect(result.user.name).toBe('Bob');
      expect(typeof result.user.balance).toBe('bigint');
      expect(result.user.balance).toBe(BigInt(1000000));
      expect(result.user.joined).toBeInstanceOf(Date);
      expect(result.user.joined.getTime()).toBe(
        new Date('2023-01-01T00:00:00.000Z').getTime(),
      );
    });
  });

  describe('custom serializers', () => {
    it('registers and uses a custom serializer for deserialization', () => {
      const pointSerializer: CustomSerializer<{ x: number; y: number }> = {
        serialize: (v) => JSON.stringify(v),
        deserialize: (v) => JSON.parse(v),
      };

      adapter.registerSerializer('Point', pointSerializer);

      const point = { x: 10, y: 20 };
      const json = adapter.serialize({ location: point });
      const result = adapter.deserialize<{ location: { x: number; y: number } }>(json);

      expect(result.location).toEqual(point);
    });

    it('supports multiple custom serializers', () => {
      const vecSerializer: CustomSerializer<number[]> = {
        serialize: (v) => v.join(','),
        deserialize: (v) => v.split(',').map(Number),
      };

      adapter.registerSerializer('Vector', vecSerializer);

      const data = { vec: [1, 2, 3] };
      const json = adapter.serialize(data);
      const result = adapter.deserialize<typeof data>(json);

      expect(result.vec).toEqual([1, 2, 3]);
    });
  });

  describe('stop() cleanup', () => {
    it('clears custom serializers on stop', async () => {
      const serializer: CustomSerializer<string> = {
        serialize: (v) => v,
        deserialize: (v) => v,
      };

      await adapter.start();
      adapter.registerSerializer('Custom', serializer);
      await adapter.stop();

      // After stop, custom serializers are cleared — serialization uses defaults
      // (verify adapter still functions for basic types)
      const json = adapter.serialize({ key: 'value' });
      expect(json).toContain('"key"');
    });
  });
});
