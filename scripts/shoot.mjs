// Screenshot tool for visual review. Builds must exist (npm run build).
// Usage: node scripts/shoot.mjs <outDir> [shot ...]
//   shots: title | story:<backdrop>[:<characterId>] | op:<id>:<seconds>[:<toolKey 1-8>] (default: title story:hospice op:showcase:3)
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
    } else if (kind === 'op') {
      await page.goto(`${url}?op=${a}`);
      await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function', null, { timeout: 30000 });
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
    }
    await page.screenshot({ path: `${out}/${shot.replace(/:/g, '_')}.png` });
    console.log('shot', shot);
  }
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(0);
