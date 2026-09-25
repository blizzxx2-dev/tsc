import { chromium } from 'playwright';
import { preview } from 'vite';
const server = await preview({ preview: { port: 0 }, build: { outDir: 'dist-qa' } });
const url = server.resolvedUrls.local[0];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(`${url}${process.argv[3]}`);
await page.waitForFunction(() => !!window.__game?.debug, null, { timeout: 120000 });
await page.waitForFunction(
  () => {
    const a = window.__game.assets.get('models/set-theatre');
    return a && a.value && a.value.isReady;
  },
  null,
  { timeout: 900000, polling: 3000 },
);
await page.evaluate(() => window.__game.debug.freeze());
await page.evaluate(() => window.__game.debug.step(1, { render: 'all' }));
await page.screenshot({ path: process.argv[2], timeout: 300000 });
await b.close();
await server.close();
