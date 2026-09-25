// Exports the woodcut marketing cards (ART-0325 store banners, ART-0335 trailer title card and end
// slates) from `?scene=cards` at their delivery sizes into docs/art/marketing/renders/.
// Usage: npx vite build && node scripts/art/export-cards.mjs
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { resolveChromium } from '../qa/launch.mjs';

const OUT = 'docs/art/marketing/renders';
// id → [width, height] delivered; full-screen cards are drawn over the 1280×720 view, banners at 1:1.
const CARDS = {
  title: [1920, 1080],
  'slate-demo': [1920, 1080],
  slate: [1920, 1080],
  'banner-operate': [616, 120],
  'banner-malison': [616, 120],
  'banner-kessendorf': [616, 120],
};

mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const [id, [w, h]] of Object.entries(CARDS)) {
  const full = w === 1920;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: full ? 1.5 : 1 });
  await page.goto(`${url}?scene=cards&card=${id}&t=1.5`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.clock.frames > 6, null, { timeout: 240000 });
  await page.screenshot({ path: `${OUT}/${id}.png`, clip: { x: 0, y: 0, width: full ? 1280 : w, height: full ? 720 : h } });
  console.log(`${OUT}/${id}.png`);
  await page.close();
}
await browser.close();
await server.close();
