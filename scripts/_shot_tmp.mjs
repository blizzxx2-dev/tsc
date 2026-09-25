import { chromium } from 'playwright';
import { preview } from 'vite';
const server = await preview({ build: { outDir: 'dist-qa' }, preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const [q, name, wait, keys] = process.argv.slice(2);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto(`${url}${q}`);
await page.waitForTimeout(Number(wait ?? 4000));
for (const k of (keys ?? '').split(',').filter(Boolean)) {
  await page.keyboard.press(k);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `/tmp/claude-0/shots/${name}.png` });
await browser.close();
await server.close();
