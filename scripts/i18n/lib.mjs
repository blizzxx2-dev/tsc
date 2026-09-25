// Shared helpers for the localisation scripts (scripts/i18n/*.mjs).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const STRINGS_DIR = join(ROOT, 'src/i18n/strings');

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Locale tables on disk: { code: messages } (metadata keys starting with '@' removed). */
export function localeTables() {
  const out = {};
  for (const f of readdirSync(STRINGS_DIR)) {
    if (!f.endsWith('.json') || f.endsWith('.meta.json')) continue;
    out[f.slice(0, -5)] = readJson(join(STRINGS_DIR, f));
  }
  return out;
}

export const messagesOf = (table) => Object.fromEntries(Object.entries(table).filter(([k]) => !k.startsWith('@')));

/**
 * Import a TypeScript module from src/ by bundling it with esbuild (a Vite
 * dependency) into node_modules/.cache. Only modules that avoid Vite-only APIs
 * (import.meta.glob) can be loaded this way.
 */
export async function loadTs(entry) {
  const { build } = await import('esbuild');
  const outdir = join(ROOT, 'node_modules/.cache/i18n-scripts');
  mkdirSync(outdir, { recursive: true });
  const r = await build({ entryPoints: [join(ROOT, entry)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error' });
  const code = r.outputFiles[0].text;
  // The bundle is named by its content: a changed source is a fresh module, an unchanged one the
  // cached module. (A `?t=` cache-buster on the import would stop Vitest treating the file as an
  // external dependency, which breaks when node_modules is a symlink outside the checkout.)
  const base = entry.replace(/[^\w]+/g, '_');
  const outfile = join(outdir, `${base}.${createHash('sha1').update(code).digest('hex').slice(0, 12)}.mjs`);
  if (!existsSync(outfile)) {
    for (const f of readdirSync(outdir)) if (f.startsWith(`${base}.`) && f.endsWith('.mjs')) unlinkSync(join(outdir, f));
    writeFileSync(outfile, code);
  }
  return import(pathToFileURL(outfile).href);
}

// ------------------------------------------------------------------ WOFF / OpenType

/** Decode a WOFF 1.0 (zlib) or bare TTF/OTF file into { tag: Buffer } tables. */
export function readFontTables(file) {
  const buf = readFileSync(file);
  const sig = buf.toString('latin1', 0, 4);
  const tables = {};
  if (sig === 'wOFF') {
    const num = buf.readUInt16BE(12);
    for (let i = 0; i < num; i++) {
      const o = 44 + i * 20;
      const tag = buf.toString('latin1', o, o + 4);
      const off = buf.readUInt32BE(o + 4);
      const comp = buf.readUInt32BE(o + 8);
      const orig = buf.readUInt32BE(o + 12);
      const raw = buf.subarray(off, off + comp);
      tables[tag] = comp < orig ? inflateSync(raw) : raw;
    }
    return tables;
  }
  if (sig === 'wOF2') throw new Error(`${file}: WOFF2 is not supported by the glyph tools; point them at the .woff/.ttf file`);
  const num = buf.readUInt16BE(4);
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    const tag = buf.toString('latin1', o, o + 4);
    tables[tag] = buf.subarray(buf.readUInt32BE(o + 8), buf.readUInt32BE(o + 8) + buf.readUInt32BE(o + 12));
  }
  return tables;
}

/** Unicode code point → glyph id, from the best cmap subtable (format 12 or 4). */
export function readCmap(cmap) {
  const n = cmap.readUInt16BE(2);
  const subs = [];
  for (let i = 0; i < n; i++) {
    const o = 4 + i * 8;
    subs.push({ pid: cmap.readUInt16BE(o), eid: cmap.readUInt16BE(o + 2), off: cmap.readUInt32BE(o + 4) });
  }
  const rank = (s) => {
    const fmt = cmap.readUInt16BE(s.off);
    if (fmt === 12) return 3;
    if (fmt === 4 && (s.pid === 3 || s.pid === 0)) return 2;
    return 0;
  };
  const best = subs.sort((a, b) => rank(b) - rank(a))[0];
  const map = new Map();
  if (!best || rank(best) === 0) return map;
  const o = best.off;
  const fmt = cmap.readUInt16BE(o);
  if (fmt === 12) {
    const groups = cmap.readUInt32BE(o + 12);
    for (let g = 0; g < groups; g++) {
      const p = o + 16 + g * 12;
      const start = cmap.readUInt32BE(p);
      const end = cmap.readUInt32BE(p + 4);
      const gid = cmap.readUInt32BE(p + 8);
      for (let c = start; c <= end; c++) map.set(c, gid + c - start);
    }
    return map;
  }
  const segX2 = cmap.readUInt16BE(o + 6);
  const endO = o + 14;
  const startO = endO + segX2 + 2;
  const deltaO = startO + segX2;
  const rangeO = deltaO + segX2;
  for (let s = 0; s < segX2 / 2; s++) {
    const end = cmap.readUInt16BE(endO + s * 2);
    const start = cmap.readUInt16BE(startO + s * 2);
    const delta = cmap.readInt16BE(deltaO + s * 2);
    const ro = cmap.readUInt16BE(rangeO + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let gid;
      if (ro === 0) gid = (c + delta) & 0xffff;
      else {
        const gi = rangeO + s * 2 + ro + (c - start) * 2;
        gid = cmap.readUInt16BE(gi);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid !== 0) map.set(c, gid);
    }
  }
  return map;
}

/** Load a font: its cmap and an advance-width function in px at a given size. */
export function loadFont(file) {
  const t = readFontTables(file);
  const cmap = readCmap(t.cmap);
  const unitsPerEm = t.head.readUInt16BE(18);
  const numH = t.hhea.readUInt16BE(34);
  const advances = [];
  for (let i = 0; i < numH; i++) advances.push(t.hmtx.readUInt16BE(i * 4));
  const advance = (cp) => {
    const gid = cmap.get(cp);
    if (gid === undefined) return undefined;
    return advances[Math.min(gid, numH - 1)] / unitsPerEm;
  };
  return {
    file,
    has: (cp) => cmap.has(cp),
    codePoints: () => [...cmap.keys()],
    /** Width of a string in px at `size`, or undefined for chars the font lacks. */
    width(str, size) {
      let w = 0;
      for (const ch of str) {
        const a = advance(ch.codePointAt(0));
        if (a === undefined) return undefined;
        w += a * size;
      }
      return w;
    },
  };
}

export const fontPath = (rel) => {
  const p = join(ROOT, 'node_modules', rel);
  return existsSync(p) ? p : undefined;
};

export const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
