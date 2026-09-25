// Desktop build orchestration (cross-platform — npm scripts cannot set env vars portably).
//   node scripts/desktop.mjs build  [--edition=demo|full] [--platform=desktop|none] [--release]
//   node scripts/desktop.mjs pack   [...same] → release/<edition>/win-unpacked (Steam depot input)
//   node scripts/desktop.mjs dev    [...same]                        → build, then run Electron from the checkout (--dev)
//   node scripts/desktop.mjs smoke  [...same]                        → run the packaged Windows build and verify boot
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [cmd = 'build', ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(
  rest
    .filter((a) => a.startsWith('--'))
    .map((a) => a.slice(2).split('='))
    .map(([k, v]) => [k, v ?? '1']),
);
const edition = opt.edition === 'full' ? 'full' : 'demo';
const platform = opt.platform === 'none' ? 'none' : 'desktop';
const env = {
  ...process.env,
  VITE_EDITION: edition,
  VITE_PLATFORM: platform,
  SS_RELEASE: opt.release ? '1' : (process.env.SS_RELEASE ?? ''),
  SS_SOURCEMAP: 'hidden',
};
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(bin, args, extraEnv = {}) {
  console.log(`> ${bin} ${args.join(' ')}`);
  const r = spawnSync(bin, args, { stdio: 'inherit', env: { ...env, ...extraEnv }, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function build() {
  run(npx, ['tsc', '--noEmit']);
  run(npx, ['tsc', '-p', 'desktop/tsconfig.json']);
  run(npx, ['vite', 'build']);
  run(process.execPath, ['scripts/build-desktop.mjs']);
  if (!existsSync('THIRD_PARTY_NOTICES.txt')) run(process.execPath, ['scripts/third-party-notices.mjs']);
}

// Windows is the only desktop target.
const osFlag = '--win';

switch (cmd) {
  case 'build':
    build();
    break;
  case 'pack':
    build();
    // Source maps stay in dist/ for symbol upload but are excluded from the package by the builder config.
    // Packaged builds must carry the full-quality 3D models (npm run art:models); skip with SS_ALLOW_NO_MODELS=1.
    if (!process.env.SS_ALLOW_NO_MODELS) run(process.execPath, ['scripts/art/check-models.mjs', '--require']);
    run(npx, ['electron-builder', '--config', 'desktop/electron-builder.config.cjs', osFlag, '--publish', 'never']);
    break;
  case 'dev':
    build();
    run(npx, ['electron', '.', '--dev', ...rest.filter((a) => !a.startsWith('--edition') && !a.startsWith('--platform') && a !== '--release')]);
    break;
  case 'smoke': {
    const dir = join('release', `${edition}${platform === 'none' ? '-nosteam' : ''}`, 'win-unpacked');
    const { EDITIONS } = await import('../src/platform/editions.ts');
    const exe = join(dir, `${EDITIONS[edition].executableName}.exe`);
    if (!existsSync(exe)) {
      console.error(`${exe} not found — run \`node scripts/desktop.mjs pack\` first`);
      process.exit(1);
    }
    const home = mkdtempSync(join(tmpdir(), 'ss-smoke-'));
    const out = join(home, 'smoke.json');
    const args = ['--windowed', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
    const child = spawn(exe, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        APPDATA: join(home, 'roaming'),
        LOCALAPPDATA: join(home, 'local'),
        SS_SMOKE_OUT: out,
      },
    });
    const code = await new Promise((resolve) => {
      const t = setTimeout(() => {
        // Kill Electron and its helper processes.
        spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
        resolve('timeout');
      }, 90_000);
      child.on('exit', (c) => {
        clearTimeout(t);
        resolve(c);
      });
    });
    if (!existsSync(out)) {
      console.error(`smoke: no result (exit ${code})`);
      process.exit(1);
    }
    const res = JSON.parse(readFileSync(out, 'utf8'));
    console.log(JSON.stringify(res, null, 2));
    const x = res.result ?? {};
    const failures = [];
    if (x.bridge !== 'object') failures.push('ssBridge missing');
    if (x.nodeInPage) failures.push('Node globals visible in the page');
    if (x.kind !== 'desktop') failures.push(`platform kind ${x.kind}`);
    if (x.storage !== 'desktop-fs') failures.push(`storage ${x.storage}`);
    if (!x.write?.ok || !res.onDisk) failures.push('save write did not reach disk');
    if (!String(x.csp).includes("default-src 'self'")) failures.push(`CSP header missing (${x.csp})`);
    if (!x.canvas || x.fatal) failures.push(`game did not boot (${x.fatal})`);
    if (res.windowTitle !== EDITIONS[edition].productName) failures.push(`window title ${res.windowTitle}`);
    if (opt.shot && existsSync(out.replace(/\.json$/, '.png'))) copyFileSync(out.replace(/\.json$/, '.png'), opt.shot);
    rmSync(home, { recursive: true, force: true });
    if (failures.length) {
      console.error(`smoke FAILED: ${failures.join('; ')}`);
      process.exit(1);
    }
    console.log('smoke OK');
    break;
  }
  default:
    console.error(`unknown command ${cmd}`);
    process.exit(2);
}
