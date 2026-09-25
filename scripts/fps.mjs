// Measures rAF rate of a running build for a few seconds (SwiftShader numbers are only relative).
// Usage: node scripts/fps.mjs [query] [seconds]
import { chromium } from 'playwright';
import { preview } from 'vite';

const [query = '', secs = '3'] = process.argv.slice(2);
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url + query);
await page.waitForTimeout(2000);
if (query.includes('op=')) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
}
const n = await page.evaluate(
  (ms) =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < ms) requestAnimationFrame(f);
        else res(n);
      };
      requestAnimationFrame(f);
    }),
  Number(secs) * 1000,
);
console.log(`${query || 'title'}: ${(n / Number(secs)).toFixed(1)} fps`);
await browser.close();
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
