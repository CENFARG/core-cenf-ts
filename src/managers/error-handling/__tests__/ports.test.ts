import { describe, it, expect } from 'vitest';
import { ERROR_HANDLING_PORT_VERSION } from '../ports.js';

describe('IErrorHandlingManager port', () => {
  it('exports port version constant', () => {
    expect(ERROR_HANDLING_PORT_VERSION).toBe('0.1.0');
  });

  it('version is a string', () => {
    expect(typeof ERROR_HANDLING_PORT_VERSION).toBe('string');
  });
});
