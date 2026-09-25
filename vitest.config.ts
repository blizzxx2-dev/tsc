import { defineConfig } from 'vitest/config';

/**
 * Test projects (see CONTRIBUTING.md):
 * - `unit` — fast headless rule tests, characterisation snapshots and data checks for src/surgery,
 *   src/core and src/content (node environment);
 * - `sim`  — bot playthroughs, balance guard-rails and fuzzers (60 s timeout); `vitest bench` files too;
 * - `e2e`  — Playwright against the built QA preview (`npm run build:qa`). Opt-in because it needs a
 *   build and a browser: `npm run test:e2e` (or any `--project e2e` run) enables it.
 */
const CI = !!process.env.CI;
const wantE2E = process.env.VITEST_E2E === '1' || process.argv.some((a) => a === 'e2e' || a === '--project=e2e');

export default defineConfig({
  test: {
    reporters: CI ? ['default', 'junit', ['./tests/reporters/qa-summary.ts', {}]] : ['default'],
    outputFile: { junit: process.env.JUNIT_FILE ?? 'reports/junit.xml' },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/telemetry/**/*.test.ts', 'tests/characterisation/**/*.test.ts', 'tests/gesture.test.ts'],
          testTimeout: 10_000,
        },
      },
      {
        test: {
          name: 'sim',
          environment: 'node',
          include: ['tests/sim/**/*.test.ts', 'tests/operations.test.ts', 'tests/balance.test.ts'],
          testTimeout: 60_000,
          globalSetup: ['tests/helpers/sim-report-setup.ts'],
          benchmark: { include: ['tests/bench/**/*.bench.ts'] },
        },
      },
      ...(wantE2E
        ? [
            {
              test: {
                name: 'e2e',
                environment: 'node',
                include: ['tests/e2e/**/*.e2e.ts'],
                globalSetup: ['tests/e2e/global-setup.ts'],
                testTimeout: 300_000,
                hookTimeout: 120_000,
                fileParallelism: false,
                // Flaky-test policy (tests/QUARANTINE.md): two retries in CI; a pass-on-retry is reported as flaky.
                retry: CI ? 2 : 0,
              },
            },
          ]
        : []),
    ],
  },
});
