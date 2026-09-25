// Smoke test: boots the built game in headless Chromium (WebGL2 via SwiftShader),
// walks title → story → briefing → operations, plays part of op1-1 with real mouse
// gestures, and saves screenshots. Usage: node scripts/smoke.mjs <outDir>
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes('4173') && r()));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
/** Step the operation simulation directly (SwiftShader frame rates are too slow for wall-clock waits). */
const advance = (seconds) =>
  page.evaluate((sec) => {
    const op = window.__game.scene.op;
    for (let t = 0; t < sec; t += 1 / 60) op.update(1 / 60);
  }, seconds);
const opState = () =>
  page.evaluate(() => {
    const op = window.__game.scene.op;
    return {
      status: op.status,
      phase: op.phase,
      vitals: op.vitals,
      score: op.score,
      ents: op.entities.filter((e) => e.alive && !e.hidden).map((e) => ({ type: e.stitch && e.a ? 'Laceration' : e.r !== undefined && e.ichor ? 'BloodPool' : 'Other', pos: e.pos, a: e.a, b: e.b, r: e.r })),
    };
  });

try {
  await page.goto('http://localhost:4173/');
  await wait(2500);
  await shot('01-title');
  await page.mouse.click(640, 390); // Take the Oath
  await wait(1500);
  await page.keyboard.press('Space');
  await wait(1500);
  await shot('02-story');

  await page.goto('http://localhost:4173/?op=op1-1');
  await wait(1500);
  await shot('03-briefing');
  await page.keyboard.press('Enter');
  await wait(500);
  await advance(2.5);
  await wait(300);
  await shot('04-op1-1-start');
  await page.keyboard.press('Digit4'); // Gut Thread

  // Stitch each laceration with a zig-zag drag, like a player would.
  const s = await opState();
  for (const e of s.ents.filter((x) => x.type === 'Laceration')) {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
    const len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    await page.mouse.move(e.a.x + nx * 25, e.a.y + ny * 25);
    await page.mouse.down();
    for (let i = 0; i <= 10; i++) {
      const t = 0.05 + (i / 10) * 0.9, side = i % 2 ? -25 : 25;
      await page.mouse.move(e.a.x + dx * t + nx * side, e.a.y + dy * t + ny * side, { steps: 4 });
    }
    await page.mouse.up();
  }
  await wait(600);
  const after = await opState();
  console.log('op1-1 after stitching:', JSON.stringify({ phase: after.phase, score: after.score, left: after.ents.map((e) => e.type) }));
  await shot('05-op1-1-stitched');

  for (const id of ['op1-3', 'op1-4', 'op1-5']) {
    await page.goto(`http://localhost:4173/?op=${id}`);
    await wait(1200);
    await page.keyboard.press('Enter');
    await wait(500);
    await advance(3);
    await wait(300);
    await shot(`op-${id}`);
  }
  // Jump op1-5 ahead to the Malison.
  await page.evaluate(() => window.__game.scene.op.entities.forEach((e) => e.kill()));
  await advance(1.5);
  await page.evaluate(() => window.__game.scene.op.entities.forEach((e) => { if (e.state === 'mark') { e.state = 'open'; e.required = false; } }));
  await advance(6);
  await wait(300);
  await shot('op-malison');
  for (const id of (process.env.EXTRA_OPS ?? '').split(',').filter(Boolean)) {
    await page.goto(`http://localhost:4173/?op=${id}`);
    await wait(1200);
    await page.keyboard.press('Enter');
    await wait(500);
    await advance(Number(process.env.EXTRA_T ?? 4));
    await wait(300);
    await shot(`op-${id}`);
  }
} finally {
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
  await browser.close();
  server.kill();
  process.exit(0);
}
