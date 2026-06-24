import { describe, it, expect } from 'vitest';
import { SECRET_PORT_VERSION } from '../ports.js';

describe('ISecretManager port', () => {
  it('exports port version constant', () => {
    expect(SECRET_PORT_VERSION).toBe('0.1.0');
  });

  it('version is a string', () => {
    expect(typeof SECRET_PORT_VERSION).toBe('string');
  });
});
