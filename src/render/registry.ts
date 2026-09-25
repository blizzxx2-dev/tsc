/**
 * GL resource registry (ENG-0198). Every buffer, VAO, program, texture,
 * framebuffer and renderbuffer is created through it, which gives us:
 * - live object counts per kind (leak tests, the profiler overlay);
 * - byte accounting for the VRAM budget (ENG-0227);
 * - restore after `webglcontextrestored` (ENG-0200): owners register a
 *   recreate callback with `onRestore`, which runs in registration order.
 */
export type GlKind = 'buffer' | 'vao' | 'program' | 'texture' | 'framebuffer' | 'renderbuffer' | 'query';

interface Entry {
  kind: GlKind;
  label: string;
  bytes: number;
}

export interface Consumer {
  label: string;
  kind: GlKind;
  bytes: number;
}

/** Budgets from docs/perf-targets.md (ENG-0227). */
export const VRAM_BUDGET = { low: 384 * 2 ** 20, medium: 576 * 2 ** 20, high: 768 * 2 ** 20 } as const;
export const HEAP_BUDGET = 300 * 2 ** 20;

export class ShaderError extends Error {
  constructor(
    readonly label: string,
    readonly stage: 'vertex' | 'fragment' | 'link',
    readonly log: string,
    source?: string,
  ) {
    const defs = source ? shaderDefines(source) : [];
    super(`[${label}${defs.length ? ` · ${defs.join(' ')}` : ''}] ${stage} shader failed:\n${formatShaderLog(log, source)}`);
  }
}

/** The `#define`s of a shader variant as `NAME=value` (ENG-0202), so an error names the variant. */
export function shaderDefines(source: string): string[] {
  return [...source.matchAll(/^\s*#define\s+(\w+)(?:[ \t]+([^\n]*))?$/gm)].map((m) => (m[2] ? `${m[1]}=${m[2].trim()}` : m[1]));
}

/** Annotate a GLSL info log with the offending source lines ("ERROR: 0:42: …" → line 42 quoted). */
export function formatShaderLog(log: string, source?: string): string {
  if (!source) return log;
  const lines = source.split('\n');
  return log
    .split('\n')
    .map((l) => {
      const m = /ERROR:\s*\d+:(\d+)/.exec(l);
      if (!m) return l;
      const n = Number(m[1]);
      return `${l}\n    ${n}| ${lines[n - 1]?.trim() ?? ''}`;
    })
    .join('\n');
}

export class GlRegistry {
  private entries = new Map<object, Entry>();
  private restorers: { fn: () => void; order: number }[] = [];
  private warned = false;
  /** Incremented on every context loss (ENG-0201 counts repeats). */
  losses = 0;
  lost = false;

  constructor(public gl: WebGL2RenderingContext) {}

  track<T extends object>(obj: T, kind: GlKind, label: string, bytes = 0): T {
    this.entries.set(obj, { kind, label, bytes });
    return obj;
  }

  /** Is `obj` a tracked object of the current context (false after a loss or release)? */
  isLive(obj: object): boolean {
    return this.entries.has(obj);
  }

  setBytes(obj: object, bytes: number, label?: string): void {
    const e = this.entries.get(obj);
    if (e) {
      e.bytes = bytes;
      if (label) e.label = label;
    }
  }

  createTexture(label: string): WebGLTexture {
    return this.track(this.gl.createTexture()!, 'texture', label);
  }
  createBuffer(label: string): WebGLBuffer {
    return this.track(this.gl.createBuffer()!, 'buffer', label);
  }
  createVertexArray(label: string): WebGLVertexArrayObject {
    return this.track(this.gl.createVertexArray()!, 'vao', label);
  }
  createFramebuffer(label: string): WebGLFramebuffer {
    return this.track(this.gl.createFramebuffer()!, 'framebuffer', label);
  }
  createRenderbuffer(label: string): WebGLRenderbuffer {
    return this.track(this.gl.createRenderbuffer()!, 'renderbuffer', label);
  }
  createQuery(label: string): WebGLQuery {
    return this.track(this.gl.createQuery()!, 'query', label);
  }

  /** Compile and link a program; failures throw a ShaderError quoting the bad source lines (ENG-0202). */
  createProgram(label: string, vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const mk = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        const log = gl.getShaderInfoLog(s) ?? 'shader error';
        gl.deleteShader(s);
        throw new ShaderError(label, type === gl.VERTEX_SHADER ? 'vertex' : 'fragment', log, src);
      }
      return s;
    };
    const v = mk(gl.VERTEX_SHADER, vs);
    const f = mk(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    // Shaders can be flagged for deletion once linked; the program keeps them alive.
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new ShaderError(label, 'link', gl.getProgramInfoLog(p) ?? 'link error');
    return this.track(p, 'program', label);
  }

  /** Delete a tracked object through the matching GL call. */
  release(obj: object | null | undefined): void {
    if (!obj) return;
    const e = this.entries.get(obj);
    if (!e) return;
    this.entries.delete(obj);
    if (this.lost) return;
    const gl = this.gl;
    switch (e.kind) {
      case 'buffer':
        gl.deleteBuffer(obj as WebGLBuffer);
        break;
      case 'vao':
        gl.deleteVertexArray(obj as WebGLVertexArrayObject);
        break;
      case 'program':
        gl.deleteProgram(obj as WebGLProgram);
        break;
      case 'texture':
        gl.deleteTexture(obj as WebGLTexture);
        break;
      case 'framebuffer':
        gl.deleteFramebuffer(obj as WebGLFramebuffer);
        break;
      case 'renderbuffer':
        gl.deleteRenderbuffer(obj as WebGLRenderbuffer);
        break;
      case 'query':
        gl.deleteQuery(obj as WebGLQuery);
        break;
    }
  }

  /** Live object count, optionally of one kind. */
  count(kind?: GlKind): number {
    if (!kind) return this.entries.size;
    let n = 0;
    for (const e of this.entries.values()) if (e.kind === kind) n++;
    return n;
  }

  /** Tracked bytes (textures, targets, buffers). */
  bytes(kind?: GlKind): number {
    let n = 0;
    for (const e of this.entries.values()) if (!kind || e.kind === kind) n += e.bytes;
    return n;
  }

  /** Largest consumers, biggest first. */
  top(n = 10): Consumer[] {
    return [...this.entries.values()]
      .filter((e) => e.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, n)
      .map((e) => ({ label: e.label, kind: e.kind, bytes: e.bytes }));
  }

  /**
   * Compare tracked VRAM with the tier budget; logs once (with the top 10
   * consumers) when exceeded and returns the warning text, else null.
   */
  checkBudget(budget: number, log: (msg: string) => void = console.warn): string | null {
    const used = this.bytes();
    if (used <= budget) {
      this.warned = false;
      return null;
    }
    const mb = (b: number) => (b / 2 ** 20).toFixed(1);
    const msg = `VRAM over budget: ${mb(used)} MB > ${mb(budget)} MB. Top consumers:\n` + this.top(10).map((c) => `  ${mb(c.bytes)} MB  ${c.kind}  ${c.label}`).join('\n');
    if (!this.warned) log(msg);
    this.warned = true;
    return msg;
  }

  /** Register a recreate callback; lower `order` runs first. Returns an unsubscribe function. */
  onRestore(fn: () => void, order = 0): () => void {
    const item = { fn, order };
    this.restorers.push(item);
    this.restorers.sort((a, b) => a.order - b.order);
    return () => {
      const i = this.restorers.indexOf(item);
      if (i >= 0) this.restorers.splice(i, 1);
    };
  }

  /** The context is gone: every handle is dead. */
  contextLost(): void {
    this.lost = true;
    this.losses++;
    this.entries.clear();
  }

  /** The context is back: run every recreate callback. */
  contextRestored(): void {
    this.lost = false;
    for (const r of [...this.restorers]) r.fn();
  }

  get restoreCallbacks(): number {
    return this.restorers.length;
  }
}
