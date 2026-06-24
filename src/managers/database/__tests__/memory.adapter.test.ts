import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryDatabaseAdapter } from '../adapters/memory.adapter.js';
import type { GenericRepository } from '../ports.js';

interface TestUser {
  id: number;
  name: string;
  email: string;
}

describe('MemoryDatabaseAdapter', () => {
  let db: MemoryDatabaseAdapter;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await db.start();
  });

  afterEach(async () => {
    await db.stop();
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  it('start() initializes with empty tables', async () => {
    const h = await db.health();
    expect(h.status).toBe('healthy');
    expect(h.details).toHaveProperty('tableCount');
  });

  it('health() returns memory adapter details', async () => {
    const h = await db.health();
    expect(h.status).toBe('healthy');
    expect(h.details.adapter).toBe('memory');
  });

  it('stop() clears all data', async () => {
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'a', 'a@b.com')",
    );
    await db.stop();
    const h = await db.health();
    expect(h.details.tableCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // execute() — INSERT / UPDATE / DELETE
  // -----------------------------------------------------------------------

  it('execute() INSERT returns affected rows = 1', async () => {
    const affected = await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@test.com')",
    );
    expect(affected).toBe(1);
  });

  it('execute() DELETE returns affected rows', async () => {
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@test.com')",
    );
    const affected = await db.execute("DELETE FROM users WHERE id = '1'");
    expect(affected).toBe(1);
  });

  it('execute() DELETE nonexistent returns 0', async () => {
    const affected = await db.execute("DELETE FROM users WHERE id = '99'");
    expect(affected).toBe(0);
  });

  it('execute() UPDATE returns affected rows', async () => {
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@test.com')",
    );
    const affected = await db.execute(
      "UPDATE users SET name = 'Bob' WHERE id = '1'",
    );
    expect(affected).toBe(1);
  });

  // -----------------------------------------------------------------------
  // query() — SELECT
  // -----------------------------------------------------------------------

  it('query() returns inserted rows', async () => {
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@test.com')",
    );
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('2', 'Bob', 'bob@test.com')",
    );

    const result = await db.query<TestUser>('SELECT * FROM users');
    expect(result.rows).toHaveLength(2);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[1].name).toBe('Bob');
  });

  it('query() returns empty result for unknown table', async () => {
    const result = await db.query<TestUser>('SELECT * FROM nonexistent');
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it('query() with WHERE clause filters rows', async () => {
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@test.com')",
    );
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('2', 'Bob', 'bob@test.com')",
    );

    const result = await db.query<TestUser>(
      "SELECT * FROM users WHERE id = '1'",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('query() returns field metadata', async () => {
    await db.execute(
      "INSERT INTO users (id, name, email) VALUES ('1', 'Alice', 'alice@test.com')",
    );

    const result = await db.query<TestUser>('SELECT * FROM users');
    expect(result.fields).toHaveLength(3);
    expect(result.fields[0].name).toBe('id');
    expect(result.fields[1].name).toBe('name');
    expect(result.fields[2].name).toBe('email');
  });

  // -----------------------------------------------------------------------
  // transaction() — commit and rollback
  // -----------------------------------------------------------------------

  it('transaction() commits on success', async () => {
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        "INSERT INTO users (id, name, email) VALUES ('1', 'Tx', 'tx@test.com')",
      );
      return 'committed';
    });

    expect(result).toBe('committed');

    const rows = await db.query<TestUser>('SELECT * FROM users');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].name).toBe('Tx');
  });

  it('transaction() rolls back on error', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          "INSERT INTO users (id, name, email) VALUES ('1', 'Rollback', 'rb@test.com')",
        );
        throw new Error('tx-abort');
      }),
    ).rejects.toThrow('tx-abort');

    // Data should NOT be committed
    const rows = await db.query<TestUser>('SELECT * FROM users');
    expect(rows.rows).toHaveLength(0);
  });

  it('transaction() propagates error', async () => {
    await expect(
      db.transaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  // -----------------------------------------------------------------------
  // GenericRepository<T>
  // -----------------------------------------------------------------------

  describe('GenericRepository', () => {
    let repo: GenericRepository<TestUser>;

    beforeEach(async () => {
      repo = db.getRepository<TestUser>('users');
    });

    it('create() inserts and returns entity with generated id', async () => {
      const user = await repo.create({
        name: 'Alice',
        email: 'alice@test.com',
      });
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Alice');
      expect(user.email).toBe('alice@test.com');
    });

    it('findById() returns entity', async () => {
      const created = await repo.create({ name: 'Bob', email: 'bob@test.com' });
      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Bob');
    });

    it('findById() returns null for missing id', async () => {
      const found = await repo.findById(999);
      expect(found).toBeNull();
    });

    it('findAll() returns all entities', async () => {
      await repo.create({ name: 'A', email: 'a@b.com' });
      await repo.create({ name: 'B', email: 'c@d.com' });

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
      expect(all[0].name).toBe('A');
      expect(all[1].name).toBe('B');
    });

    it('findAll() returns empty array for empty table', async () => {
      const all = await repo.findAll();
      expect(all).toEqual([]);
    });

    it('update() modifies entity and returns it', async () => {
      const created = await repo.create({
        name: 'Old',
        email: 'old@test.com',
      });
      const updated = await repo.update(created.id, { name: 'New' });
      expect(updated.name).toBe('New');
      expect(updated.email).toBe('old@test.com'); // unchanged

      const found = await repo.findById(created.id);
      expect(found!.name).toBe('New');
    });

    it('update() throws for nonexistent id', async () => {
      await expect(
        repo.update(999, { name: 'Ghost' }),
      ).rejects.toThrow(/not found/);
    });

    it('delete() removes entity', async () => {
      const created = await repo.create({
        name: 'Del',
        email: 'del@test.com',
      });
      await repo.delete(created.id);
      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('delete() is idempotent for nonexistent id', async () => {
      await expect(repo.delete(999)).resolves.toBeUndefined();
    });

    it('repository isolates tables', async () => {
      const userRepo = db.getRepository<{ id: number; name: string }>('users');
      const postRepo = db.getRepository<{ id: number; title: string }>('posts');

      await userRepo.create({ name: 'User1' });
      await postRepo.create({ title: 'Post1' });

      const users = await userRepo.findAll();
      const posts = await postRepo.findAll();

      expect(users).toHaveLength(1);
      expect(posts).toHaveLength(1);
      expect(users[0].name).toBe('User1');
      expect((posts[0] as { title: string }).title).toBe('Post1');
    });
  });
});
