// Conventional commits (QAT-0007): `type(scope): subject`, so the PLT changelog / patch-notes
// generator always receives typed commits. Enforced by the commit-msg hook and the PR check.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'build', 'ci', 'chore', 'style', 'revert', 'content', 'art', 'audio', 'loc'],
    ],
    // Roadmap commits cite task ids and file lists; allow long bodies and footers.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
  },
};
