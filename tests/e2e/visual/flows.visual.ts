/**
 * QA flow screenshots (QAT-0066/0067): deterministic captures of the demo's main screens compared
 * with committed baselines. Baselines are regenerated only inside the Playwright Docker image
 * (`npm run visual:update`, or the "Visual baselines" workflow); a baseline set whose meta.json does
 * not say it came from that image is rejected, so locally rendered PNGs can never become the truth.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { describe, expect, it } from 'vitest';
import { useGame, type Game } from '../helpers';

const DIR = 'tests/e2e/visual/__baselines__';
const OUT = 'test-results/visual';
export const BASELINE_IMAGE = 'mcr.microsoft.com/playwright:v1.55.1-noble';
const UPDATE = process.env.VISUAL_UPDATE === '1';
const IN_DOCKER = process.env.QA_BASELINE_ENV === 'playwright-docker';
/** Fraction of pixels allowed to differ (anti-aliasing noise between identical environments). */
const MAX_DIFF = 0.005;

/** Seeded Math.random so cosmetic particles and motes land in the same places every run. */
const SEEDED_RANDOM = `
(() => {
  let s = 0x2f6b1a3d;
  Math.random = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

interface Meta {
  generator: string;
  image: string;
  playwright: string;
  updated: string;
}

function readMeta(): Meta | null {
  try {
    return JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as Meta;
  } catch {
    return null;
  }
}

/** Screens without a baseline yet (their captures are written to test-results/visual/). */
const missing: string[] = [];

async function capture(g: Game, name: string): Promise<void> {
  await g.api('setClock', 10);
  await g.step(1, 'last');
  const png = await g.page.screenshot();
  const baseline = `${DIR}/${name}.png`;
  if (UPDATE) {
    if (!IN_DOCKER) throw new Error('Baselines may only be regenerated inside the Playwright Docker image: npm run visual:update');
    mkdirSync(DIR, { recursive: true });
    writeFileSync(baseline, png);
    return;
  }
  mkdirSync(OUT, { recursive: true });
  const meta = readMeta();
  if (!meta || !existsSync(baseline)) {
    writeFileSync(`${OUT}/${name}.actual.png`, png);
    missing.push(name);
    return;
  }
  expect(meta.generator, 'baselines must come from the Playwright Docker image (npm run visual:update)').toBe('playwright-docker');
  expect(meta.image).toBe(BASELINE_IMAGE);
  const a = PNG.sync.read(png);
  const b = PNG.sync.read(readFileSync(baseline));
  expect([a.width, a.height], `${name} size`).toEqual([b.width, b.height]);
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  if (n / (a.width * a.height) > MAX_DIFF) {
    writeFileSync(`${OUT}/${name}.actual.png`, png);
    writeFileSync(`${OUT}/${name}.diff.png`, PNG.sync.write(diff));
  }
  expect(n / (a.width * a.height), `${name}: ${n} pixels differ (see ${OUT}/${name}.diff.png)`).toBeLessThanOrEqual(MAX_DIFF);
}

describe('flow screenshots', () => {
  const game = useGame({ initScripts: [SEEDED_RANDOM] });

  it('title, story, briefing, operation HUD, options, results and demo end match their baselines', async () => {
    const g = game();
    await g.boot();
    await g.step(90);
    await capture(g, 'title');
    await g.api('story', 'prologue', 3);
    await g.step(180);
    await capture(g, 'story-prologue');
    await g.api('operation', 'op1-1');
    await g.step(30);
    await capture(g, 'briefing-op1-1');
    await g.key('Enter');
    await g.api('skipPhase');
    await g.step(60);
    await capture(g, 'operation-op1-1');
    await g.api('title');
    await g.step(90);
    await g.click(640, 390 + 60 * 2);
    await g.step(30);
    await capture(g, 'options');
    await g.api('results', 'XS', 'op1-5');
    await g.step(180);
    await capture(g, 'results-xs');
    await g.api('demoEnd');
    await g.step(120);
    await capture(g, 'demo-end');
    if (UPDATE) {
      const { version } = JSON.parse(readFileSync('node_modules/playwright/package.json', 'utf8')) as { version: string };
      const meta: Meta = { generator: 'playwright-docker', image: BASELINE_IMAGE, playwright: version, updated: new Date().toISOString() };
      writeFileSync(`${DIR}/meta.json`, JSON.stringify(meta, null, 2) + '\n');
    }
    expect(g.errors).toEqual([]);
    expect(missing, 'No baselines yet: generate them with "npm run visual:update" (Docker) or the "Visual baselines" workflow').toEqual([]);
  });
});
