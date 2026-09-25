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
  { ignores: ['dist/**', 'dist-*/**', 'node_modules/**', 'reports/**', 'coverage/**', 'test-results/**', '.stryker-tmp/**', 'docs/**'] },
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
