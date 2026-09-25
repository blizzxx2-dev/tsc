// One operation screenshot at a given sim time (replaces the old hard-coded scripts/.one.mjs).
// Usage: npm run build:qa && npm run shot -- <op-id> <seconds> <out.png>
//   e.g. npm run shot -- op1-5 12 shots/op1-5-12s.png
// The operation is opened through the debug API, its intro skipped, then the simulation is advanced
// `seconds` (no input) and one frame is drawn. Browser: $CHROMIUM or Playwright's bundled Chromium.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { launchGame, waitForDebug } from './qa/launch.mjs';

const [id, secondsArg, outFile] = process.argv.slice(2);
if (!id || !outFile) {
  console.error('usage: npm run shot -- <op-id> <seconds> <out.png>');
  process.exit(2);
}
const seconds = Number(secondsArg ?? 0);
if (!Number.isFinite(seconds) || seconds < 0) {
  console.error(`seconds must be a non-negative number, got ${secondsArg}`);
  process.exit(2);
}
mkdirSync(dirname(outFile), { recursive: true });

const { page, url, errors, close } = await launchGame();
let code = 0;
try {
  await page.goto(url);
  await waitForDebug(page);
  await page.evaluate(
    ([opId, s]) => {
      const d = window.__game.debug;
      d.freeze();
      d.operation(opId, true);
      d.skipPhase(); // intro
      d.simulate(s);
      d.step(1, { render: 'last' });
    },
    [id, seconds],
  );
  await page.screenshot({ path: outFile });
  console.log(`wrote ${outFile}`);
} catch (err) {
  console.error(String(err));
  code = 1;
} finally {
  if (errors.length) {
    console.error(errors.join('\n'));
    code = 1;
  }
  await close();
}
process.exit(code);
