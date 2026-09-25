import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AssetLoader, type LoaderBackend } from '../src/assets/loader';
import { BUNDLES, MANIFEST } from '../src/assets/manifest.gen';
import type { AssetEntry } from '../src/assets/types';
import { AnimPlayer } from '../src/render/sprites';
import { buildAtlas, blank, decodePng, encodePng, type Img } from '../scripts/lib/atlas.ts';
import { noOverlap, packRects } from '../scripts/lib/maxrects.ts';

const man: Record<string, AssetEntry> = {
  'backdrops/a': { type: 'image', url: 'assets/a.png', bytes: 10, bundle: 'chapter1', hash: 'x' },
  'backdrops/b': { type: 'image', url: 'assets/b.png', bytes: 10, bundle: 'chapter1', hash: 'x' },
  'audio/c': { type: 'audio', url: 'assets/c.ogg', bytes: 10, bundle: 'chapter1', hash: 'x' },
  'backdrops/broken': { type: 'image', url: 'assets/missing.png', bytes: 10, bundle: 'chapter2', hash: 'x' },
};
const bundles = { chapter1: ['backdrops/a', 'backdrops/b', 'audio/c'], chapter2: ['backdrops/broken', 'backdrops/a'] };

function backend() {
  const log = { fetches: [] as string[], disposed: [] as string[], warnings: [] as string[] };
  const be: LoaderBackend = {
    fetchBytes: async (url) => {
      log.fetches.push(url);
      await new Promise((r) => setTimeout(r, 1));
      if (url.includes('missing')) throw new Error('404');
      return new ArrayBuffer(4);
    },
    image: async (id) => ({ value: `tex:${id}`, dispose: () => log.disposed.push(id) }),
    missingImage: (id) => ({ value: `checker:${id}`, dispose: () => log.disposed.push(`checker:${id}`) }),
    sheet: async () => ({ value: null }),
    font: async () => ({ value: null }),
    warn: (m) => log.warnings.push(m),
  };
  return { be, log };
}

describe('asset loader (ENG-0210/0211/0212)', () => {
  it('de-duplicates concurrent loads and reference-counts releases', async () => {
    const { be, log } = backend();
    const L = new AssetLoader(be, '/', man, bundles);
    const [a1, a2] = await Promise.all([L.load('backdrops/a' as never), L.load('backdrops/a' as never)]);
    expect(a1).toBe(a2);
    expect(log.fetches).toEqual(['/assets/a.png']);
    expect(L.refCount('backdrops/a' as never)).toBe(2);
    L.release('backdrops/a' as never);
    expect(log.disposed).toEqual([]);
    L.release('backdrops/a' as never);
    expect(log.disposed).toEqual(['backdrops/a']);
    expect(L.residentCount).toBe(0);
  });

  it('failed assets resolve to a fallback with a warning, never an exception', async () => {
    const { be, log } = backend();
    const L = new AssetLoader(be, '/', man, bundles);
    const a = await L.load('backdrops/broken' as never);
    expect(a.fallback).toBe(true);
    expect(a.value).toBe('checker:backdrops/broken');
    expect(log.warnings[0]).toContain('backdrops/broken');
    const missing = await L.load('nope' as never);
    expect(missing.fallback).toBe(true);
  });

  it('bundles load with progress, share assets, and unload only what nothing else holds', async () => {
    const { be, log } = backend();
    const L = new AssetLoader(be, '/', man, bundles);
    const progress: string[] = [];
    await L.loadBundle('chapter1' as never, (n, t) => progress.push(`${n}/${t}`));
    expect(progress[0]).toBe('0/3');
    expect(progress[progress.length - 1]).toBe('3/3');
    expect(L.isResident('chapter1' as never)).toBe(true);
    await L.loadBundle('chapter2' as never);
    L.unloadBundle('chapter1' as never);
    // backdrops/a is still held by chapter2.
    expect(log.disposed).toEqual(['backdrops/b']);
    expect(L.get('audio/c' as never)).toBeUndefined();
    expect(L.get('backdrops/a' as never)).toBeDefined();
    L.unloadBundle('chapter2' as never);
    expect(log.disposed).toContain('backdrops/a');
    expect(L.residentCount).toBe(0);
  });

  it('the generated manifest covers the boot fonts and the fx sprite sheet', () => {
    expect(BUNDLES.boot.filter((id) => MANIFEST[id].type === 'font').length).toBe(3);
    expect(MANIFEST['sprites/fx'].pages!.length).toBeGreaterThan(0);
    for (const e of Object.values(MANIFEST) as AssetEntry[]) expect(e.url).toMatch(/^assets\/.+\.[0-9a-f]{10}\.\w+$/);
  });
});

function img(w: number, h: number, seed: number): Img {
  const im = blank(w, h);
  for (let i = 0; i < im.data.length; i++) im.data[i] = (i * 31 + seed * 17) & 255;
  return im;
}

describe('atlas packer (ENG-0033)', () => {
  it('MaxRects packs without overlap into multiple pages when needed', () => {
    const items = Array.from({ length: 120 }, (_, i) => ({ id: `f${i}`, w: 20 + ((i * 37) % 180), h: 16 + ((i * 53) % 150) }));
    const { placements, pages } = packRects(items, 512, 2);
    expect(pages).toBeGreaterThan(1);
    expect(noOverlap(placements, 2)).toBe(true);
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(2);
      expect(p.x + p.w).toBeLessThanOrEqual(510);
    }
  });

  it('output is byte-identical for identical input regardless of order, with extruded borders', () => {
    const frames = [
      { id: 'a', img: img(30, 20, 1) },
      { id: 'b', img: img(64, 64, 2) },
      { id: 'c', img: img(10, 50, 3) },
    ];
    const one = buildAtlas('fx', frames);
    const two = buildAtlas('fx', [...frames].reverse());
    expect(encodePng(two.pages[0]).equals(encodePng(one.pages[0]))).toBe(true);
    expect(JSON.stringify(two.json)).toBe(JSON.stringify(one.json));
    const page = one.pages[0];
    expect(page.w & (page.w - 1)).toBe(0);
    // Extrusion: the pixel left of frame 'a' repeats its first column.
    const f = one.json.frames['fx/a'];
    const at = (x: number, y: number) => Array.from(page.data.slice((y * page.w + x) * 4, (y * page.w + x) * 4 + 4));
    expect(at(f.x - 1, f.y)).toEqual(at(f.x, f.y));
    expect(at(f.x - 2, f.y + 3)).toEqual(at(f.x, f.y + 3));
    // PNG round-trip.
    const back = decodePng(encodePng(page));
    expect(Buffer.from(back.data).equals(Buffer.from(page.data))).toBe(true);
  });

  it('the checked-in fx sheet packs the ENG-0110 brushes', () => {
    const sheetFile = MANIFEST['sprites/fx'].url.replace(/^assets\//, 'public/assets/');
    const json = JSON.parse(readFileSync(sheetFile, 'utf8'));
    for (const b of ['soft-round', 'splatter-1', 'splatter-2', 'splatter-3', 'splatter-4', 'drag-streak', 'scorch', 'stitch-mark', 'erase']) expect(json.frames[`fx/${b}`]).toBeDefined();
  });
});

describe('AnimPlayer (ENG-0034)', () => {
  const def = (mode: 'loop' | 'once' | 'pingpong') => ({ frames: ['a', 'b', 'c'], ms: [100, 50, 100], mode });

  it('loop honours per-frame durations and fires completion each cycle', () => {
    let done = 0;
    const p = new AnimPlayer(def('loop'), () => done++);
    const seq: string[] = [];
    for (let i = 0; i < 25; i++) {
      seq.push(p.frame);
      p.update(0.025);
    }
    expect(seq.slice(0, 11).join('')).toBe('aaaabbcccca');
    expect(done).toBe(2);
  });

  it('once stops on the last frame and fires once', () => {
    let done = 0;
    const p = new AnimPlayer(def('once'), () => done++);
    p.update(1);
    expect(p.frame).toBe('c');
    expect(p.done).toBe(true);
    p.update(1);
    expect(done).toBe(1);
  });

  it('ping-pong reverses at both ends', () => {
    const p = new AnimPlayer({ frames: ['a', 'b', 'c'], ms: [10, 10, 10], mode: 'pingpong' });
    const seq: string[] = [];
    for (let i = 0; i < 6; i++) {
      seq.push(p.frame);
      p.update(0.01);
    }
    expect(seq.join('')).toBe('abcbab');
  });
});
