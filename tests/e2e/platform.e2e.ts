/**
 * QAT-0071 (browser part): with WebGL2 unavailable the page shows the #fatal message.
 * QAT-0113: OS-locale edge cases — under tr-TR, de-DE, pl-PL and pt-BR, settings and saves keep
 * dot decimals, hotkeys work by physical key code (no Turkish dotted/dotless i casing bugs).
 */
import { mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { useGame } from './helpers';

const NO_WEBGL2 = `
(() => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return type === 'webgl2' ? null : get.call(this, type, ...rest);
  };
})();`;

/** The raw `settings.json` and `profile.json` the game wrote to IndexedDB (waits for the queued writes). */
async function persistedFiles(g: ReturnType<ReturnType<typeof useGame>>): Promise<{ settings: string | null; profile: string | null }> {
  const read = () =>
    g.page.evaluate(
      () =>
        new Promise<Record<string, string>>((resolve, reject) => {
          const open = indexedDB.open('suture-and-steel');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const store = open.result.transaction('files', 'readonly').objectStore('files');
            const keys = store.getAllKeys();
            const values = store.getAll();
            values.onerror = () => reject(values.error);
            values.onsuccess = () => {
              const out: Record<string, string> = {};
              keys.result.forEach((k, i) => (out[String(k)] = String(values.result[i])));
              resolve(out);
            };
          };
        }),
    );
  const pick = (files: Record<string, string>, name: string) => Object.entries(files).find(([k]) => k.endsWith(`/${name}`))?.[1] ?? null;
  let files = await read();
  for (let i = 0; i < 20 && !(pick(files, 'settings.json') && pick(files, 'profile.json')); i++) {
    await g.page.waitForTimeout(250);
    files = await read();
  }
  return { settings: pick(files, 'settings.json'), profile: pick(files, 'profile.json') };
}

describe('no WebGL2', () => {
  const game = useGame({ initScripts: [NO_WEBGL2] });

  it('shows the fatal message instead of a blank page', async () => {
    const g = game();
    await g.page.goto(g.url);
    const fatal = g.page.locator('#fatal');
    await fatal.waitFor({ timeout: 20_000 });
    expect(await fatal.textContent()).toMatch(/needs WebGL2 and could not start/);
    expect(await g.page.locator('canvas#game').count()).toBe(0);
    mkdirSync('test-results/e2e', { recursive: true });
    await g.page.screenshot({ path: 'test-results/e2e/no-webgl2.png' });
  });
});

for (const locale of ['tr-TR', 'de-DE', 'pl-PL', 'pt-BR']) {
  describe(`OS locale ${locale}`, () => {
    const game = useGame({ locale });

    it('keeps dot decimals in settings and saves, and hotkeys work by key code', async () => {
      const g = game();
      await g.boot('?preset=mid-ch1');
      expect(await g.page.evaluate(() => navigator.language)).toBe(locale);
      let s = await g.clickNode('options');
      expect(s.scene).toBe('options');
      // Volume (default 0.6): find its tab and row, hover the row and step it down once.
      const where = await g.api<{ tab: string; index: number } | null>('optionLocate', 'volume');
      expect(where).not.toBeNull();
      await g.clickNode(`tab.${where!.tab}`);
      await g.step(1, 'all');
      const row = (await g.api<{ x: number; y: number; w: number; h: number } | null>('nodeRect', `row${where!.index}`))!;
      await g.page.mouse.move(row.x + row.w / 2, row.y + row.h / 2);
      await g.step(1, 'all');
      s = await g.key('ArrowLeft');
      const vol = s.settings.volume as number;
      expect(vol).toBeCloseTo(0.5, 9);
      await g.key('Escape');
      // The web build persists settings.json and profile.json in IndexedDB (PLT-0079): read the raw files back.
      const raw = await persistedFiles(g);
      expect(raw.settings).toContain('"volume":0.5');
      expect(raw.settings).not.toMatch(/\d,\d/);
      expect(() => JSON.parse(raw.profile!)).not.toThrow();
      s = await g.reload();
      expect(s.settings.volume).toBe(vol);
      expect(s.save.progress.chapter).toBe(0);

      await g.api('operation', 'op1-5', true);
      await g.step(1);
      s = await g.key('Digit7');
      expect(s.op?.tool).toBe('brand');
      s = await g.key('KeyE');
      expect(s.op?.tool).toBe('lancet');
      s = await g.key('KeyQ');
      expect(s.op?.tool).toBe('brand');
      s = await g.key('KeyI'); // no tool on I: nothing changes under any casing rule
      expect(s.op?.tool).toBe('brand');
      expect(g.errors).toEqual([]);
    });
  });
}
