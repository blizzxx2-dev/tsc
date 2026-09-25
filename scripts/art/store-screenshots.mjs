// Store screenshots (ART-0323): 10 in-engine captures at 1920×1080 from the demo build — 3 operations,
// 2 bosses, 3 story (VN) scenes, the instrument tray and the results screen — with the HUD on and no
// debug overlay. Everything is driven through the automation API (window.__game.debug) so the set
// is reproducible; cosmetic randomness is seeded. Writes JPEG q92 (Steam accepts JPG/PNG).
// Usage: npx vite build && node scripts/art/store-screenshots.mjs [outDir]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { resolveChromium } from '../qa/launch.mjs';

const OUT = process.argv[2] ?? 'docs/art/marketing/screenshots';
const SEEDED_RANDOM = `(() => { let s = 0x2f6b1a3d; Math.random = () => { let t = (s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

/** Each shot: how to reach it, and where the pointer rests (view px). */
const SHOTS = [
  { name: '01-op-barbed-shaft', op: 'op1-2', sim: 5, tool: 'lancet', pointer: [640, 380] },
  { name: '02-op-powder-burns', op: 'op1-3', sim: 6, tool: 'tongs', pointer: [600, 420] },
  { name: '03-op-black-seam-lens', op: 'op2-2', sim: 6, phases: 1, tool: 'lens', pointer: [560, 380] },
  { name: '04-boss-matins', op: 'op1-5', sim: 3, boss: true, tool: 'brand', pointer: [700, 360] },
  { name: '05-boss-lauds', op: 'op2-5', sim: 3, boss: true, tool: 'lancet', pointer: [620, 400] },
  { name: '06-vn-prologue', story: 'prologue', line: 3 },
  { name: '07-vn-camp', story: 's2-1', line: 2 },
  { name: '08-vn-cantor', story: 's2-4', line: 2 },
  { name: '09-tray', op: 'op2-1', sim: 4, tool: 'tincture', pointer: [58, 330] },
  { name: '10-results-xs', results: ['XS', 'op1-5'] },
];

mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.addInitScript(SEEDED_RANDOM);
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__game?.debug && window.__game.clock.frames > 2, null, { timeout: 240000 });
const settle = (n) =>
  page.evaluate(
    (k) =>
      new Promise((r) => {
        const f0 = window.__game.clock.frames;
        const poll = () => (window.__game.clock.frames >= f0 + k ? r() : setTimeout(poll, 30));
        poll();
      }),
    n,
  );

for (const s of SHOTS) {
  if (s.op) {
    await page.evaluate((id) => window.__game.debug.operation(id, true), s.op);
    await page.waitForFunction(() => !!window.__game.debug.op() && !window.__game.transition?.busy, null, { timeout: 240000 });
    await page.evaluate(({ phases, boss, sim, tool }) => {
      const d = window.__game.debug;
      const op = d.op();
      op.dialogue.length = 0;
      d.skipPhase(); // past the title card
      for (let i = 0; i < (phases ?? 0); i++) d.skipPhase();
      for (let i = 0; boss && i < 8 && !op.entities.some((e) => e.alive && e.boss); i++) d.skipPhase();
      d.simulate(sim);
      op.dialogue.length = 0;
      if (tool) d.tool(tool);
    }, s);
    await page.mouse.move(s.pointer[0], s.pointer[1]);
  } else if (s.story) {
    await page.evaluate(({ story, line }) => window.__game.debug.story(story, line), s);
    await page.waitForFunction(() => !window.__game.transition?.busy, null, { timeout: 240000 });
    await page.mouse.move(1270, 710);
  } else if (s.results) {
    await page.evaluate(([rank, op]) => window.__game.debug.results(rank, op), s.results);
    await page.waitForFunction(() => !window.__game.transition?.busy, null, { timeout: 240000 });
    await page.mouse.move(1270, 710);
  }
  await settle(s.story || s.results ? 150 : 40);
  const png = await page.screenshot({ timeout: 240000 });
  await sharp(png).jpeg({ quality: 92, mozjpeg: true }).toFile(`${OUT}/${s.name}.jpg`);
  console.log(`${OUT}/${s.name}.jpg`);
}
await browser.close();
await server.close();
