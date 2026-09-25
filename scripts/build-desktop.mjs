// Bundles the Electron main process and preload script (desktop/src → desktop/dist/*.cjs) with esbuild.
// Environment: VITE_EDITION=demo|full, VITE_PLATFORM=desktop|none, SS_RELEASE=1 (release build:
// RestartAppIfNecessary on, no steam_appid.txt), VITE_SENTRY_DSN, SS_CRASH_SUBMIT_URL.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const edition = process.env.VITE_EDITION === 'full' ? 'full' : 'demo';
const steamEnabled = process.env.VITE_PLATFORM !== 'none';
const release = process.env.SS_RELEASE === '1';
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
let sha = (process.env.GITHUB_SHA ?? '').slice(0, 8);
if (!sha) {
  try {
    sha = execSync('git rev-parse --short=8 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    sha = 'nogit';
  }
}
const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now();
const date = new Date(epoch).toISOString().slice(0, 10).replaceAll('-', '');
const buildId = `${versions[edition]}+${sha}.${date}`;

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron', 'steamworks.js'],
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
  define: {
    __EDITION__: JSON.stringify(edition),
    __APP_VERSION__: JSON.stringify(versions[edition]),
    __BUILD_ID__: JSON.stringify(buildId),
    __RELEASE__: JSON.stringify(release),
    __STEAM_ENABLED__: JSON.stringify(steamEnabled),
    __SENTRY_DSN__: JSON.stringify(process.env.VITE_SENTRY_DSN ?? ''),
    __CRASH_SUBMIT_URL__: JSON.stringify(process.env.SS_CRASH_SUBMIT_URL ?? ''),
    'import.meta.env': '{}',
  },
};

rmSync('desktop/dist', { recursive: true, force: true });
await build({ ...common, entryPoints: ['desktop/src/main.ts'], outfile: 'desktop/dist/main.cjs' });
await build({ ...common, entryPoints: ['desktop/src/preload.ts'], outfile: 'desktop/dist/preload.cjs' });

// steam_appid.txt only for unpackaged dev runs (PLT-0041); release packages never contain it.
const { EDITIONS } = await import('../src/platform/editions.ts');
if (!release && EDITIONS[edition].steamAppId > 0) writeFileSync('steam_appid.txt', String(EDITIONS[edition].steamAppId));
else if (existsSync('steam_appid.txt') && release) rmSync('steam_appid.txt');
console.log(`desktop bundle: ${edition} ${buildId}${release ? ' (release)' : ''}${steamEnabled ? '' : ' (no Steam)'}`);
