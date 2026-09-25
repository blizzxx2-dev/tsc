// Exports the woodcut marketing cards from `?scene=cards` at their delivery sizes into
// docs/art/marketing/renders/: ART-0325 store banners, ART-0335 trailer title card and end slates,
// ART-0328 social kit, ART-0337 stream overlays, ART-0330 Wound Man promo plates. Overlays are transparent: each is rendered over
// black and over white, and the alpha is recovered by difference matting
// (a = 1 − (white − black), colour = black / a), which is exact for alpha-blended art.
// Usage: npx vite build && node scripts/art/export-cards.mjs [card-id …]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { resolveChromium } from '../qa/launch.mjs';

const OUT = 'docs/art/marketing/renders';
// Mirrors CARDS in src/art/marketingCards.ts: id → [out w, out h, rect w, rect h, matte].
const CARDS = {
  title: [1920, 1080, 1280, 720],
  'slate-demo': [1920, 1080, 1280, 720],
  slate: [1920, 1080, 1280, 720],
  'banner-operate': [616, 120, 616, 120],
  'banner-malison': [616, 120, 616, 120],
  'banner-kessendorf': [616, 120, 616, 120],
  'social-avatar': [400, 400, 400, 400],
  'x-banner': [1500, 500, 1200, 400],
  'youtube-banner': [2560, 1440, 1280, 720],
  'discord-icon': [512, 512, 512, 512],
  'discord-banner': [960, 540, 960, 540],
  'stream-frame': [1920, 1080, 1280, 720, true],
  'stream-lower-third': [1920, 1080, 1280, 720, true],
  'stream-wishlist': [400, 120, 400, 120, true],
  'promo-cuts': [1080, 1080, 720, 720],
  'promo-shafts': [1080, 1080, 720, 720],
  'promo-burns': [1080, 1080, 720, 720],
  'promo-plague': [1080, 1080, 720, 720],
  'promo-venom': [1080, 1080, 720, 720],
  'promo-curses': [1080, 1080, 720, 720],
};

const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function shot(id, rw, rh, dpr, ground) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });
  await page.goto(`${url}?scene=cards&card=${id}&t=1.5${ground ? `&ground=${ground}` : ''}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.clock.frames > 6, null, { timeout: 240000 });
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: rw, height: rh }, timeout: 240000 });
  await page.close();
  return png;
}

for (const [id, [w, h, rw, rh, matte]] of Object.entries(CARDS)) {
  if (only.length && !only.includes(id)) continue;
  const dpr = w / rw;
  const file = `${OUT}/${id}.png`;
  if (!matte) {
    await sharp(await shot(id, rw, rh, dpr))
      .resize(w, h)
      .png()
      .toFile(file);
  } else {
    const [b, wh] = await Promise.all([shot(id, rw, rh, dpr, 'black'), shot(id, rw, rh, dpr, 'white')]);
    const B = await sharp(b).resize(w, h).removeAlpha().raw().toBuffer();
    const W = await sharp(wh).resize(w, h).removeAlpha().raw().toBuffer();
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0, j = 0; i < B.length; i += 3, j += 4) {
      const a = 1 - (W[i] - B[i] + (W[i + 1] - B[i + 1]) + (W[i + 2] - B[i + 2])) / (3 * 255);
      const al = Math.max(0, Math.min(1, a));
      for (let c = 0; c < 3; c++) out[j + c] = al > 0.004 ? Math.min(255, Math.round(B[i + c] / al)) : 0;
      out[j + 3] = Math.round(al * 255);
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(file);
  }
  console.log(file);
}
await browser.close();
await server.close();
