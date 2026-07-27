/**
 * Tests for ports.ts — port interface existence and version constant.
 *
 * @module @cenf/state-machine/__tests__/ports.test
 */

import { describe, expect, it } from 'vitest';
import { STATE_MACHINE_PORT_VERSION } from '../ports.js';

describe('ports', () => {
  it('exports STATE_MACHINE_PORT_VERSION', () => {
    expect(STATE_MACHINE_PORT_VERSION).toBe('0.1.0');
  });
});
