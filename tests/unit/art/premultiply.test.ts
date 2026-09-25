/** ART-0037: atlas pages are exported premultiplied and flagged so the renderer filters them that way. */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blank, buildAtlas, premultiply } from '../../../scripts/lib/atlas.ts';
import { packSheetDir } from '../../../scripts/lib/sheets.ts';
import { BATCH_FS } from '../../../src/render/batch-shaders';

describe('ART-0037 premultiplied atlas export', () => {
  it('scales colour by coverage and leaves opaque texels alone', () => {
    const img = blank(2, 1);
    img.data.set([200, 100, 50, 128, 10, 20, 30, 255]);
    premultiply(img);
    expect([...img.data]).toEqual([100, 50, 25, 128, 10, 20, 30, 255]);
  });

  it('every atlased sprite page is premultiplied (no colour where there is no coverage)', () => {
    const root = join(__dirname, '../../../assets/sprites');
    for (const sheet of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const { json } = packSheetDir(join(root, sheet.name), sheet.name);
      expect(json.premultiplied).toBe(true);
    }
    const src = blank(4, 4);
    for (let i = 0; i < 16; i++) src.data.set([255, 255, 255, i * 16], i * 4);
    const { pages } = buildAtlas('t', [{ id: 'a', img: src }]);
    const d = pages[0].data;
    for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) expect(d[i + c]).toBeLessThanOrEqual(d[i + 3]);
  });

  it('the batch shader un-premultiplies flagged units after filtering', () => {
    expect(BATCH_FS).toMatch(/u_pm/);
    expect(BATCH_FS).toMatch(/t\.rgb \/= max\(t\.a/);
  });
});
