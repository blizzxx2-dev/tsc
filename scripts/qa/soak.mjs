// Idle soak driver (QAT-0144): parks the QA build on a scene for hours and samples memory every minute.
// Fails on a page error, a stalled frame loop, or JS heap growth beyond the budget (default 50 MB).
// Hitch audit (ENG-0224): every sample also records the worst frame and the count of frames over
// the hitch threshold (default 50 ms) from the game's profiler; `--assert-hitch` makes any hitch a
// failure (off by default because the CI software rasteriser cannot hold 50 ms frames).
// Usage: node scripts/qa/soak.mjs <title|paused-op|demo-end> <hours> [--budget-mb 50] [--hitch-ms 50] [--assert-hitch]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchGame, waitForDebug } from './launch.mjs';

const [scene = 'title', hoursArg = '8'] = process.argv.slice(2);
const bIdx = process.argv.indexOf('--budget-mb');
const budgetMb = bIdx > 0 ? Number(process.argv[bIdx + 1]) : 50;
const hIdx = process.argv.indexOf('--hitch-ms');
const hitchMs = hIdx > 0 ? Number(process.argv[hIdx + 1]) : 50;
const assertHitch = process.argv.includes('--assert-hitch');
const hours = Number(hoursArg);
const { page, url, errors, close } = await launchGame();
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');

const heapMb = async () => {
  await client.send('HeapProfiler.collectGarbage').catch(() => undefined);
  const { metrics } = await client.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'JSHeapUsedSize').value / 1048576;
};
const frameCount = () => page.evaluate(() => window.__game.gfx.time);

await page.goto(url);
await waitForDebug(page);
if (scene === 'paused-op') {
  await page.evaluate(() => {
    const d = window.__game.debug;
    d.operation('op2-5', true);
    d.skipPhase();
    d.skipPhase();
  });
  await page.keyboard.press('Escape');
} else if (scene === 'demo-end') await page.evaluate(() => window.__game.debug.demoEnd());

// Worst frame and hitch count since the last reset, from the in-game profiler (src/render/profiler.ts).
const hitchReport = () => page.evaluate(() => window.__game.profiler?.hitchReport?.() ?? null);
const resetHitches = () => page.evaluate(() => window.__game.profiler?.resetHitches?.());

const samples = [];
const start = Date.now();
let failure = '';
let worst = { worstMs: 0, worstFrame: -1, minute: 0 };
let hitches = 0;
await page.waitForTimeout(10_000);
const base = await heapMb();
await resetHitches();
while (Date.now() - start < hours * 3600e3) {
  const t0 = await frameCount();
  await page.waitForTimeout(60_000);
  const t1 = await frameCount();
  const heap = await heapMb();
  const h = await hitchReport();
  const minute = Math.round((Date.now() - start) / 60e3);
  const minuteHitches = h ? countOver(h) : 0;
  samples.push({ minute, heapMb: Math.round(heap * 10) / 10, worstMs: h ? Math.round(h.worstMs * 10) / 10 : null, hitches: minuteHitches });
  if (h) {
    hitches += minuteHitches;
    if (h.worstMs > worst.worstMs) worst = { worstMs: Math.round(h.worstMs * 10) / 10, worstFrame: h.worstFrame, minute };
    await resetHitches();
  }
  if (errors.length) failure = `page error: ${errors[0]}`;
  else if (t1 <= t0) failure = 'frame loop stalled (renderer clock did not advance for a minute)';
  else if (heap - base > budgetMb) failure = `heap grew ${Math.round(heap - base)} MB (> ${budgetMb} MB)`;
  else if (assertHitch && minuteHitches)
    failure = `${minuteHitches} frame(s) over ${hitchMs} ms (worst ${worst.worstMs} ms at frame ${worst.worstFrame}, minute ${minute})`;
  if (failure) break;
}
await close();
mkdirSync('reports/soak', { recursive: true });
const report = {
  scene,
  hours,
  budgetMb,
  hitchMs,
  assertHitch,
  baseHeapMb: Math.round(base * 10) / 10,
  samples,
  hitches,
  worstFrame: worst,
  result: failure || 'pass',
};
writeFileSync(`reports/soak/${scene}.json`, JSON.stringify(report, null, 2));
console.log(
  `soak ${scene}: ${report.result} (${samples.length} samples; worst frame ${worst.worstMs} ms at frame ${worst.worstFrame}, minute ${worst.minute}; ${hitches} hitch(es) over ${hitchMs} ms)`,
);
process.exit(failure ? 1 : 0);

/** Frames over the script's threshold: the profiler counts against its own 50 ms; a custom threshold uses the worst frame. */
function countOver(h) {
  if (hitchMs === h.hitchMs) return h.hitches;
  return h.worstMs > hitchMs ? Math.max(1, h.hitches) : 0;
}
