import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/diag-eventbus.test.ts'],
    testTimeout: 30_000,
    coverage: { enabled: false },
  },
});
