// Vitest config for mutation testing (stryker.config.mjs): only the fast unit project.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/characterisation/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
