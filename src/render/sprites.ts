/**
 * Sprite sheets (ENG-0032/0034). A sheet is one or more atlas pages plus a
 * JSON frame table produced by `scripts/pack-atlas.ts`.
 */

/** One packed frame: pixel rect on its page, original (untrimmed) size and pivot. */
export interface FrameDef {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pivot in 0..1 of the frame (default centre). */
  px?: number;
  py?: number;
}

export interface SheetJson {
  name: string;
  pages: { file: string; w: number; h: number }[];
  frames: Record<string, FrameDef>;
  /** Named animations: frame ids with per-frame durations in ms. */
  anims?: Record<string, { frames: string[]; ms: number[] | number; mode?: AnimMode }>;
}

/** Texture-space info for drawing a frame. */
export interface SpriteFrame {
  id: string;
  /** Texture handle for the page. */
  tex: WebGLTexture;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
  px: number;
  py: number;
}

export interface SpriteOpts {
  rot?: number;
  scale?: number | { x: number; y: number };
  /** ABGR-packed tint (see render/color). */
  tint?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Override the frame's pivot (0..1). */
  pivot?: { x: number; y: number };
  alpha?: number;
}

/**
 * Registry of frame ids across every loaded sheet. `add` takes a sheet and
 * the textures for its pages (by index).
 */
export class SpriteBank {
  private frames = new Map<string, SpriteFrame>();
  private sheets = new Map<string, string[]>();
  readonly anims = new Map<string, AnimDef>();

  add(sheet: SheetJson, pages: { tex: WebGLTexture; w: number; h: number }[]): void {
    const ids: string[] = [];
    for (const [id, f] of Object.entries(sheet.frames)) {
      const page = pages[f.page];
      if (!page) throw new Error(`sprite sheet ${sheet.name}: frame ${id} references missing page ${f.page}`);
      this.frames.set(id, {
        id,
        tex: page.tex,
        u0: f.x / page.w,
        v0: f.y / page.h,
        u1: (f.x + f.w) / page.w,
        v1: (f.y + f.h) / page.h,
        w: f.w,
        h: f.h,
        px: f.px ?? 0.5,
        py: f.py ?? 0.5,
      });
      ids.push(id);
    }
    for (const [id, a] of Object.entries(sheet.anims ?? {})) {
      const ms = Array.isArray(a.ms) ? a.ms : a.frames.map(() => a.ms as number);
      this.anims.set(id, { frames: a.frames, ms, mode: a.mode ?? 'loop' });
    }
    this.sheets.set(sheet.name, ids);
  }

  /** Swap page textures after a context restore without touching frame ids. */
  retexture(sheetName: string, pages: WebGLTexture[], sheet: SheetJson): void {
    for (const id of this.sheets.get(sheetName) ?? []) {
      const f = this.frames.get(id);
      const def = sheet.frames[id];
      if (f && def) f.tex = pages[def.page];
    }
  }

  remove(sheetName: string): void {
    for (const id of this.sheets.get(sheetName) ?? []) this.frames.delete(id);
    this.sheets.delete(sheetName);
  }

  get(id: string): SpriteFrame | undefined {
    return this.frames.get(id);
  }

  has(id: string): boolean {
    return this.frames.has(id);
  }

  get size(): number {
    return this.frames.size;
  }
}

export type AnimMode = 'loop' | 'once' | 'pingpong';

export interface AnimDef {
  frames: string[];
  /** Duration of each frame in ms. */
  ms: number[];
  mode: AnimMode;
}

/**
 * Plays a frame sequence with per-frame durations (ENG-0034). `update(dt)`
 * advances; `frame` is the current frame id; `onComplete` fires once when a
 * `once` animation reaches its last frame (and every cycle for loop/ping-pong).
 */
export class AnimPlayer {
  private i = 0;
  private dir = 1;
  private t = 0;
  done = false;
  speed = 1;

  constructor(
    public def: AnimDef,
    public onComplete?: () => void,
  ) {
    if (!def.frames.length) throw new Error('AnimPlayer: empty animation');
  }

  get frame(): string {
    return this.def.frames[this.i];
  }

  get index(): number {
    return this.i;
  }

  reset(): void {
    this.i = 0;
    this.dir = 1;
    this.t = 0;
    this.done = false;
  }

  update(dt: number): void {
    if (this.done) return;
    this.t += dt * 1000 * this.speed;
    const n = this.def.frames.length;
    // Guard against zero-length frames looping forever.
    for (let guard = 0; guard < 10000; guard++) {
      const dur = Math.max(1, this.def.ms[this.i] ?? this.def.ms[0]);
      if (this.t < dur) return;
      this.t -= dur;
      const mode = this.def.mode;
      if (mode === 'once') {
        if (this.i >= n - 1) {
          this.done = true;
          this.t = 0;
          this.onComplete?.();
          return;
        }
        this.i++;
      } else if (mode === 'loop') {
        this.i++;
        if (this.i >= n) {
          this.i = 0;
          this.onComplete?.();
        }
      } else {
        if (n === 1) continue;
        const next = this.i + this.dir;
        if (next < 0 || next >= n) {
          this.dir = -this.dir;
          if (this.dir === 1) this.onComplete?.();
        }
        this.i += this.dir;
      }
    }
  }
}
