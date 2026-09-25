// Art budget report (ART-0365/0366/0368): opens each scene type in the built game at 1920×1080 and
// reads the GL registry and the batcher counters — tracked GPU texture/target memory (MB), the
// number of texture objects by label, atlas pages, and per-frame draw calls, texture flushes and
// vertices. Operation scenes are also measured at peak VFX (Litany + curse motes + sparks + blood).
// Needs the QA build (debug API): npm run build:qa && node scripts/art/budget-report.mjs [--only <scene-name substring>] [--json out.json]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolveChromium } from '../qa/launch.mjs';

const SCENES = [
  { name: 'title', query: '' },
  { name: 'story (hospice)', query: 'story=hospice&who=ilse' },
  { name: 'story (camp)', query: 'story=camp&who=kreuzer' },
  { name: 'operation (op1-2)', query: '', op: 'op1-2' },
  { name: 'operation (Matins boss)', query: '', op: 'op1-5', boss: true },
  { name: 'operation (Lauds boss)', query: '', op: 'op2-5', boss: true },
];

const server = await preview({ build: { outDir: 'dist-qa' }, preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
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
    // Start the operation through the automation API, then advance past the title card (and to the boss).
    await page.waitForFunction(() => !!window.__game?.debug, null, { timeout: 240000 });
    await page.evaluate((id) => window.__game.debug.operation(id, true), sc.op);
    await page.waitForFunction(() => !!window.__game.debug.op() && !window.__game.transition?.busy, null, { timeout: 240000 });
    await page.evaluate((boss) => {
      const d = window.__game.debug;
      const op = d.op();
      op.dialogue.length = 0;
      d.skipPhase();
      for (let i = 0; boss && i < 8 && !op.entities.some((e) => e.alive && e.boss); i++) d.skipPhase();
      d.simulate(3);
      op.dialogue.length = 0;
    }, !!sc.boss);
  }
  await frames(6);
  rows.push({ scene: sc.name, state: 'steady', ...(await sample()) });
  console.error(JSON.stringify(rows.at(-1)));
  if (sc.op) {
    // Peak VFX: Litany running, particle caps filled, curse motes and sparks in the hot area.
    await page.evaluate(() => {
      const op = window.__game.debug.op();
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
