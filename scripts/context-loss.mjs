// Context-loss regression (ENG-0199/0200): mid-operation, WEBGL_lose_context drops the GL
// context; the game must pause behind the DOM "Restoring the lamps…" veil, then rebuild every
// GL object on restore and carry on with the same operation. Builds must exist (npx vite build).
// Usage: node scripts/context-loss.mjs [outDir]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const [out = 'shots-ctx'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const fail = (m) => {
  console.error('FAIL: ' + m);
  process.exitCode = 1;
};
const frames = () => page.evaluate(() => window.__game.clock.frames);
const waitFrames = async (n) => {
  const f0 = await frames();
  await page.waitForFunction((f) => window.__game.clock.frames >= f, f0 + n, { timeout: 60000 });
};
try {
  await page.goto(`${url}?op=op1-1`);
  await page.waitForFunction(() => window.__game?.clock.frames > 1, null, { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.op?.status === 'running', null, { timeout: 60000 });
  await waitFrames(2);
  const before = await page.evaluate(() => ({ objs: window.__game.gfx.registry.count(), programs: window.__game.gfx.registry.count('program'), op: window.__game.scene.op, elapsed: window.__game.scene.op.elapsed, vitals: window.__game.scene.op.vitals }));
  await page.evaluate(() => {
    window.__ctxExt = window.__game.gfx.gl.getExtension('WEBGL_lose_context');
    window.__ctxExt.loseContext();
  });
  await page.waitForFunction(() => document.getElementById('lamps')?.style.display === 'flex', null, { timeout: 10000 });
  await page.screenshot({ path: `${out}/lost.png` });
  const lostElapsed = await page.evaluate(() => window.__game.scene.op.elapsed);
  await page.waitForTimeout(800);
  const stillElapsed = await page.evaluate(() => window.__game.scene.op.elapsed);
  if (stillElapsed !== lostElapsed) fail(`simulation kept running while the context was lost (${lostElapsed} → ${stillElapsed})`);
  await page.evaluate(() => window.__ctxExt.restoreContext());
  await page.waitForFunction(() => document.getElementById('lamps')?.style.display === 'none', null, { timeout: 10000 });
  const early = await page.evaluate(() => window.__game.gfx.gl.getError());
  if (early) console.log(`note: GL error 0x${early.toString(16)} in the first restored frame`);
  await waitFrames(3);
  const after = await page.evaluate(() => ({ objs: window.__game.gfx.registry.count(), programs: window.__game.gfx.registry.count('program'), same: window.__game.scene.op === window.__game.scene.op, elapsed: window.__game.scene.op.elapsed, err: window.__game.gfx.gl.getError(), lost: window.__game.gfx.gl.isContextLost() }));
  if (after.lost) fail('context still lost');
  if (after.programs !== before.programs) fail(`programs ${before.programs} → ${after.programs}`);
  if (!(after.elapsed > stillElapsed)) fail('operation did not resume');
  if (after.err) fail(`GL error 0x${after.err.toString(16)} after restore`);
  const shot = PNG.sync.read(await page.screenshot({ path: `${out}/restored.png` }));
  let sum = 0;
  for (let i = 0; i < shot.data.length; i += 4) sum += (shot.data[i] + shot.data[i + 1] + shot.data[i + 2]) / 3;
  const pixel = sum / (shot.data.length / 4);
  if (pixel < 8) fail(`restored frame is black (mean ${pixel.toFixed(1)})`);
  console.log(`context loss: objects ${before.objs} → ${after.objs}, programs ${after.programs}, op resumed at ${after.elapsed.toFixed(2)} s, mean luma ${pixel.toFixed(1)}`);
} finally {
  if (errors.length) fail('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
