import { describe, it, expect } from 'vitest';
import { VALIDATION_PORT_VERSION } from '../ports.js';

describe('IValidationManager port', () => {
  it('exports port version constant', () => {
    expect(VALIDATION_PORT_VERSION).toBe('0.1.0');
  });

  it('version is a string', () => {
    expect(typeof VALIDATION_PORT_VERSION).toBe('string');
  });
});
