import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
    // Script- and replay-driven tests share CPU with the offline audio renders; the default 5 s is too tight under load.
    testTimeout: 30_000,
  },
});
