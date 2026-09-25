/** ART-0035: masters are resized to ship size, trimmed, compressed and recorded with size, hash and atlas page. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runExport, type Manifest } from '../../../scripts/lib/artExport.ts';

const root = mkdtempSync(join(tmpdir(), 'art-export-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A 2× master: an opaque block (40×20 on a 64² canvas) inside a transparent border. */
async function master(path: string, w = 64, h = 64, red = 200): Promise<void> {
  const px = Buffer.alloc(w * h * 4);
  for (let y = Math.round(h * 0.19); y < Math.round(h * 0.5); y++)
    for (let x = Math.round(w * 0.125); x < Math.round(w * 0.75); x++) px.set([red, 40, 30, 255], (y * w + x) * 4);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    await sharp(px, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer(),
  );
}

describe('ART-0035 art:export', () => {
  it('exports sprites at ship size, trimmed, with a manifest of size, hash and atlas page', async () => {
    await master(join(root, 'art-src/export/sprites/fx/drip-1.png'));
    await master(join(root, 'art-src/export/backdrops/ch1-test-night.png'), 128, 72);
    const { manifest, problems } = await runExport(root);
    expect(problems).toEqual([]);
    const sprite = manifest.entries['sprites/fx/drip-1.png'];
    // 64² master at 2× → 32² ship; the block is 20×10 after resizing (plus the filter's soft fringe,
    // which trimming keeps), and the transparent border is gone.
    expect(sprite.trim).toMatchObject({ fullW: 32, fullH: 32 });
    expect([sprite.w, sprite.h]).toEqual([sprite.trim!.w, sprite.trim!.h]);
    expect(sprite.w).toBeGreaterThanOrEqual(20);
    expect(sprite.w).toBeLessThan(32);
    expect(sprite.h).toBeLessThan(20);
    expect(sprite.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(sprite.atlas).toEqual({ sheet: 'fx', frame: 'fx/drip-1', page: 0 });
    const bd = manifest.entries['backdrops/ch1-test-night.webp'];
    expect([bd.w, bd.h]).toEqual([64, 36]);
    expect(bd.trim).toBeUndefined();
    const onDisk = JSON.parse(readFileSync(join(root, 'assets/manifest.json'), 'utf8')) as Manifest;
    expect(onDisk.entries['sprites/fx/drip-1.png'].bytes).toBe(readFileSync(join(root, 'assets/sprites/fx/drip-1.png')).length);
  });

  it('--check passes when current and flags a changed master', async () => {
    expect((await runExport(root, { check: true })).problems).toEqual([]);
    await master(join(root, 'art-src/export/sprites/fx/drip-1.png'), 96, 96, 120);
    expect((await runExport(root, { check: true })).problems.join()).toMatch(/drip-1\.png: stale/);
  });

  it('refuses names outside the convention and exports that would shrink', async () => {
    await master(join(root, 'art-src/export/ui/Bad_Name.png'));
    expect((await runExport(root, { check: true })).problems.join()).toMatch(/naming convention/);
    rmSync(join(root, 'art-src/export/ui'), { recursive: true });
    await runExport(root); // the 96² master is the new, larger export
    await master(join(root, 'art-src/export/sprites/fx/drip-1.png'), 32, 32);
    expect((await runExport(root)).problems.join()).toMatch(/would shrink/);
  });
});
