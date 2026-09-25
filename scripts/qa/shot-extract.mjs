// Visual check for the extraction tray and closure art (ART-0202, ART-0188): starts an operation,
// lifts every lodged object off the body (as the tongs would), closes it with a scar, and screenshots.
//   node scripts/qa/shot-extract.mjs <outDir> [opId=showcase] [seconds=2] [results]
// Needs a build (npx vite build); with `results` it also opens the results card (needs npm run build:qa).
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { resolveChromium } from './launch.mjs';

const [out = 'shots', opId = 'showcase', secs = '2', mode = ''] = process.argv.slice(2);
const results = mode === 'results';
mkdirSync(out, { recursive: true });
const server = await preview({
  ...(results ? { build: { outDir: 'dist-qa' } } : {}),
  preview: { port: 0, strictPort: false, open: false },
  logLevel: 'silent',
});
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('page error:', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
try {
  if (results) {
    await page.goto(url);
    await page.waitForFunction(() => !!window.__game?.debug, null, { timeout: 120000 });
  } else await page.goto(`${url}?op=${opId}`);
  if (!results) {
    await page.waitForFunction(() => window.__game?.scene && typeof window.__game.scene.onBegin === 'function' && !window.__game.transition?.busy, null, {
      timeout: 120000,
    });
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
    await page.waitForFunction(() => !!window.__game?.scene?.op, null, { timeout: 60000 });
    await page.evaluate((s) => {
      const op = window.__game.scene.op;
      for (let t = 0; t < s; t += 1 / 60) op.update(1 / 60);
    }, Number(secs));
    // Let the scene render the lodged objects before they are lifted out.
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const op = window.__game.scene.op;
      // Lift every lodged object and scrap of wadding off the body, then let the scene see them go.
      for (const e of op.entities) {
        if (!e.alive || !('kind' in e || e.noun === 'the wadding')) continue;
        if (!('origin' in e) && e.noun !== 'the wadding') continue;
        e.pos = { x: 1150, y: 150 };
        e.alive = false;
      }
      op.scars.push([
        { x: 520, y: 470 },
        { x: 600, y: 440 },
        { x: 690, y: 452 },
      ]);
    });
    await page.waitForTimeout(1500);
    console.log(
      await page.evaluate(() =>
        JSON.stringify({
          tray: window.__game.scene.tray?.tray?.length,
          lead: window.__game.scene.tray?.lead?.length,
          seen: window.__game.scene.tray?.seen?.size,
          ents: window.__game.scene.op.entities.map((e) => e.constructor.name + (e.alive ? '' : '(dead)')).join(','),
        }),
      ),
    );
    await page.screenshot({ path: `${out}/extract-${opId}.png`, timeout: 120000 });
    console.log('shot', `${out}/extract-${opId}.png`);
  }
  if (results) {
    // The results card with the same closures: its suture vignette carries the scars over.
    await page.evaluate(() => {
      window.__game.debug.results('S', 'op1-1', true);
    });
    await page.waitForFunction(() => window.__game.scene?.op?.status === 'won', null, { timeout: 60000 });
    await page.evaluate(() => {
      window.__game.scene.op.scars.push(
        [
          { x: 520, y: 470 },
          { x: 600, y: 440 },
          { x: 690, y: 452 },
        ],
        [
          { x: 780, y: 330 },
          { x: 830, y: 380 },
        ],
      );
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/results-${opId}.png`, timeout: 120000 });
    console.log('shot', `${out}/results-${opId}.png`);
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(0);
