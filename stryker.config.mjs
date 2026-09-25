// Mutation testing (QAT-0052) on the scoring core. Run: npm run test:mutation
// Baseline scores and the demo-RC target (≥ 75 % on operation.ts) are tracked in
// docs/qa/mutation-testing.md; surviving mutants in scoring code are filed as test gaps.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts', related: false },
  // Only the fast unit tests (rules, characterisation, matrix) — the sim project re-runs bots per mutant.
  mutate: [process.env.MUTATE ?? 'src/surgery/operation.ts'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 85, low: 75, break: null },
  concurrency: Number(process.env.STRYKER_CONCURRENCY ?? 2),
  timeoutMS: 20_000,
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
