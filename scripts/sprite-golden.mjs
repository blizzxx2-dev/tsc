// Sprite API golden image (ENG-0032): draws every fx-atlas frame with rotation, scale, tint,
// flips, pivots, a nine-slice and a mesh in a fixed scene, and pixel-diffs against
// tests/golden/sprites.png (SwiftShader). Builds must exist (npx vite build).
//   node scripts/sprite-golden.mjs            compare (exit 1 on mismatch)
//   node scripts/sprite-golden.mjs --update   rewrite the golden
import { chromium } from 'playwright';
import { preview } from 'vite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const GOLDEN = 'tests/golden/sprites.png';
const update = process.argv.includes('--update');
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let code = 0;
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.clock.frames > 1, null, { timeout: 30000 });
  await page.evaluate(async () => {
    const game = window.__game;
    await game.assets.loadBundle('ops-common');
    const ids = ['fx/soft-round', 'fx/splatter-1', 'fx/splatter-2', 'fx/splatter-3', 'fx/splatter-4', 'fx/drag-streak', 'fx/scorch', 'fx/stitch-mark', 'fx/erase'];
    game.go({
      update() {},
      render(g) {
        g.beginScreen([0.1, 0.08, 0.07]);
        ids.forEach((id, i) => {
          const x = 90 + (i % 5) * 250;
          const y = 140 + Math.floor(i / 5) * 260;
          g.sprite(id, x, y, { scale: 1.6, tint: 0xff3040c0 + i * 0x001008 });
          g.sprite(id, x + 110, y, { rot: 0.6 + i * 0.3, scale: { x: 1, y: 0.6 }, flipX: i % 2 === 1, alpha: 0.7 });
        });
        g.nineSlice('fx/erase', { x: 1010, y: 420, w: 220, h: 120 }, { l: 20, t: 20, r: 20, b: 20 }, 0xff80c0e0);
        g.mesh([1020, 600, 1240, 580, 1230, 700, 1030, 690], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3], 'fx/splatter-3', 0xffe0e0e0);
        g.text('sprites', 640, 690, { size: 30, align: 'center', shadow: false });
        g.endFrame();
      },
    });
  });
  const f0 = await page.evaluate(() => window.__game.clock.frames);
  await page.waitForFunction((f) => window.__game.clock.frames > f + 1, f0, { timeout: 60000 });
  const buf = await page.screenshot();
  if (update || !existsSync(GOLDEN)) {
    mkdirSync('tests/golden', { recursive: true });
    writeFileSync(GOLDEN, buf);
    console.log(`wrote ${GOLDEN}`);
  } else {
    const a = PNG.sync.read(buf);
    const b = PNG.sync.read(readFileSync(GOLDEN));
    if (a.width !== b.width || a.height !== b.height) throw new Error('golden size mismatch');
    let bad = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      if (d > 24) bad++;
    }
    const frac = bad / (a.width * a.height);
    console.log(`sprite golden: ${(frac * 100).toFixed(3)}% pixels differ`);
    if (frac > 0.005) code = 1;
  }
} finally {
  if (errors.length) {
    console.log('page errors:\n' + errors.join('\n'));
    code = 1;
  }
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(code);
