// Particle/VFX look-dev capture (ENG-0124/0132): opens an operation, fires emitters by id at the
// field centre and screenshots after a few frames. Needs a QA build (`vite build --mode qa`).
// Usage: node scripts/qa/fxshot.mjs <out.png> [opId] [emitter:n,emitter:n…] [frames]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { resolveChromium } from './launch.mjs';

const [out = 'fx.png', opId = 'op1-1', list = 'blood:40,spark:30,smoke:10,gold:20,mote:20', frames = '8'] = process.argv.slice(2);
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto(`${url}?op=${opId}`);
  await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function' && !window.__game.transition?.busy, null, {
    timeout: 120000,
  });
  // Scrub In; a case that introduces an instrument shows its card first, so press again until the op exists.
  for (let tries = 0; tries < 3; tries++) {
    await page.keyboard.press('Enter');
    if (
      await page
        .waitForFunction(() => !!window.__game?.scene?.op, null, { timeout: 4000 })
        .then(
          () => true,
          () => false,
        )
    )
      break;
  }
  await page.waitForFunction(() => !!window.__game?.scene?.particles && window.__game.debug, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.debug.freeze());
  const fx = list.split(',').map((s) => s.split(':'));
  await page.evaluate((fx) => {
    const scene = window.__game.scene;
    const p = scene.particles;
    fx.forEach(([id, n], i) => p.burst(id, { x: 420 + i * 110, y: 380 }, Number(n)));
  }, fx);
  await page.evaluate((n) => window.__game.debug.step(n, { render: 'all' }), Number(frames));
  await page.screenshot({ path: out });
  console.log('shot', out);
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
