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
      let s = await g.boot('?preset=mid-ch1');
      expect(await g.page.evaluate(() => navigator.language)).toBe(locale);
      // Title with a campaign in progress: Continue, Take the Oath Anew, Operating Theatre, Options.
      s = await g.click(640, 390 + 60 * 3);
      expect(s.scene).toBe('options');
      s = await g.click(500, 170 + 25); // Volume: step down
      const vol = s.settings.volume as number;
      expect(vol).toBeCloseTo(0.5, 9);
      await g.key('Escape');
      const raw = await g.page.evaluate(() => [localStorage.getItem('suture-and-steel.settings'), localStorage.getItem('suture-and-steel.save')]);
      expect(raw[0]).toContain('"volume":0.5');
      expect(raw[0]).not.toMatch(/\d,\d/);
      expect(() => JSON.parse(raw[1]!)).not.toThrow();
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
