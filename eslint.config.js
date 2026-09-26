// ESLint flat config (QAT-0004). Lints the whole TypeScript codebase with rules the existing
// code already satisfies, plus test-code rules for tests/**. Run with `npm run lint`.
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import tseslint from 'typescript-eslint';

/** A `.skip` must link the issue that tracks re-enabling it (a URL or `#123` in a comment on or above the call). */
const skipNeedsIssue = {
  meta: { type: 'problem', docs: { description: 'Disallow .skip / .todo without an issue link' }, schema: [] },
  create(context) {
    const src = context.sourceCode;
    const ISSUE = /(https?:\/\/\S+\/issues\/\d+|#\d+)/;
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;
        if (!['skip', 'todo'].includes(callee.property.name)) return;
        const root = callee.object.type === 'Identifier' ? callee.object.name : null;
        if (!root || !['it', 'test', 'describe', 'bench', 'suite'].includes(root)) return;
        const comments = [...src.getCommentsBefore(node), ...src.getCommentsInside(node)];
        const line = node.loc.start.line;
        const nearby = src.getAllComments().filter((c) => c.loc.end.line === line - 1 || c.loc.start.line === line);
        if ([...comments, ...nearby].some((c) => ISSUE.test(c.value))) return;
        context.report({ node, message: `${root}.${callee.property.name}() needs an issue link in a comment (tests/QUARANTINE.md).` });
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-*/**',
      'node_modules/**',
      'reports/**',
      'coverage/**',
      'test-results/**',
      '.stryker-tmp/**',
      'docs/**',
      'scripts/.*',
      'public/vendor/**',
      'art-src/.cache/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      // The codebase relies on TypeScript for these; the compiler already enforces unused symbols.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
      // Style-only; existing engine code predates the lint config, so it warns there (errors in QA-owned code below).
      'prefer-const': 'warn',
      // Locale-sensitive casing breaks under tr-TR (dotless i) — QAT-0113.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^toLocale(Upper|Lower)Case$/][arguments.length=0]',
          message: 'Pass an explicit locale to toLocaleUpperCase/toLocaleLowerCase (Turkish dotted/dotless i); use toUpperCase for ids and keys.',
        },
      ],
    },
  },
  {
    // Game code other workstreams are writing in parallel: every recommended rule reports as a
    // warning (visible in CI, never blocking); the locale rule stays an error everywhere.
    files: ['src/**/*.ts', 'scripts/**/*.{js,mjs,ts}'],
    ignores: ['src/debug/**', 'src/telemetry/**', 'scripts/qa/**', 'scripts/smoke.mjs', 'scripts/shot.mjs'],
    rules: Object.fromEntries(
      Object.entries(
        // Effective level of each recommended rule (later configs override earlier ones, e.g. no-undef off for TS).
        Object.assign({}, ...[js.configs.recommended, ...tseslint.configs.recommended].map((c) => c.rules ?? {})),
      )
        .filter(([r, level]) => r !== 'no-restricted-syntax' && (Array.isArray(level) ? level[0] : level) !== 'off')
        .map(([r]) => [r, 'warn']),
    ),
  },
  {
    // Determinism (ENG-0252): the simulation and content must replay bit-for-bit from an input log,
    // so no wall clock, no unseeded randomness and no DOM inside them (persistence goes through
    // localStorage wrappers only).
    files: ['src/surgery/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Unseeded randomness breaks replays: use the operation Rng (op.rng).' },
        { object: 'Date', property: 'now', message: 'Wall-clock time breaks replays: use op.elapsed.' },
        { object: 'performance', property: 'now', message: 'Wall-clock time breaks replays: use op.elapsed.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'No DOM in the simulation (ENG-0252).' },
        { name: 'document', message: 'No DOM in the simulation (ENG-0252).' },
        { name: 'navigator', message: 'No DOM in the simulation (ENG-0252).' },
        { name: 'requestAnimationFrame', message: 'The simulation is stepped by op.update, never by frames.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^toLocale(Upper|Lower)Case$/][arguments.length=0]',
          message: 'Pass an explicit locale to toLocaleUpperCase/toLocaleLowerCase (Turkish dotted/dotless i); use toUpperCase for ids and keys.',
        },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Wall-clock time breaks replays: use op.elapsed.' },
      ],
    },
  },
  {
    // GAM-0012: entities expose state only; how they look lives in src/render/surgery.
    files: ['src/surgery/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render/*', '**/render/**', '**/art/*', '**/art/**'],
              message: 'The simulation draws nothing (GAM-0012): put drawing in src/render/surgery.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        Buffer: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        requestAnimationFrame: 'readonly',
        navigator: 'readonly',
      },
    },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.{js,mjs,ts}', 'src/debug/**/*.ts', 'src/telemetry/**/*.ts'],
    rules: { 'prefer-const': 'error' },
  },
  {
    files: ['tests/**/*.ts'],
    plugins: { vitest, qa: { rules: { 'skip-needs-issue': skipNeedsIssue } } },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
      'vitest/no-standalone-expect': ['error', { additionalTestBlockFunctions: ['it.runIf', 'it.skipIf', 'test.runIf'] }],
      'vitest/no-commented-out-tests': 'error',
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*', 'assert*', 'fc.assert', 'check*'] }],
      'qa/skip-needs-issue': 'error',
    },
  },
);
