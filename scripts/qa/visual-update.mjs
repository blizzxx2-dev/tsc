// Regenerate screenshot baselines — only ever inside the pinned Playwright Docker image (QAT-0066),
// so every suite's baselines come from one rendering environment. CI rejects baselines whose
// tests/e2e/visual/__baselines__/meta.json was not written by this path.
// Usage: npm run visual:update            (needs Docker)
//        npm run visual:update -- --in-container   (what the Docker run / CI workflow executes)
import { spawnSync } from 'node:child_process';

const IMAGE = 'mcr.microsoft.com/playwright:v1.55.1-noble';
const inContainer = process.argv.includes('--in-container');

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (inContainer) {
  if (!process.env.PLAYWRIGHT_DOCKER && !process.env.QA_BASELINE_ENV) {
    console.error('visual:update --in-container must run inside the Playwright image (see scripts/qa/visual-update.mjs).');
    process.exit(1);
  }
  run('npm', ['run', 'build:qa']);
  run('npx', ['vitest', 'run', '--project', 'visual'], { VISUAL_UPDATE: '1', QA_BASELINE_ENV: 'playwright-docker' });
} else {
  const cwd = process.cwd();
  run('docker', [
    'run',
    '--rm',
    '--ipc=host',
    '-v',
    `${cwd}:/work`,
    // A named volume shadows node_modules so the host's (possibly different-OS) install is untouched.
    '-v',
    'suture-steel-visual-node-modules:/work/node_modules',
    '-w',
    '/work',
    '-e',
    'PLAYWRIGHT_DOCKER=1',
    '-e',
    'QA_BASELINE_ENV=playwright-docker',
    IMAGE,
    'bash',
    '-lc',
    'npm ci --no-audit --no-fund && node scripts/qa/visual-update.mjs --in-container',
  ]);
  console.log('Baselines regenerated in', IMAGE, '— review the PNG diffs before committing.');
}
