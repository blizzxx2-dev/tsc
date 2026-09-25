// Art budget report (ART-0365/0366/0368): opens each scene type in the built game at 1920×1080 and
// reads the GL registry and the batcher counters — tracked GPU texture/target memory (MB), the
// number of texture objects by label, atlas pages, and per-frame draw calls, texture flushes and
// vertices. Operation scenes are also measured at peak VFX (Litany + curse motes + sparks + blood).
// Usage: npx vite build && node scripts/art/budget-report.mjs [--only <scene-name substring>] [--json out.json]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolveChromium } from '../qa/launch.mjs';

const SCENES = [
  { name: 'title', query: '' },
  { name: 'story (hospice)', query: 'story=hospice&who=ilse' },
  { name: 'story (camp)', query: 'story=camp&who=kreuzer' },
  { name: 'operation (op1-1)', query: 'op=op1-1', op: true },
  { name: 'operation (showcase)', query: 'op=showcase', op: true },
  { name: 'operation (Matins boss)', query: 'op=showcase-boss', op: true },
];

const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const rows = [];
const frames = (n) =>
  page.evaluate(
    (k) =>
      new Promise((r) => {
        const f0 = window.__game.clock.frames;
        const poll = () => (window.__game.clock.frames >= f0 + k ? r() : setTimeout(poll, 30));
        poll();
      }),
    n,
  );
const sample = () =>
  page.evaluate(() => {
    const g = window.__game.gfx;
    const reg = g.registry;
    const s = g.lastStats;
    const labels = {};
    for (const e of reg.top(200)) if (e.kind === 'texture') labels[e.label] = (labels[e.label] ?? 0) + 1;
    return {
      mb: +(reg.bytes() / 2 ** 20).toFixed(1),
      textureMb: +(reg.bytes('texture') / 2 ** 20).toFixed(1),
      atlasPages: Object.entries(labels)
        .filter(([l]) => /atlas|sheet|sprites/i.test(l))
        .reduce((a, [, n]) => a + n, 0),
      top: reg.top(6).map((c) => `${(c.bytes / 2 ** 20).toFixed(1)} MB ${c.label}`),
      drawCalls: s.drawCalls,
      textureFlushes: s.flushes.texture,
      vertices: s.vertices,
    };
  });

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
for (const sc of SCENES.filter((x) => x.name.includes(only))) {
  await page.goto(`${url}?${sc.query}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.clock.frames > 2 && !window.__game.transition?.busy, null, { timeout: 120000 });
  if (sc.op) {
    // Wait for the briefing, then Scrub In (a case that introduces an instrument shows its card first).
    await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function' && !window.__game.transition?.busy, null, {
      timeout: 240000,
    });
    for (let tries = 0; tries < 6; tries++) {
      await page.keyboard.press('Enter');
      if (
        await page
          .waitForFunction(() => !!window.__game?.scene?.op, null, { timeout: 10000 })
          .then(
            () => true,
            () => false,
          )
      )
        break;
    }
    await page.waitForFunction(() => !!window.__game?.scene?.op, null, { timeout: 240000 });
    await page.evaluate(() => {
      const op = window.__game.scene.op;
      op.dialogue.length = 0;
      for (let t = 0; t < 4; t += 1 / 60) op.update(1 / 60);
    });
  }
  await frames(6);
  rows.push({ scene: sc.name, state: 'steady', ...(await sample()) });
  console.error(JSON.stringify(rows.at(-1)));
  if (sc.op) {
    // Peak VFX: Litany running, particle caps filled, curse motes and sparks in the hot area.
    await page.evaluate(() => {
      const op = window.__game.scene.op;
      op.litanyAllowed = Math.max(op.litanyAllowed, op.litanyUses + 1);
      op.invokeLitany();
      const c = { x: 660, y: 410 };
      for (const kind of ['blood', 'spark', 'mote', 'gold', 'smoke', 'dust']) op.emit(kind, c, 80);
    });
    await frames(3);
    rows.push({ scene: sc.name, state: 'peak VFX', ...(await sample()) });
  }
}
await browser.close();
await server.close();

console.log('| Scene | State | Tracked GPU memory (MB) | Textures (MB) | Atlas pages | Draw calls | Texture binds (flushes) | Vertices |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows)
  console.log(`| ${r.scene} | ${r.state} | ${r.mb} | ${r.textureMb} | ${r.atlasPages} | ${r.drawCalls} | ${r.textureFlushes} | ${r.vertices} |`);
console.log('\nLargest allocations per scene:');
for (const r of rows) console.log(`- ${r.scene} (${r.state}): ${r.top.join('; ')}`);
const i = process.argv.indexOf('--json');
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(rows, null, 2));
