// Idle soak driver (QAT-0144): parks the QA build on a scene for hours and samples memory every minute.
// Fails on a page error, a stalled frame loop, or JS heap growth beyond the budget (default 50 MB).
// Usage: node scripts/qa/soak.mjs <title|paused-op|demo-end> <hours> [--budget-mb 50]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchGame, waitForDebug } from './launch.mjs';

const [scene = 'title', hoursArg = '8'] = process.argv.slice(2);
const bIdx = process.argv.indexOf('--budget-mb');
const budgetMb = bIdx > 0 ? Number(process.argv[bIdx + 1]) : 50;
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

const samples = [];
const start = Date.now();
let failure = '';
await page.waitForTimeout(10_000);
const base = await heapMb();
while (Date.now() - start < hours * 3600e3) {
  const t0 = await frameCount();
  await page.waitForTimeout(60_000);
  const t1 = await frameCount();
  const heap = await heapMb();
  samples.push({ minute: Math.round((Date.now() - start) / 60e3), heapMb: Math.round(heap * 10) / 10 });
  if (errors.length) failure = `page error: ${errors[0]}`;
  else if (t1 <= t0) failure = 'frame loop stalled (renderer clock did not advance for a minute)';
  else if (heap - base > budgetMb) failure = `heap grew ${Math.round(heap - base)} MB (> ${budgetMb} MB)`;
  if (failure) break;
}
await close();
mkdirSync('reports/soak', { recursive: true });
const report = { scene, hours, budgetMb, baseHeapMb: Math.round(base * 10) / 10, samples, result: failure || 'pass' };
writeFileSync(`reports/soak/${scene}.json`, JSON.stringify(report, null, 2));
console.log(`soak ${scene}: ${report.result} (${samples.length} samples)`);
process.exit(failure ? 1 : 0);
