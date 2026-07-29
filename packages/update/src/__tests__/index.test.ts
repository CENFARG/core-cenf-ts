/**
 * Barrel export verification tests for @cenf/update.
 */

import { describe, it, expect } from 'vitest';

describe('@cenf/update barrel exports', () => {
  it('exports types module', async () => {
    const mod = await import('../types.js');
    expect(mod.Channel).toBeDefined();
    expect(mod.UPDATE_TYPES_VERSION).toBe('0.1.0');
  });

  it('exports port module', async () => {
    const mod = await import('../ports.js');
    expect(mod.UPDATE_PORT_VERSION).toBe('0.1.0');
  });

  it('exports crypto helpers', async () => {
    const mod = await import('../helpers/crypto.js');
    expect(mod.computeShasum).toBeTypeOf('function');
    expect(mod.verifySignature).toBeTypeOf('function');
  });

  it('exports InMemoryUpdateAdapter', async () => {
    const mod = await import('../adapters/in-memory.adapter.js');
    expect(mod.InMemoryUpdateAdapter).toBeDefined();
  });

  it('exports HttpUpdateAdapter', async () => {
    const mod = await import('../adapters/http.adapter.js');
    expect(mod.HttpUpdateAdapter).toBeDefined();
  });

  it('exports PipUpdateAdapter', async () => {
    const mod = await import('../adapters/pip.adapter.js');
    expect(mod.PipUpdateAdapter).toBeDefined();
  });

  it('exports WebUpdateAdapter', async () => {
    const mod = await import('../adapters/web.adapter.js');
    expect(mod.WebUpdateAdapter).toBeDefined();
  });

  it('exports GitHubReleaseAdapter', async () => {
    const mod = await import('../adapters/github-release.adapter.js');
    expect(mod.GitHubReleaseAdapter).toBeDefined();
  });

  it('exports AndroidUpdateAdapter', async () => {
    const mod = await import('../adapters/android.adapter.js');
    expect(mod.AndroidUpdateAdapter).toBeDefined();
  });
});
