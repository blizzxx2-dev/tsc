// Shared launcher for the browser scripts (smoke, shot): serves a build with `vite preview` on a free
// port and opens it in Chromium with WebGL2 through SwiftShader, so it runs on GPU-less CI machines.
// Browser: $CHROMIUM if set, else Playwright's bundled Chromium (`npx playwright install chromium`).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

/**
 * The Chromium to launch: $CHROMIUM when set; otherwise Playwright's bundled build; if that exact
 * revision is not installed, the newest `chromium-*` under $PLAYWRIGHT_BROWSERS_PATH.
 * Returns undefined to let Playwright use its default.
 */
export function resolveChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // fall through
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const rel of ['chrome-linux/chrome', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = join(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * The browser scripts need the QA build (debug API). Build it when it is missing, so pipelines that
 * only produced the release build (`dist/`) can still run `node scripts/smoke.mjs`.
 */
export function ensureQaBuild(outDir = 'dist-qa') {
  if (existsSync(join(outDir, 'index.html')) && !process.env.QA_REBUILD) return;
  console.log(`building the QA bundle into ${outDir}/ (vite build --mode qa)…`);
  const r = spawnSync('npx', ['vite', 'build', '--mode', 'qa', '--outDir', outDir, '--logLevel', 'warn'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error('QA build failed');
}

export const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/**
 * @param {{ outDir?: string, viewport?: { width: number, height: number } }} [opts]
 */
export async function launchGame(opts = {}) {
  const outDir = opts.outDir ?? process.env.QA_DIST ?? 'dist-qa';
  ensureQaBuild(outDir);
  const server = await preview({ build: { outDir }, preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch({ executablePath: resolveChromium(), args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: opts.viewport ?? { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`);
  });
  const close = async () => {
    await browser.close().catch(() => {});
    await new Promise((r) => server.httpServer.close(r));
  };
  return { page, url, errors, close };
}

/** Wait until the QA debug API is installed (QA builds only). */
export async function waitForDebug(page, timeout = 20_000) {
  await page.waitForFunction(() => !!window.__game?.debug, null, { timeout });
}

/** Wait for a scene name (`title`, `story`, `operation`, …) or an operation status (`running`, `won`, …). */
export async function waitForState(page, target, timeout = 20_000) {
  await page.waitForFunction(
    (t) => {
      const s = window.__game?.debug?.state();
      return !!s && (s.scene === t || s.op?.status === t);
    },
    target,
    { timeout, polling: 50 },
  );
}

/** Resolve after the game has drawn `n` more frames (so screenshots show the latest state). */
export const frames = (page, n = 2) =>
  page.evaluate(
    (k) =>
      new Promise((resolve) => {
        let i = 0;
        const f = () => (++i >= k ? resolve(undefined) : requestAnimationFrame(f));
        requestAnimationFrame(f);
      }),
    n,
  );
