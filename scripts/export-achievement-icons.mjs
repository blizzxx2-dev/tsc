// Achievement icon export (ART-0069): renders every achievement's wax medallion from the QA build's
// heraldry board and saves Steam's two sizes, in colour (achieved) and greyed (locked), to
// steam/achievements/<ID>[_locked]_<size>.png. Needs a QA build (npm run build:qa).
// Usage: node scripts/export-achievement-icons.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const src = readFileSync('src/platform/achievements.ts', 'utf8');
const ids = [...src.matchAll(/id: '([A-Z_]+)'/g)].map((m) => m[1]);
const out = 'steam/achievements';
mkdirSync(out, { recursive: true });
const server = await preview({ build: { outDir: 'dist-qa' }, preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
// The board's view is 1280×720 at device scale 1, so an icon drawn at N px is N device pixels.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const id of ids)
  for (const locked of [false, true])
    for (const size of [256, 64]) {
      await page.goto(`${url}?scene=heraldry&medal=${id}&size=${size}${locked ? '&locked=1' : ''}`);
      await page.waitForTimeout(900);
      const file = `${out}/${id}${locked ? '_locked' : ''}_${size}.png`;
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
      console.log(file);
    }
await browser.close();
await server.close();
