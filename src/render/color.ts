/**
 * Colours are packed as 32-bit ABGR integers so they can be written straight
 * into the vertex buffer's Uint32 view (little-endian RGBA byte order).
 */
export type RGBA = number;

export function rgba(r: number, g: number, b: number, a = 1): RGBA {
  return (((Math.round(a * 255) & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

const cache = new Map<string, [number, number, number]>();

/** '#rgb' or '#rrggbb' with optional alpha 0..1. */
export function hex(h: string, a = 1): RGBA {
  let c = cache.get(h);
  if (!c) {
    let s = h.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(h, c);
  }
  return rgba(c[0], c[1], c[2], a);
}

export function withAlpha(c: RGBA, a: number): RGBA {
  return ((c & 0x00ffffff) | ((Math.round(a * 255) & 255) << 24)) >>> 0;
}

export function alphaOf(c: RGBA): number {
  return (c >>> 24) / 255;
}

/** Linear blend of two packed colours. */
export function mix(c1: RGBA, c2: RGBA, t: number): RGBA {
  const ch = (c: RGBA, s: number) => (c >>> s) & 255;
  const m = (s: number) => Math.round(ch(c1, s) + (ch(c2, s) - ch(c1, s)) * t);
  return rgba(m(0), m(8), m(16), (ch(c1, 24) + (ch(c2, 24) - ch(c1, 24)) * t) / 255);
}

/** Normalised [r,g,b] floats for shader uniforms. */
export function vec3(h: string): [number, number, number] {
  const c = hex(h);
  return [(c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255];
}

export const TRANSPARENT = 0;
export const WHITE = rgba(255, 255, 255, 1);
export const BLACK = rgba(0, 0, 0, 1);
