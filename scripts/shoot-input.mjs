// Input screens for visual review (radial menu, controls screen). Needs a build (npx vite build).
// Usage: node scripts/shoot-input.mjs <outDir>
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const [out = 'shots'] = process.argv.slice(2);
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
  await page.goto(`${url}?op=op1-1`);
  await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function', null, { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  console.log('scene', await page.evaluate(() => [window.__game.scene.constructor.name, window.__game.scene.op?.status, window.__game.scene.op?.elapsed]), errors);
  await page.mouse.move(700, 400);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(700, 330, { steps: 4 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/radial.png` });
  await page.mouse.up({ button: 'middle' });
  console.log('tool after radial:', await page.evaluate(() => window.__game.scene.op.tool));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.mouse.click(640, 420); // Options
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/options.png` });
  await page.mouse.click(410, 636); // Controls
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/controls.png` });
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/controls-handling.png` });
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/controls-deck.png` });
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(0);
