// Aspect-ratio layout check (ENG-0182–0185): screenshots the title, an operation and the
// pause menu at 16:9, 16:10, 21:9, 32:9 and 4:3 and asserts the safe-area mapping of a click.
// Builds must exist (npx vite build). Usage: node scripts/shoot-aspects.mjs <outDir>
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const [out = 'shots-aspect'] = process.argv.slice(2);
const SIZES = { '16x9': [1280, 720], '16x10': [1280, 800], '21x9': [1720, 720], '32x9': [2560, 720], '4x3': [1024, 768] };
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
let failed = false;
try {
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
    await page.goto(url);
    await page.waitForFunction(() => window.__game?.clock.frames > 1, null, { timeout: 30000 });
    await page.screenshot({ path: `${out}/title_${name}.png` });
    // The safe-area centre must map to (640, 360) whatever the window shape.
    const rect = await page.evaluate(() => {
      const r = document.getElementById('game').getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, view: { ...window.__game.input.view } };
    });
    const cx = rect.left + ((640 + rect.view.ox) / rect.view.w) * rect.width;
    const cy = rect.top + ((360 + rect.view.oy) / rect.view.h) * rect.height;
    await page.mouse.move(cx, cy);
    const f0 = await page.evaluate(() => window.__game.clock.frames);
    await page.waitForFunction((f) => window.__game.clock.frames > f + 1, f0, { timeout: 30000 });
    const pos = await page.evaluate(() => ({ ...window.__game.input.pos }));
    const ok = Math.abs(pos.x - 640) < 1.5 && Math.abs(pos.y - 360) < 1.5;
    if (!ok) failed = true;
    console.log(`${name}: view ${rect.view.w.toFixed(0)}×${rect.view.h.toFixed(0)} margin (${rect.view.ox.toFixed(0)}, ${rect.view.oy.toFixed(0)}) pointer→(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) ${ok ? 'ok' : 'WRONG'}`);
    await page.goto(`${url}?op=showcase`);
    await page.waitForFunction(() => window.__game?.clock.frames > 1, null, { timeout: 30000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.scene.op, null, { timeout: 30000 });
    await page.evaluate(() => {
      const op = window.__game.scene.op;
      for (let t = 0; t < 3; t += 1 / 60) op.update(1 / 60);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `${out}/op_${name}.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__game.scene.paused, null, { timeout: 30000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `${out}/pause_${name}.png` });
    await page.close();
  }
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(failed || errors.length ? 1 : 0);
