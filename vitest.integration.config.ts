/**
 * Vitest configuration for integration tests only.
 *
 * Used via: npx vitest run --config vitest.integration.config.ts
 *
 * Separated from the main config to:
 * - Keep unit test runs fast (no integration file loading)
 * - Disable coverage for integration tests (reduces memory)
 * - Use fork pool isolation per file
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 10_000,
    coverage: {
      enabled: false,
    },
  },
});
