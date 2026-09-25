// Screenshot an operation with player settings applied through the QA debug API (needs `npm run build:qa`).
//   node scripts/qa/shot-settings.mjs <out.png> <opId> <seconds> '{"goreLevel":"minimal"}'
import { chromium } from 'playwright';
import { preview } from 'vite';
const [out, opId, secs, settingsJson] = process.argv.slice(2);
const server = await preview({ preview: { port: 0 }, build: { outDir: 'dist-qa' } });
const url = server.resolvedUrls.local[0];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => (m.type() === 'error' || /shader|compile/i.test(m.text())) && console.log('CONSOLE', m.text().slice(0, 300)));
await page.goto(`${url}?op=${opId}`);
await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function' && !window.__game.transition?.busy, null, {
  timeout: 60000,
});
await page.keyboard.press('Enter');
await page.waitForFunction(() => !!window.__game?.scene?.op && !!window.__game.debug, null, { timeout: 60000 });
await page.evaluate((j) => {
  for (const [k, v] of Object.entries(JSON.parse(j))) window.__game.debug.setSetting(k, v);
}, settingsJson ?? '{}');
await page.evaluate((s) => {
  const op = window.__game.scene.op;
  for (let t = 0; t < s; t += 1 / 60) op.update(1 / 60);
}, Number(secs));
await page.mouse.move(700, 400);
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
await b.close();
await server.close();
