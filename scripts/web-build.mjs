// Browser build for press/itch (PLT-0023), from the same code with platform feature flags:
//   node scripts/web-build.mjs --edition=demo|full [--out=dist-web-demo] [--watermark]
import { spawnSync } from 'node:child_process';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const edition = opt.edition === 'full' ? 'full' : 'demo';
const env = { ...process.env, VITE_EDITION: edition, VITE_PLATFORM: 'web', SS_OUT_DIR: opt.out ?? 'dist', ...(opt.watermark ? { VITE_WATERMARK: '1' } : {}) };
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const args of [['tsc', '--noEmit'], ['vite', 'build']]) {
  const r = spawnSync(npx, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
