/**
 * Persistent decal maps in field space (ENG-0108, ENG-0109, ENG-0114, ENG-0115, ENG-0116,
 * ENG-0120, ENG-0121).
 *
 * - Field-space UVs (ENG-0108): every map covers `FIELD_MAP_RECT`, a 16:9 rect around the operating
 *   field in world units, at a size set by the quality tier (2048×1152 High, 1024×576 Low) —
 *   independent of camera zoom, window size and render scale.
 * - Batched stamps (ENG-0109): `stamp()` queues; `flush()` sends every stamp queued for one map and
 *   mode in a single instanced draw.
 * - Blood map (ENG-0114): R density, G wetness, A stamp time (world seconds, MAX-blended), so blood
 *   darkens and dries over ~20 s of world time without an update pass; `drawBlood` shades it.
 * - Erase (ENG-0115): the Leech-Pipe stamps in erase mode, scaling density down under the pipe.
 * - Coverage readback (ENG-0116): a 64×36 downsample of density for tests and the debug overlay.
 * - Rebuildable (ENG-0120): every stamp is logged in order; after a context loss or a resize the
 *   maps are cleared and the log replayed, giving identical fields.
 * - Lifecycle (ENG-0121): `reset()` on operation restart, `release()` on exit returns VRAM.
 * - Update pass (ENG-0119): `update(now)` runs at most 10 times a world second, ping-ponging each
 *   live map through a scratch target: wet blood seeps and dries, hexfire creeps along the char.
 *   A rebuild replays stamps only, so a restored context shows the fields as stamped.
 */
import type { Vec } from '../core/math';
import type { Gfx } from './gfx';
import type { Quality } from './quality';
import { BLOOD_DECAL_FS, BRUSHES, COVERAGE_FS, COVERAGE_VS, DECAL_UPDATE_FS, DECAL_UPDATE_VS, DECAL_VS, SCORCH_DECAL_FS, STAMP_FS, STAMP_VS, type Brush } from './shaders/decal';
import { RenderTargetPool, type Target } from './targets';

export type DecalMapId = 'blood' | 'scorch';
export const DECAL_MAPS: readonly DecalMapId[] = ['blood', 'scorch'];

/** Map resolution per quality tier (16:9, the aspect of FIELD_MAP_RECT). */
export const DECAL_MAP_SIZE: Record<Quality, [number, number]> = { high: [2048, 1152], medium: [1536, 864], low: [1024, 576] };

/** World-space rect every decal map covers: the field (FIELD 660,410 ± 430×250) with a margin, 16:9. */
export const FIELD_MAP_RECT = { x: 160, y: 128.75, w: 1000, h: 562.5 } as const;

/** World point → map UV (v up, as sampled). */
export function fieldToMapUV(p: Vec): [number, number] {
  return [(p.x - FIELD_MAP_RECT.x) / FIELD_MAP_RECT.w, 1 - (p.y - FIELD_MAP_RECT.y) / FIELD_MAP_RECT.h];
}

/** Map UV → world point. */
export function mapUVToField(u: number, v: number): Vec {
  return { x: FIELD_MAP_RECT.x + u * FIELD_MAP_RECT.w, y: FIELD_MAP_RECT.y + (1 - v) * FIELD_MAP_RECT.h };
}

export interface Stamp {
  map: DecalMapId;
  brush: Brush;
  /** Centre in world units. */
  x: number;
  y: number;
  /** Radius in world units. */
  r: number;
  rot?: number;
  /** Payload (blood: density, wetness, unused); for erase, `[strength]`. */
  value: [number, number, number];
  mode: 'add' | 'erase';
  /** World time of the stamp (seconds). */
  t: number;
  seed?: number;
}

const FLOATS = 10;
/** Blood takes about this long (world seconds) to dry. */
export const BLOOD_DRY_S = 20;

/** The slice of Gfx decals need for compositing. */
type Host = Pick<Gfx, 'gl' | 'registry' | 'targets' | 'vw' | 'vh' | 'flush' | 'viewTransform' | 'resyncBlend'>;

/** Seconds of world time between update passes: 10 Hz (ENG-0119). */
export const UPDATE_STEP = 0.1;

export class DecalMaps {
  private pool: RenderTargetPool;
  private maps = new Map<DecalMapId, Target>();
  private queue: Stamp[] = [];
  /** Every stamp since the last reset, grouped by the flush that drew it (ENG-0120). */
  private log: Stamp[][] = [];
  private stampProg: WebGLProgram | null = null;
  private bloodProg: WebGLProgram | null = null;
  private covProg: WebGLProgram | null = null;
  private scorchProg: WebGLProgram | null = null;
  private updateProg: WebGLProgram | null = null;
  /** World time of the last update pass (ENG-0119), or -1 before the first. */
  private lastUpdate = -1;
  /** Update passes run so far (tests and the debug overlay). */
  updates = 0;
  private vao: WebGLVertexArrayObject | null = null;
  private inst: WebGLBuffer | null = null;
  private corners: WebGLBuffer | null = null;
  private instBytes = 0;
  private data = new Float32Array(1024 * FLOATS);
  private needRebuild = false;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private unRestore: () => void;
  /** Draw calls issued by the last flush (one per map and mode that had stamps). */
  lastDraws = 0;
  /** Time is stored ÷ this in 8-bit maps (no float render targets): 4 s steps. */
  readonly timeScale: number;

  constructor(
    private g: Host,
    public quality: Quality = 'high',
  ) {
    const reg = g.registry;
    this.pool = new RenderTargetPool(reg, g.targets.floatRenderable);
    this.timeScale = g.targets.floatRenderable ? 1 : 1024;
    this.unRestore = reg.onRestore(() => {
      this.pool.forget();
      this.maps.clear();
      this.stampProg = this.bloodProg = this.covProg = this.scorchProg = this.updateProg = null;
      this.vao = null;
      this.inst = null;
      this.instBytes = 0;
      this.uniforms.clear();
      this.needRebuild = true;
    }, 20);
  }

  get size(): [number, number] {
    return DECAL_MAP_SIZE[this.quality];
  }

  /** The live maps, for the render-target viewer (ENG-0233). */
  debugTextures(): { name: string; tex: WebGLTexture; w: number; h: number; flip: boolean }[] {
    return [...this.maps].map(([id, t]) => ({ name: `decal:${id}`, tex: t.tex, w: t.w, h: t.h, flip: true }));
  }

  /** Stamps logged since the last reset. */
  get stampCount(): number {
    let n = this.queue.length;
    for (const f of this.log) n += f.length;
    return n;
  }

  /** The map texture (created on first use). */
  map(id: DecalMapId): Target {
    let t = this.maps.get(id);
    const [w, h] = this.size;
    if (!t || t.w !== w || t.h !== h) {
      t = this.pool.acquire(`decal:${id}`, w, h, { format: 'rgba16f' });
      this.maps.set(id, t);
      this.clearTarget(t);
    }
    return t;
  }

  private clearTarget(t: Target): void {
    const gl = this.g.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Queue a stamp (drawn at the next `flush`) and log it for rebuilds. */
  stamp(s: Stamp): void {
    this.queue.push(s);
  }

  /** Change the tier: maps are recreated at the new size and rebuilt from the log. */
  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.needRebuild = true;
  }

  /** Clear every map and replay the stamp log (context restore, resize, debug). */
  rebuild(): void {
    this.needRebuild = true;
  }

  /** Operation restart: blank maps, empty log (ENG-0121). */
  reset(): void {
    this.lastUpdate = -1;
    this.queue.length = 0;
    this.log.length = 0;
    for (const t of this.maps.values()) this.clearTarget(t);
  }

  /** Operation exit: free every map; VRAM returns to what it was before the maps existed (ENG-0121). */
  release(): void {
    this.queue.length = 0;
    this.log.length = 0;
    this.pool.releaseAll();
    this.maps.clear();
    const reg = this.g.registry;
    reg.release(this.stampProg);
    reg.release(this.bloodProg);
    reg.release(this.covProg);
    reg.release(this.scorchProg);
    reg.release(this.updateProg);
    this.covProg = this.scorchProg = this.updateProg = null;
    reg.release(this.vao);
    reg.release(this.inst);
    reg.release(this.corners);
    this.corners = null;
    this.stampProg = this.bloodProg = null;
    this.vao = null;
    this.inst = null;
    this.instBytes = 0;
    this.uniforms.clear();
    this.unRestore();
  }

  private u(p: WebGLProgram, n: string): WebGLUniformLocation | null {
    let m = this.uniforms.get(p);
    if (!m) this.uniforms.set(p, (m = new Map()));
    if (!m.has(n)) m.set(n, this.g.gl.getUniformLocation(p, n));
    return m.get(n)!;
  }

  private ensureStampGl(): void {
    if (this.stampProg && this.vao && this.inst) return;
    const gl = this.g.gl;
    const reg = this.g.registry;
    this.stampProg = reg.createProgram('decal-stamp', STAMP_VS, STAMP_FS);
    this.vao = reg.createVertexArray('decal-stamp');
    gl.bindVertexArray(this.vao);
    const corners = (this.corners = reg.createBuffer('decal corners'));
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    reg.setBytes(corners, 32);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.inst = reg.createBuffer('decal stamps');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
  }

  /**
   * Draw queued stamps: one instanced draw per map and mode, in queue order within each. Call
   * before the frame binds its own targets (it leaves the default framebuffer bound).
   */
  flush(): number {
    this.lastDraws = 0;
    const rebuild = this.needRebuild;
    this.needRebuild = false;
    if (!rebuild && !this.queue.length) return 0;
    this.g.flush('program');
    this.ensureStampGl();
    const gl = this.g.gl;
    const prog = this.stampProg!;
    gl.useProgram(prog);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(this.u(prog, 'u_aspect'), FIELD_MAP_RECT.w / FIELD_MAP_RECT.h);
    gl.enable(gl.BLEND);
    if (rebuild) {
      // Same grouping as when they were first drawn, so the rebuilt maps match exactly.
      for (const id of DECAL_MAPS) if (this.maps.has(id) || this.log.some((f) => f.some((s) => s.map === id))) this.clearTarget(this.map(id));
      for (const f of this.log) this.drawFrame(f);
    }
    if (this.queue.length) {
      this.drawFrame(this.queue);
      this.log.push(this.queue);
      this.queue = [];
    }
    gl.blendEquation(gl.FUNC_ADD);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.g.resyncBlend();
    return this.lastDraws;
  }

  /** One frame's stamps: a single draw per map and mode (adds first, then erases). */
  private drawFrame(list: readonly Stamp[]): void {
    for (const id of DECAL_MAPS) {
      for (const mode of ['add', 'erase'] as const) {
        let n = 0;
        for (const s of list) if (s.map === id && s.mode === mode) n++;
        if (n) this.drawRun(id, mode, list, n);
      }
    }
  }

  private drawRun(id: DecalMapId, mode: 'add' | 'erase', list: readonly Stamp[], n: number): void {
    const gl = this.g.gl;
    const t = this.map(id);
    if (this.data.length < n * FLOATS) this.data = new Float32Array(Math.max(n, this.data.length / FLOATS * 2) * FLOATS);
    const d = this.data;
    let o = 0;
    for (const s of list) {
      if (s.map !== id || s.mode !== mode) continue;
      const [u, v] = fieldToMapUV(s);
      d[o++] = u;
      d[o++] = v;
      d[o++] = -(s.rot ?? 0);
      d[o++] = s.r / FIELD_MAP_RECT.w;
      d[o++] = s.value[0];
      d[o++] = s.value[1];
      d[o++] = s.value[2];
      d[o++] = s.t / this.timeScale;
      d[o++] = BRUSHES[s.brush];
      d[o++] = s.seed ?? 0;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    const bytes = n * FLOATS * 4;
    if (bytes > this.instBytes) {
      this.instBytes = Math.max(bytes, 16 * 1024);
      this.g.registry.setBytes(this.inst!, this.instBytes);
    }
    gl.bufferData(gl.ARRAY_BUFFER, this.instBytes, gl.STREAM_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * FLOATS);
    gl.uniform1i(this.u(this.stampProg!, 'u_mode'), mode === 'erase' ? 1 : 0);
    if (mode === 'erase') {
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
    } else {
      // RGB accumulates; alpha keeps the latest stamp time.
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX);
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    }
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    this.lastDraws++;
  }

  /**
   * The 10 Hz update pass (ENG-0119): at most one run per UPDATE_STEP of world time. Each live map
   * is drawn through DECAL_UPDATE_FS into a scratch target of the same size, which is then blitted
   * back. Returns true when a pass ran.
   */
  update(now: number): boolean {
    if (this.lastUpdate < 0 || now < this.lastUpdate) this.lastUpdate = now;
    const dt = now - this.lastUpdate;
    if (dt < UPDATE_STEP || this.maps.size === 0) return false;
    this.lastUpdate = now;
    const g = this.g;
    g.flush('program');
    const gl = g.gl;
    if (!this.updateProg) this.updateProg = g.registry.createProgram('decal-update', DECAL_UPDATE_VS, DECAL_UPDATE_FS);
    const p = this.updateProg;
    gl.useProgram(p);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.u(p, 'u_map'), 0);
    gl.uniform1f(this.u(p, 'u_dt'), Math.min(dt, 0.5));
    for (const [id, t] of this.maps) {
      const tmp = this.pool.acquire(`decal:${id}:update`, t.w, t.h, { format: 'rgba16f' });
      gl.bindFramebuffer(gl.FRAMEBUFFER, tmp.fb);
      gl.viewport(0, 0, tmp.w, tmp.h);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform2f(this.u(p, 'u_texel'), 1 / t.w, 1 / t.h);
      gl.uniform1i(this.u(p, 'u_kind'), id === 'blood' ? 0 : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Back into the map (same size and format, so a plain blit).
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tmp.fb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.fb);
      gl.blitFramebuffer(0, 0, t.w, t.h, 0, 0, t.w, t.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.BLEND);
    g.resyncBlend();
    this.updates++;
    return true;
  }

  /**
   * Shade the blood map onto the field (call inside the world layer, after the flesh). `now` is
   * world time in seconds; colours are the patient's blood when fresh and dried.
   */
  drawBlood(now: number, look: { fresh: [number, number, number]; dried?: [number, number, number]; light?: Vec } = { fresh: [0.45, 0.02, 0.04] }): void {
    if (!this.maps.has('blood')) return;
    const g = this.g;
    g.flush('program');
    const gl = g.gl;
    if (!this.bloodProg) this.bloodProg = g.registry.createProgram('decal-blood', DECAL_VS, BLOOD_DECAL_FS);
    const p = this.bloodProg;
    const t = this.map('blood');
    gl.useProgram(p);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.uniform1i(this.u(p, 'u_map'), 0);
    gl.uniform2f(this.u(p, 'u_texel'), 1 / t.w, 1 / t.h);
    gl.uniform4f(this.u(p, 'u_rect'), FIELD_MAP_RECT.x, FIELD_MAP_RECT.y, FIELD_MAP_RECT.w, FIELD_MAP_RECT.h);
    gl.uniform2f(this.u(p, 'u_view'), g.vw, g.vh);
    gl.uniformMatrix3fv(this.u(p, 'u_xf'), false, g.viewTransform());
    gl.uniform1f(this.u(p, 'u_now'), now / this.timeScale);
    gl.uniform1f(this.u(p, 'u_dry'), BLOOD_DRY_S / this.timeScale);
    gl.uniform3fv(this.u(p, 'u_fresh'), look.fresh);
    gl.uniform3fv(this.u(p, 'u_dried'), look.dried ?? [look.fresh[0] * 0.32 + 0.03, look.fresh[1] * 0.3 + 0.015, look.fresh[2] * 0.3 + 0.01]);
    const l = look.light ?? { x: -0.5, y: 0.7 };
    gl.uniform2f(this.u(p, 'u_light'), l.x, l.y);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, null);
    g.resyncBlend();
  }

  /** Shade the scorch map (Brand sears, burn scars, hexfire rims) onto the field (ENG-0117). */
  drawScorch(time: number): void {
    if (!this.maps.has('scorch')) return;
    const g = this.g;
    g.flush('program');
    const gl = g.gl;
    if (!this.scorchProg) this.scorchProg = g.registry.createProgram('decal-scorch', DECAL_VS, SCORCH_DECAL_FS);
    const p = this.scorchProg;
    const t = this.map('scorch');
    gl.useProgram(p);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.uniform1i(this.u(p, 'u_map'), 0);
    gl.uniform2f(this.u(p, 'u_texel'), 1 / t.w, 1 / t.h);
    gl.uniform4f(this.u(p, 'u_rect'), FIELD_MAP_RECT.x, FIELD_MAP_RECT.y, FIELD_MAP_RECT.w, FIELD_MAP_RECT.h);
    gl.uniform2f(this.u(p, 'u_view'), g.vw, g.vh);
    gl.uniformMatrix3fv(this.u(p, 'u_xf'), false, g.viewTransform());
    gl.uniform1f(this.u(p, 'u_time'), time);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, null);
    g.resyncBlend();
  }

  /**
   * Low-res readback (ENG-0116): mean density (0..1) of each cell of a `w`×`h` grid over the map
   * (row 0 = top of the field), for tests and the debug overlay. Synchronous (readPixels): debug only.
   */
  readDensity(id: DecalMapId, w = 64, h = 36): Float32Array {
    this.flush();
    const gl = this.g.gl;
    const out = new Float32Array(w * h);
    if (!this.maps.has(id)) return out;
    const src = this.map(id);
    if (!this.covProg) this.covProg = this.g.registry.createProgram('decal-coverage', COVERAGE_VS, COVERAGE_FS);
    const dst = this.pool.acquire(`decal:${id}:coverage`, w, h, { format: 'rgba8' });
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.covProg);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(this.u(this.covProg, 'u_map'), 0);
    gl.uniform2f(this.u(this.covProg, 'u_cell'), 1 / w, 1 / h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.BLEND);
    this.pool.release(`decal:${id}:coverage`);
    this.g.resyncBlend();
    // readPixels rows run bottom-up; flip so row 0 is the top of the field.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(h - 1 - y) * w + x] = px[(y * w + x) * 4] / 255;
    return out;
  }

  /** Fraction of the map (0..1) whose density exceeds `threshold`. */
  coverage(id: DecalMapId, threshold = 0.1): number {
    const d = this.readDensity(id);
    let n = 0;
    for (const v of d) if (v > threshold) n++;
    return n / d.length;
  }
}
