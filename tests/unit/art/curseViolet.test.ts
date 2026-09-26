/**
 * ART-0012: curse-violet (the #b060ff family) is reserved for the Malison and the Hollow Choir.
 * Any violet-family hex in src/ must sit in curse content: the boss modules, the Malison and Lauds,
 * the colour-token tables, or a line marked `curse-violet:` with a reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../../src');
const ALLOWED = [
  /surgery[\\/]bosses[\\/]/,
  /surgery[\\/]malison\.ts$/,
  /surgery[\\/]lauds\.ts$/,
  // Their drawing, moved out of the simulation (GAM-0012): the boss and Malison drawers.
  /render[\\/]surgery[\\/](alphaElites|base|bossHud|bossRing|compline|elites|lauds|malison|none|office|prime|sext|terce|vespers|voices)\.ts$/,
  /ui[\\/](layout|theme)\.ts$/,
  /render[\\/]shaders[\\/]creature\.ts$/,
  /content[\\/]characters\.ts$/,
  /render[\\/]palette\.ts$/,
  // The Hours' Book-of-Hours miniatures are Malison content (ART-0234…0262).
  /art[\\/]hourMiniatures\.ts$/,
];

/** Hue 255–295°, saturated, mid-to-light: the curse-violet family. */
export function isCurseViolet(hex: string): boolean {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return false;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h >= 255 && h <= 295 && s >= 0.55 && l >= 0.45 && l <= 0.85;
}

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.ts$/.test(f) ? [join(d, f)] : []));

describe('ART-0012 curse-violet is reserved', () => {
  it('the detector recognises the family and nothing else', () => {
    expect(isCurseViolet('#b060ff')).toBe(true);
    expect(isCurseViolet('#c060ff')).toBe(true);
    expect(isCurseViolet('#b478ff')).toBe(true);
    expect(isCurseViolet('#8a1016')).toBe(false);
    expect(isCurseViolet('#9ec8ff')).toBe(false);
    expect(isCurseViolet('#2a2630')).toBe(false);
  });

  it('only curse content uses it', () => {
    const offenders: string[] = [];
    for (const f of walk(ROOT)) {
      if (ALLOWED.some((re) => re.test(f))) continue;
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.includes('curse-violet:')) return;
          for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (isCurseViolet(m[0])) offenders.push(`${f.slice(ROOT.length + 1)}:${i + 1} ${m[0]}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
