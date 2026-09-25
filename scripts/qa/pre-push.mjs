// pre-push hook (QAT-0006): type-check, then run the tests related to the files this push changes.
// Installed with `npm run hooks:install` (simple-git-hooks). Skip once with `git push --no-verify`.
import { execFileSync, spawnSync } from 'node:child_process';

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

function changedFiles() {
  const tryDiff = (range) => {
    try {
      return execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n')
        .filter(Boolean);
    } catch {
      return null;
    }
  };
  // Commits not yet on the upstream; fall back to the last commit for a new branch.
  return tryDiff('@{push}..HEAD') ?? tryDiff('origin/main...HEAD') ?? tryDiff('HEAD~1..HEAD') ?? [];
}

run('npx', ['tsc', '--noEmit']);
const files = changedFiles().filter((f) => /\.(ts|mjs|js)$/.test(f) && (f.startsWith('src/') || f.startsWith('tests/')));
if (files.length === 0) {
  console.log('pre-push: no source or test changes — skipping vitest related');
} else {
  run('npx', ['vitest', 'related', '--run', '--passWithNoTests', ...files]);
}
