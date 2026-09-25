/**
 * UIX-0024: no player-facing text below 16 px (virtual). Dev-only overlays are exempt, and so are
 * tracked all-caps display labels (Cinzel with `tracking`) down to 12 px: capitals carry no
 * x-height, so 12 px caps stand as tall as the lowercase of 16 px body text.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../../src');
const DIRS = ['scenes', 'ui', 'input', 'audio'];
/** Dev/QA-only drawing: debug overlays and look-dev pages. */
const DEV = [/debug-overlay\.ts:/, /gameplayHud\.ts:.*(constructor\.name|#b0ffb0)/];

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.ts') ? [join(d, f)] : []));

describe('UIX-0024 minimum text size', () => {
  it('every literal text size in the UI is at least 16 px', () => {
    const small: string[] = [];
    for (const f of DIRS.flatMap((d) => walk(join(ROOT, d)))) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const where = `${f.slice(ROOT.length + 1)}:${i + 1}`;
          if (
            /\bsize: ?(1[0-5]|[0-9])(\.\d+)?[,} ]/.test(line) &&
            /\.text\(|textBlock\(|fitText\(|fitBlock\(/.test(line) &&
            !DEV.some((re) => re.test(`${f}:${line}`)) &&
            !(/font: 'display'/.test(line) && /tracking:/.test(line) && /\bsize: ?1[2-5]\b/.test(line))
          )
            small.push(where);
        });
    }
    expect(small).toEqual([]);
  });
});
