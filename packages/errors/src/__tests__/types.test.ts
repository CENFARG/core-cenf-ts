import { describe, it, expect } from 'vitest';
import { ERROR_HANDLING_TYPES_VERSION } from '../types.js';

describe('ErrorHandling types', () => {
  it('exports types version constant', () => {
    expect(ERROR_HANDLING_TYPES_VERSION).toBe('0.1.0');
  });

  it('version is a string', () => {
    expect(typeof ERROR_HANDLING_TYPES_VERSION).toBe('string');
  });
});
