import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.test.ts', 'examples/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/*.port.ts'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
    retry: 0,
    allowOnly: false,
  },
});
