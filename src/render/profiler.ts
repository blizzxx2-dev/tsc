import type { Gfx } from './gfx';
import type { GlRegistry } from './registry';

/** Per-system CPU budgets in ms (docs/perf-targets.md, ENG-0218). */
export const CPU_BUDGETS: Record<string, number> = { sim: 1.5, batch: 2, frame: 6 };
/** A frame longer than this is a hitch (docs/perf-targets.md, ENG-0224): none allowed during an operation. */
export const HITCH_MS = 50;
/** Per-pass GPU budgets in ms. */
export const GPU_BUDGETS: Record<string, number> = { layers: 1, world: 3, post: 2, ui: 1 };

const HISTORY = 600;

/**
 * GPU pass timer over EXT_disjoint_timer_query_webgl2 (ENG-0219). Passes are
 * sequential `mark(name)` calls (a new mark ends the previous pass); results
 * arrive a few frames later and are smoothed.
 */
export class GpuTimer {
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: { q: WebGLQuery; name: string }[] = [];
  private free: WebGLQuery[] = [];
  private open: string | null = null;
  readonly ms = new Map<string, number>();
  /** Queries are only issued while the profiler overlay is open. */
  enabled = false;

  constructor(private reg: GlRegistry) {
    this.ext = reg.gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  }

  get available(): boolean {
    return !!this.ext;
  }

  mark(name: string | null): void {
    const gl = this.reg.gl;
    if (!this.ext) return;
    if (!this.enabled && !this.open) return;
    if (this.open) {
      gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.open = null;
    }
    if (!name || !this.enabled || this.pending.length > 64) return;
    const q = this.free.pop() ?? this.reg.createQuery('gpu-timer');
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.pending.push({ q, name });
    this.open = name;
  }

  /** Collect finished queries; call once per frame after the last mark. */
  collect(): void {
    const gl = this.reg.gl;
    if (!this.ext || (!this.enabled && !this.pending.length)) return;
    this.mark(null);
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) {
        const ms = (gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number) / 1e6;
        const prev = this.ms.get(p.name);
        this.ms.set(p.name, prev === undefined ? ms : prev * 0.9 + ms * 0.1);
      }
      this.free.push(p.q);
    }
  }

  /** Context restored: re-enable the extension on the new context. */
  rebind(): void {
    this.ext = this.reg.gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  }

  /** Context lost: every query handle is gone. */
  reset(): void {
    this.pending.length = 0;
    this.free.length = 0;
    this.open = null;
  }
}

/** Counters the batcher fills each frame (ENG-0024). */
export interface FrameStats {
  drawCalls: number;
  vertices: number;
  flushes: Record<FlushReason, number>;
  textureUploads: number;
  /** Draw calls per frame section (layers, world, post, ui) for the debug overlay (ENG-0232). */
  sections: Record<string, number>;
}
export type FlushReason = 'blend' | 'texture' | 'program' | 'overflow' | 'camera' | 'clip' | 'end';

export function emptyStats(): FrameStats {
  return { drawCalls: 0, vertices: 0, flushes: { blend: 0, texture: 0, program: 0, overflow: 0, camera: 0, clip: 0, end: 0 }, textureUploads: 0, sections: {} };
}

/**
 * CPU scope timings + GPU pass timings + frame-time history, drawn as an
 * overlay (F3). Scopes nest-free: `begin(name)`/`end(name)` pairs per system.
 */
export class Profiler {
  enabled = false;
  private starts = new Map<string, number>();
  readonly cpu = new Map<string, number>();
  /** Last HISTORY frame times (ms), ring buffer. */
  readonly frameMs = new Float32Array(HISTORY);
  /** Last HISTORY per-scope timings, for CSV capture (ENG-0220). */
  private scopeHistory = new Map<string, Float32Array>();
  private head = 0;
  private count = 0;
  private frameScopes = new Map<string, number>();
  /** Hitch audit (ENG-0224): frames over HITCH_MS since the last `resetHitches`, and the worst frame seen. */
  hitches = 0;
  worstMs = 0;
  /** Frame index (since `resetHitches`) of the worst frame, for pairing with a log or replay. */
  worstFrame = -1;
  private framesSinceReset = 0;

  constructor(private now: () => number = () => performance.now()) {}

  /** Start a hitch-audit window (e.g. when an operation begins). */
  resetHitches(): void {
    this.hitches = 0;
    this.worstMs = 0;
    this.worstFrame = -1;
    this.framesSinceReset = 0;
  }

  /** The hitch audit as a plain object (debug API, soak/perf scripts). */
  hitchReport(): { hitches: number; worstMs: number; worstFrame: number; frames: number; hitchMs: number } {
    return { hitches: this.hitches, worstMs: this.worstMs, worstFrame: this.worstFrame, frames: this.framesSinceReset, hitchMs: HITCH_MS };
  }

  begin(name: string): void {
    this.starts.set(name, this.now());
  }

  end(name: string): void {
    const s = this.starts.get(name);
    if (s === undefined) return;
    const ms = this.now() - s;
    this.frameScopes.set(name, (this.frameScopes.get(name) ?? 0) + ms);
  }

  /** Close the frame: record frame time and scope totals. */
  frame(frameMs: number): void {
    this.frameMs[this.head] = frameMs;
    if (frameMs > HITCH_MS) this.hitches++;
    if (frameMs > this.worstMs) {
      this.worstMs = frameMs;
      this.worstFrame = this.framesSinceReset;
    }
    this.framesSinceReset++;
    for (const [name, ms] of this.frameScopes) {
      const prev = this.cpu.get(name);
      this.cpu.set(name, prev === undefined ? ms : prev * 0.9 + ms * 0.1);
      let h = this.scopeHistory.get(name);
      if (!h) this.scopeHistory.set(name, (h = new Float32Array(HISTORY)));
      h[this.head] = ms;
    }
    for (const [name, h] of this.scopeHistory) if (!this.frameScopes.has(name)) h[this.head] = 0;
    this.frameScopes.clear();
    this.head = (this.head + 1) % HISTORY;
    this.count = Math.min(HISTORY, this.count + 1);
  }

  /** Frame-time percentile over the history (ms). */
  percentile(p: number): number {
    if (!this.count) return 0;
    const a = Array.from(this.frameMs.slice(0, this.count)).sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  }

  /** The last 600 frames of frame time and scope timings as CSV, oldest first (ENG-0220). */
  csv(): string {
    const names = [...this.scopeHistory.keys()];
    const rows = ['frame,frame_ms,' + names.map((n) => `${n}_ms`).join(',')];
    for (let k = 0; k < this.count; k++) {
      const i = (this.head - this.count + k + HISTORY) % HISTORY;
      rows.push([k, this.frameMs[i].toFixed(3), ...names.map((n) => this.scopeHistory.get(n)![i].toFixed(3))].join(','));
    }
    return rows.join('\n');
  }

  /** Draw the overlay in the UI layer. */
  draw(g: Gfx, stats: FrameStats, reg: GlRegistry, gpu: GpuTimer | null): void {
    if (!this.enabled) return;
    const x = 8;
    const y = 8;
    const w = 330;
    const lines: [string, number][] = [];
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    const avg = this.count ? this.frameMs.reduce((a, b) => a + b, 0) / this.count : 0;
    lines.push([`frame ${avg.toFixed(2)} ms  p99 ${this.percentile(99).toFixed(1)}  (${avg ? Math.round(1000 / avg) : 0} fps)`, 0xffe0e0e0]);
    lines.push([`worst ${this.worstMs.toFixed(1)} ms @${this.worstFrame}  hitches>${HITCH_MS} ${this.hitches}`, this.hitches ? 0xff5050ff : 0xffb0e0b0]);
    for (const [n, ms] of this.cpu) lines.push([`cpu ${n.padEnd(8)} ${ms.toFixed(2)} ms`, ms > (CPU_BUDGETS[n] ?? 99) ? 0xff5050ff : 0xffb0e0b0]);
    if (gpu?.available) for (const [n, ms] of gpu.ms) lines.push([`gpu ${n.padEnd(8)} ${ms.toFixed(2)} ms`, ms > (GPU_BUDGETS[n] ?? 99) ? 0xff5050ff : 0xffe0c090]);
    else lines.push(['gpu timers unavailable (CPU-only)', 0xff808080]);
    lines.push([`draws ${stats.drawCalls}  verts ${stats.vertices}  uploads ${stats.textureUploads}`, 0xffe0e0e0]);
    const f = stats.flushes;
    lines.push([`flush b${f.blend} t${f.texture} p${f.program} o${f.overflow} c${f.camera}`, 0xffa0a0a0]);
    lines.push([`gl objs ${reg.count()}  tex ${(reg.bytes() / 2 ** 20).toFixed(1)} MB`, 0xffe0e0e0]);
    if (heap) lines.push([`js heap ${(heap / 2 ** 20).toFixed(1)} MB`, 0xffe0e0e0]);
    const gh = 60;
    const h = lines.length * 16 + gh + 18;
    g.rect(x, y, w, h, 0xc0000000);
    lines.forEach(([s, c], i) => g.text(s, x + 8, y + 16 + i * 16, { size: 13, color: c >>> 0, shadow: false }));
    // Frame-time graph with 16.7 ms (60 fps) and 6 ms (CPU budget) lines.
    const gy = y + h - gh - 6;
    const scale = gh / 33.3;
    g.rect(x + 6, gy + gh - 16.7 * scale, w - 12, 1, 0xff40a040);
    g.rect(x + 6, gy + gh - 6 * scale, w - 12, 1, 0xff4080c0);
    const bars = Math.min(this.count, w - 12);
    for (let k = 0; k < bars; k++) {
      const i = (this.head - bars + k + HISTORY) % HISTORY;
      const ms = this.frameMs[i];
      const bh = Math.min(gh, ms * scale);
      g.rect(x + 6 + k, gy + gh - bh, 1, bh, ms > 16.7 ? 0xff4040ff : 0xffc0c0c0);
    }
  }
}
