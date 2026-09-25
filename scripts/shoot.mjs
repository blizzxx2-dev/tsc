// Screenshot tool for visual review. Builds must exist (npm run build).
// Usage: node scripts/shoot.mjs <outDir> [shot ...]
//   shots: title | story:<backdrop>[:<characterId>] | op:<id>:<seconds>[:<toolKey 1-8>] (default: title story:hospice op:showcase:3)
//          url:<query>[:<keys,comma,separated>] (e.g. url:ui=gallery)  pause:<id>:<seconds> (operation, then Escape)
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const [out = 'shots', ...list] = process.argv.slice(2);
const shots = list.length ? list : ['title', 'story:hospice', 'op:showcase:3'];
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  for (const shot of shots) {
    const [kind, a, b] = shot.split(':');
    if (kind === 'title') {
      await page.goto(url);
      await page.waitForTimeout(2500);
    } else if (kind === 'story') {
      await page.goto(`${url}?story=${a ?? 'hospice'}${b ? `&who=${b}` : ''}`);
      await page.waitForTimeout(2500);
    } else if (kind === 'url') {
      // Waits on rendered frames rather than wall time, so it also works on a loaded software rasteriser.
      const frames = (n) => page.evaluate((k) => new Promise((r) => { const f0 = window.__game.clock.frames; const poll = () => (window.__game.clock.frames >= f0 + k ? r() : setTimeout(poll, 30)); poll(); }), n);
      await page.goto(`${url}?${a}`);
      await page.waitForFunction(() => window.__game?.clock.frames > 2 && !window.__game.transition?.busy, null, { timeout: 120000 });
      for (const k of (b ?? '').split(',').filter(Boolean)) {
        await page.keyboard.press(k);
        await frames(3);
      }
      await frames(4);
    } else if (kind === 'op' || kind === 'pause') {
      const [opId, query] = a.split('?');
      await page.goto(`${url}?op=${opId}${query ? '&' + query : ''}`);
      await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function' && !window.__game.transition?.busy, null, { timeout: 30000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !!window.__game?.scene?.op, null, { timeout: 30000 });
      await page.evaluate((s) => {
        const op = window.__game.scene.op;
        for (let t = 0; t < s; t += 1 / 60) op.update(1 / 60);
      }, Number(b ?? 3));
      const [, , , tool] = shot.split(':');
      if (tool) await page.keyboard.press(`Digit${tool}`);
      await page.mouse.move(660, 380);
      await page.waitForTimeout(600);
      if (kind === 'pause') {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);
      }
    }
    await page.screenshot({ path: `${out}/${shot.replace(/:/g, '_').replace(/,/g, '-')}.png`, timeout: 120000 });
    console.log('shot', shot);
  }
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(0);
