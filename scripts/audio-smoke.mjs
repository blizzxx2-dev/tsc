// Audio smoke test in a real browser: boots the built game, unlocks audio, walks
// title → briefing → operation, and reports bus peaks, snapshots, music state,
// fallback plays and page errors at each step. The game loop is stepped by hand
// (update + audio director, no rendering) so it runs at real time even where
// WebGL is software-rendered.
// Usage: npx vite build && node scripts/audio-smoke.mjs [opId] [outDir]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const [opId = 'op1-5', out = 'shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('favicon.ico') && errors.push(`${r.status()} ${r.url()}`));

/** Step the game (no rendering) for `s` seconds of real time; returns max bus peaks (dBFS) seen. */
const run = (s, fn) =>
  page.evaluate(
    async ([s, fn]) => {
      const g = window.__game;
      const e = g.audio.engine;
      const peaks = {};
      const t0 = performance.now();
      let last = t0;
      if (fn) new Function('g', fn)(g);
      while (performance.now() - t0 < s * 1000) {
        await new Promise((r) => setTimeout(r, 16));
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        g.input.beginFrame();
        g.scene.update(dt, g);
        g.sceneAudio.frame(g.scene, dt, g.input);
        g.input.endFrame();
        for (const b of ['music', 'world', 'hud', 'ui', 'ambience']) {
          const m = e.meter(b);
          peaks[b] = Math.max(peaks[b] ?? -120, Math.round(20 * Math.log10(Math.max(1e-6, m.peak))));
        }
      }
      const a = g.audio;
      const op = g.scene.op;
      return {
        scene: a.kind,
        status: op ? op.status : '-',
        vitals: op ? Math.round(op.vitals) : '-',
        peaks,
        snaps: e.snapshots.list().join('>'),
        music: `${a.music.state}/${a.music.track?.theme.id ?? '-'}/${a.music.section ?? '-'}`,
        amb: a.amb.current,
        voices: e.voices.count(),
        loops: e.activeLoops,
        fallback: e.fallbackPlays,
        captions: e.captions.items.map((c) => c.text),
        last: e.log.slice(-10).map((x) => x.id),
      };
    },
    [s, fn],
  );

const log = (k, v) => console.log(k.padEnd(10), JSON.stringify(v));
try {
  await page.goto(url);
  await page.waitForTimeout(500);
  await page.mouse.click(640, 700);
  log('title', await run(3, 'g.audio.engine.prefs.captions = true;'));
  await page.goto(`${url}?op=${opId}`);
  await page.waitForTimeout(500);
  await page.mouse.click(640, 700);
  log('briefing', await run(2, 'g.audio.engine.prefs.captions = true;'));
  log('op-intro', await run(2, "g.scene.onBegin();"));
  log('running', await run(4));
  log('low', await run(4, 'g.scene.op.vitals = 25;'));
  // Screenshot the overlays: captions, visual heartbeat (heartbeat audio off) and the F4 debug panel.
  await run(1, "g.audio.engine.prefs.heartbeat = 'off'; g.sceneAudio.debug = true;");
  await page.evaluate(() => {
    const g = window.__game;
    g.scene.render(g.gfx, g);
    g.sceneAudio.overlay(g.gfx);
  });
  await page.screenshot({ path: `${out}/audio-overlays.png` });
  await run(0.1, "g.audio.engine.prefs.heartbeat = 'low'; g.sceneAudio.debug = false;");
  log('litany', await run(3, 'g.scene.op.invokeLitany();'));
  log('paused', await run(1.5, 'g.scene.paused = true;'));
  log('resumed', await run(1, 'g.scene.paused = false;'));
  log('lost', await run(3, "g.scene.op.lose('The patient has died.');"));
  log('report', await page.evaluate(() => window.__game.audio.devReport().fallbackIds));
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(errors.length ? 1 : 0);
