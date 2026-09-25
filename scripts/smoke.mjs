// Smoke test: boots the QA build in headless Chromium (WebGL2 via SwiftShader), walks
// title → story → briefing → operation, stitches op1-1 with real mouse gestures, opens every
// Chapter 1–2 operation, fights both Malisons (Matins, Lauds) to a win and the results screen,
// and saves screenshots. It drives the game only through the stable debug API
// (window.__game.debug): the loop is frozen and advanced frame by frame, so every wait is on game
// state, never on wall-clock sleeps, and software rendering happens only for screenshots.
// Exits 1 on any page/console error, failed check or after 90 s.
// Usage: npm run build:qa && node scripts/smoke.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launchGame, waitForDebug } from './qa/launch.mjs';

const out = process.argv[2] ?? 'shots';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 90_000);
const OPS = ['op1-1', 'op1-2', 'op1-3', 'op1-4', 'op1-5', 'op2-1', 'op2-2', 'op2-3', 'op2-4', 'op2-5'];
const VERBOSE = !!process.env.SMOKE_VERBOSE;
mkdirSync(out, { recursive: true });

const t0 = Date.now();
const killer = setTimeout(() => {
  console.error(`SMOKE FAILED: global timeout of ${TIMEOUT_MS / 1000}s exceeded`);
  process.exit(1);
}, TIMEOUT_MS);

const { page, url, errors, close } = await launchGame();
const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
};
const log = (msg) => VERBOSE && console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${msg}`);

/** Call a debug API method in the page. */
const api = (method, ...args) => page.evaluate(([m, a]) => window.__game.debug[m](...a), [method, args]);
/** Run whole frames (input → update → render only on the last unless told otherwise). */
const step = (n = 1, render = 'none') => api('step', n, { render });
const state = () => api('state');
const shot = async (name) => {
  await step(1, 'last');
  await page.screenshot({ path: `${out}/${name}.png` });
  log(`shot ${name}`);
};

/** Step frames until `pred(state)` holds (checked every `chunk` frames). */
async function until(what, pred, maxFrames = 600, chunk = 10) {
  for (let i = 0; i < maxFrames; i += chunk) {
    const s = await step(chunk);
    if (pred(s)) return s;
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Open an operation (briefing → Enter → operation) and run its intro. */
async function openOp(id) {
  await api('operation', id);
  await step(1);
  await page.keyboard.press('Enter');
  const s = await until(`${id} to start`, (st) => st.scene === 'operation' && st.op?.id === id, 5, 1);
  await api('skipPhase'); // the 1.2 s intro
  const r = await state();
  check(r.op?.status === 'running' && r.op.phase === 0, `${id}: expected running phase 0, got ${r.op?.status} ${r.op?.phase}`);
  return s;
}

let code = 0;
try {
  await page.goto(url);
  await waitForDebug(page);
  await api('freeze');
  let s = await state();
  check(s.scene === 'title', `boot: expected title, got ${s.scene}`);
  await shot('01-title');

  await page.mouse.click(640, 390); // Take the Oath (buttons are handled while drawing)
  s = await step(1, 'all');
  check(s.scene === 'story' && s.story?.id === 'prologue', `new game: expected the prologue, got ${s.scene} ${s.story?.id}`);
  await page.keyboard.press('Space');
  await step(1);
  await page.keyboard.press('Space');
  s = await step(1);
  check(s.story?.line === 1, `story: Space should reveal then advance a line (line ${s.story?.line})`);
  await shot('02-story');

  // op1-1: stitch every laceration with a real zig-zag drag, as a player would.
  await api('operation', 'op1-1');
  await shot('03-briefing');
  await openOp('op1-1');
  await shot('04-op1-1-start');
  s = await state();
  await page.keyboard.press('Digit4'); // Gut Thread (already the first tool in op1-1's tray)
  await step(1);
  for (const e of s.op.entities.filter((x) => x.kind === 'Laceration')) {
    const dx = e.b.x - e.a.x;
    const dy = e.b.y - e.a.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    await page.mouse.move(e.a.x + nx * 25, e.a.y + ny * 25);
    await step(1);
    await page.mouse.down();
    await step(1);
    const crossings = e.stitches.needed * 2;
    for (let i = 1; i <= crossings; i++) {
      const t = 0.04 + (i / crossings) * 0.92;
      const side = i % 2 ? -25 : 25;
      await page.mouse.move(e.a.x + dx * t + nx * side, e.a.y + dy * t + ny * side, { steps: 4 });
      await step(1);
    }
    await page.mouse.up();
    await step(1);
  }
  s = await until('op1-1 phase 2', (st) => st.op.phase >= 1);
  check(s.op.counts.cool + s.op.counts.good >= 2, `op1-1: stitching earned ${JSON.stringify(s.op.counts)}`);
  console.log('op1-1 after stitching:', JSON.stringify({ phase: s.op.phase, score: s.op.score, counts: s.op.counts }));
  await shot('05-op1-1-stitched');

  // Every Chapter 1–2 operation opens and runs its first phase.
  for (const id of OPS.slice(1)) {
    await openOp(id);
    s = await step(90);
    check(s.op.status === 'running', `${id}: ${s.op.status} 1.5 s into phase 1`);
    await shot(`op-${id}`);
  }

  // Both Malisons: reach the boss, let it act, clear the operation and reach the results.
  for (const [id, kind, name] of [
    ['op1-5', 'Malison', 'matins'],
    ['op2-5', 'LaudsMalison', 'lauds'],
  ]) {
    await openOp(id);
    for (let i = 0; i < 8 && !(await state()).op.entities.some((e) => e.kind === kind); i++) await api('skipPhase');
    s = await step(240);
    check(
      s.op.entities.some((e) => e.kind === kind),
      `${id}: the ${name} Malison never appeared`,
    );
    check(s.op.status === 'running', `${id}: ${s.op.status} after 4 s with the ${name} boss`);
    await shot(`op-${name}`);
    await api('win');
    s = await until(`${id} results`, (st) => st.scene === 'results', 400, 20);
    await shot(`results-${name}`);
  }
} catch (err) {
  failures.push(`exception: ${err?.stack ?? err}`);
} finally {
  await close();
  clearTimeout(killer);
  const all = [...errors, ...failures];
  if (all.length) {
    console.error(`SMOKE FAILED (${all.length}):\n${all.join('\n')}`);
    code = 1;
  } else console.log(`smoke passed in ${((Date.now() - t0) / 1000).toFixed(1)}s — no page errors`);
}
process.exit(code);
