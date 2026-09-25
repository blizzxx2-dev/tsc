/**
 * Colour-grading LUTs: 32³ tables stored as 1024×32 strips (32 blue slices side by side),
 * generated procedurally from grade functions so no assets are needed. The post shader
 * samples two LUTs and crossfades between them.
 */
export const LUT_SIZE = 32;

export type Grade = (r: number, g: number, b: number) => [number, number, number];

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const sat = (c: [number, number, number], s: number): [number, number, number] => {
  const l = lum(...c);
  return [l + (c[0] - l) * s, l + (c[1] - l) * s, l + (c[2] - l) * s];
};
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Named looks. */
export const GRADES: Record<string, Grade> = {
  neutral: (r, g, b) => [r, g, b],
  /** Candlelit hospice: warm highlights, green-cool shadows, gentle S-curve. */
  candle: (r, g, b) => {
    const l = lum(r, g, b);
    let c: [number, number, number] = [r * 1.05, g * 0.99, b * 0.88];
    const sh = 1 - sm(0, 0.45, l);
    c = [c[0] * (1 - sh * 0.1), c[1] * (1 + sh * 0.02), c[2] * (1 + sh * 0.02)];
    return c.map((v) => v + (sm(0, 1, v) - v) * 0.35) as [number, number, number];
  },
  /** Dawn muster camp: steel-blue shadows, pale gold highlights, lower saturation. */
  dawn: (r, g, b) => {
    const l = lum(r, g, b);
    let c = sat([r, g, b], 0.82);
    c = [c[0] * (0.94 + 0.12 * l), c[1] * (0.97 + 0.05 * l), c[2] * (1.08 - 0.12 * l)];
    return c.map((v) => v + (sm(0, 1, v) - v) * 0.25) as [number, number, number];
  },
  /** A Malison is present: sickly violet shadows, crushed greens. */
  curse: (r, g, b) => {
    const l = lum(r, g, b);
    const c = sat([r, g, b], 0.7);
    const sh = 1 - sm(0.05, 0.5, l);
    return [c[0] * (1 + sh * 0.08), c[1] * (0.9 - sh * 0.1), c[2] * (1 + sh * 0.25)];
  },
  /** Failing patient: drained, cold. */
  failing: (r, g, b) => {
    const c = sat([r, g, b], 0.45);
    return [c[0] * 0.95, c[1] * 0.97, c[2] * 1.05];
  },
};

/** Bake a grade into RGBA8 texel data (1024×32). */
export function bakeLut(grade: Grade): Uint8Array {
  const n = LUT_SIZE;
  const data = new Uint8Array(n * n * n * 4);
  for (let bi = 0; bi < n; bi++)
    for (let gi = 0; gi < n; gi++)
      for (let ri = 0; ri < n; ri++) {
        const [r, g, b] = grade(ri / (n - 1), gi / (n - 1), bi / (n - 1));
        const x = bi * n + ri;
        const i = (gi * n * n + x) * 4;
        data[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
        data[i + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
        data[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
        data[i + 3] = 255;
      }
  return data;
}
