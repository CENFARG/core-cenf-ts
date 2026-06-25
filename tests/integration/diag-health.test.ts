import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { AggregatedHealthCheckAdapter } from '../../src/managers/health/adapters/aggregated.adapter.js';

describe('Health adapter + bootstrap test', () => {
  let bootstrap: StandardBootstrapAdapter;
  let health: AggregatedHealthCheckAdapter;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();
    health = new AggregatedHealthCheckAdapter();

    bootstrap.register(health, { priority: 18, name: 'health' });
    bootstrap.register(bootstrap, { priority: 19, name: 'bootstrap' });

    await bootstrap.start();
  });

  afterAll(async () => {
    await bootstrap.stop();
  });

  it('bootstrap reports healthy', async () => {
    const h = await bootstrap.health();
    expect(h.status).toBe('healthy');
  });

  it('health check returns ok', async () => {
    const report = await health.check();
    expect(report.status).toBe('healthy');
  });
});
