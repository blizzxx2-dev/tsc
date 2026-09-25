// Prints the browser console of a cold boot (boot timing, GPU caps/tier, warnings).
// Builds must exist (npx vite build). Usage: node scripts/boot-log.mjs [query] [waitMs]
import { chromium } from 'playwright';
import { preview } from 'vite';

const [query = '', wait = '4000'] = process.argv.slice(2);
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const t0 = Date.now();
page.on('console', (m) => console.log(`[${Date.now() - t0} ms] ${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`[${Date.now() - t0} ms] PAGE ERROR: ${e}`));
await page.goto(url + query);
await page.waitForTimeout(Number(wait));
await browser.close();
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
