// Runs the localisation CI checks as part of the test suite, so `npx vitest run` (and therefore CI)
// fails on missing keys, hard-coded UI text, invalid locale files, uncovered glyphs or overflowing text
// in any shipped locale.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const run = (script: string, ...args: string[]) => execFileSync(process.execPath, [join(ROOT, 'scripts/i18n', script), ...args], { cwd: ROOT, encoding: 'utf8' });

describe('i18n CI scripts', () => {
  it('i18n:check — every key exists, no hard-coded draw text, sim text is keyed', async () => {
    const { scan } = await import('../scripts/i18n/check-keys.mjs');
    const r = scan();
    expect(r.missing).toEqual([]);
    expect(r.hardcoded).toEqual([]);
    expect(r.simUntranslatable).toEqual([]);
    expect(r.unused).toEqual([]);
  });

  it('i18n:validate passes', () => {
    expect(run('validate.mjs')).toContain('OK');
  }, 30_000);

  it('i18n:glyphs passes for shipped locales', () => {
    expect(run('glyphs.mjs')).toMatch(/^en\s+ok/m);
  }, 30_000);

  it('i18n:widths passes for shipped locales', () => {
    expect(run('widths.mjs')).toMatch(/^en\s+ok/m);
  }, 30_000);
});
