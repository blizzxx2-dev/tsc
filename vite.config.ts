import { defineConfig, type Plugin } from 'vite';
import { execFile, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * Build flavours (see docs/platform/build.md):
 *   VITE_EDITION=demo|full          which edition to compile (default demo — the current ship target)
 *   VITE_PLATFORM=web|desktop|none  desktop builds use a relative base so the game loads from app://
 *   SS_SOURCEMAP=hidden             emit source maps for crash symbolication, unreferenced by the bundle
 *   SS_OUT_DIR=<dir>                output directory (default dist)
 */
const edition = process.env.VITE_EDITION === 'full' ? 'full' : 'demo';
const versions = JSON.parse(readFileSync(new URL('./versions.json', import.meta.url), 'utf8')) as Record<string, string>;

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 8);
  try {
    return execSync('git rev-parse --short=8 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'nogit';
  }
}

function buildDate(): string {
  // SOURCE_DATE_EPOCH keeps two CI builds of one commit byte-identical (PLT-0032).
  const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now();
  return new Date(epoch).toISOString().slice(0, 10).replaceAll('-', '');
}

/**
 * ART-0039: watch assets/ in the dev server, rebuild the hashed outputs and manifest, and tell the
 * page to hot-swap them (src/assets/browser.ts). The manifest module itself is excluded from HMR
 * propagation so the edit doesn't turn into a full reload.
 */
function assetsHotReload(): Plugin {
  const dir = resolve('assets');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  return {
    name: 'assets-hot-reload',
    apply: 'serve',
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith('manifest.gen.ts')) return [];
    },
    configureServer(server) {
      server.watcher.add(dir);
      const rebuild = (file: string) => {
        if (!file.startsWith(dir)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (running) return rebuild(file);
          running = true;
          const t0 = Date.now();
          execFile(process.execPath, ['scripts/build-assets.ts'], (err, _out, stderr) => {
            running = false;
            if (err) return server.config.logger.error(`[assets] rebuild failed\n${stderr}`);
            server.config.logger.info(`[assets] rebuilt in ${Date.now() - t0} ms`, { timestamp: true });
            server.ws.send({ type: 'custom', event: 'assets:rebuilt' });
          });
        }, 150);
      };
      server.watcher.on('change', rebuild);
      server.watcher.on('add', rebuild);
      server.watcher.on('unlink', rebuild);
    },
  };
}

export default defineConfig({
  plugins: [assetsHotReload()],
  base: process.env.VITE_PLATFORM === 'desktop' ? './' : '/',
  define: {
    __EDITION__: JSON.stringify(edition),
    __APP_VERSION__: JSON.stringify(versions[edition]),
    __GIT_SHA__: JSON.stringify(gitSha()),
    __BUILD_DATE__: JSON.stringify(buildDate()),
    __PLATFORM_TARGET__: JSON.stringify(process.env.VITE_PLATFORM ?? 'web'),
  },
  build: {
    // Electron and every WebGL2-class browser run ES2022; the platform layer uses top-level await.
    target: 'es2022',
    outDir: process.env.SS_OUT_DIR ?? 'dist',
    sourcemap: process.env.SS_SOURCEMAP === 'hidden' ? 'hidden' : false,
  },
});
