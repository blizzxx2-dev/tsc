/**
 * GL state cache (ENG-0029): a drop-in wrapper around the WebGL2 context that drops calls which
 * would set state to what it already is — program, VAO, array buffer, active unit and the texture
 * bound per unit/target, read/draw framebuffers, blend func/equation, enable/disable caps,
 * viewport and scissor. Everything goes through the one wrapped context (Gfx, the glyph atlas,
 * particles, decals, the 3D renderer), so the cache always mirrors the real state. It is reset on
 * context loss/restore, and deleting a bound object clears its binding (GL unbinds it too).
 */

export interface StateCacheStats {
  /** Calls forwarded to GL. */
  passed: number;
  /** Redundant calls dropped. */
  skipped: number;
}

type Tex = WebGLTexture | null;

export class GlStateCache {
  readonly gl: WebGL2RenderingContext;
  readonly stats: StateCacheStats = { passed: 0, skipped: 0 };
  private program: WebGLProgram | null | undefined;
  private vao: WebGLVertexArrayObject | null | undefined;
  private arrayBuffer: WebGLBuffer | null | undefined;
  private unit: number | undefined;
  private textures = new Map<string, Tex>();
  private readFb: WebGLFramebuffer | null | undefined;
  private drawFb: WebGLFramebuffer | null | undefined;
  private caps = new Map<number, boolean>();
  private blendFn: string | undefined;
  private blendEq: string | undefined;
  private view: string | undefined;
  private scis: string | undefined;

  constructor(readonly raw: WebGL2RenderingContext) {
    this.gl = this.wrap(raw);
    this.reset();
  }

  /** Forget everything (context lost or restored: GL state is back to defaults / unknown). */
  reset(): void {
    this.program = this.vao = this.arrayBuffer = this.readFb = this.drawFb = undefined;
    // A fresh (or restored) context starts on texture unit 0.
    this.unit = this.raw.TEXTURE0;
    this.textures.clear();
    this.caps.clear();
    this.blendFn = this.blendEq = this.view = this.scis = undefined;
  }

  private wrap(raw: WebGL2RenderingContext): WebGL2RenderingContext {
    const c = raw as unknown as Record<string, number>;
    const self = this;
    const pass = () => void self.stats.passed++;
    const skip = () => void self.stats.skipped++;
    const texKey = (target: number) => `${self.unit}:${target}`;
    const overrides: Record<string, (...a: never[]) => unknown> = {
      useProgram(p: WebGLProgram | null) {
        if (self.program === p) return skip();
        self.program = p;
        pass();
        raw.useProgram(p);
      },
      bindVertexArray(v: WebGLVertexArrayObject | null) {
        if (self.vao === v) return skip();
        self.vao = v;
        pass();
        raw.bindVertexArray(v);
      },
      bindBuffer(target: number, b: WebGLBuffer | null) {
        // Only ARRAY_BUFFER is global; ELEMENT_ARRAY_BUFFER lives in the VAO.
        if (target === c.ARRAY_BUFFER) {
          if (self.arrayBuffer === b) return skip();
          self.arrayBuffer = b;
        }
        pass();
        raw.bindBuffer(target, b);
      },
      activeTexture(u: number) {
        if (self.unit === u) return skip();
        self.unit = u;
        pass();
        raw.activeTexture(u);
      },
      bindTexture(target: number, t: Tex) {
        const k = texKey(target);
        if (self.textures.has(k) && self.textures.get(k) === t) return skip();
        self.textures.set(k, t);
        pass();
        raw.bindTexture(target, t);
      },
      bindFramebuffer(target: number, fb: WebGLFramebuffer | null) {
        const both = target === c.FRAMEBUFFER;
        const read = both || target === c.READ_FRAMEBUFFER;
        const draw = both || target === c.DRAW_FRAMEBUFFER;
        if ((!read || self.readFb === fb) && (!draw || self.drawFb === fb)) return skip();
        if (read) self.readFb = fb;
        if (draw) self.drawFb = fb;
        pass();
        raw.bindFramebuffer(target, fb);
      },
      enable(cap: number) {
        if (self.caps.get(cap) === true) return skip();
        self.caps.set(cap, true);
        pass();
        raw.enable(cap);
      },
      disable(cap: number) {
        if (self.caps.get(cap) === false) return skip();
        self.caps.set(cap, false);
        pass();
        raw.disable(cap);
      },
      blendFunc(s: number, d: number) {
        const k = `${s},${d},${s},${d}`;
        if (self.blendFn === k) return skip();
        self.blendFn = k;
        pass();
        raw.blendFunc(s, d);
      },
      blendFuncSeparate(s: number, d: number, sa: number, da: number) {
        const k = `${s},${d},${sa},${da}`;
        if (self.blendFn === k) return skip();
        self.blendFn = k;
        pass();
        raw.blendFuncSeparate(s, d, sa, da);
      },
      blendEquation(m: number) {
        const k = `${m},${m}`;
        if (self.blendEq === k) return skip();
        self.blendEq = k;
        pass();
        raw.blendEquation(m);
      },
      blendEquationSeparate(m: number, ma: number) {
        const k = `${m},${ma}`;
        if (self.blendEq === k) return skip();
        self.blendEq = k;
        pass();
        raw.blendEquationSeparate(m, ma);
      },
      viewport(x: number, y: number, w: number, h: number) {
        const k = `${x},${y},${w},${h}`;
        if (self.view === k) return skip();
        self.view = k;
        pass();
        raw.viewport(x, y, w, h);
      },
      scissor(x: number, y: number, w: number, h: number) {
        const k = `${x},${y},${w},${h}`;
        if (self.scis === k) return skip();
        self.scis = k;
        pass();
        raw.scissor(x, y, w, h);
      },
      // Deleting a bound object unbinds it in GL: mirror that.
      deleteTexture(t: Tex) {
        for (const [k, v] of self.textures) if (v === t) self.textures.set(k, null);
        raw.deleteTexture(t);
      },
      deleteFramebuffer(fb: WebGLFramebuffer | null) {
        if (self.readFb === fb) self.readFb = null;
        if (self.drawFb === fb) self.drawFb = null;
        raw.deleteFramebuffer(fb);
      },
      deleteVertexArray(v: WebGLVertexArrayObject | null) {
        if (self.vao === v) self.vao = null;
        raw.deleteVertexArray(v);
      },
      deleteBuffer(b: WebGLBuffer | null) {
        if (self.arrayBuffer === b) self.arrayBuffer = null;
        raw.deleteBuffer(b);
      },
      deleteProgram(p: WebGLProgram | null) {
        // A deleted current program stays in use until replaced; forget it so the next use rebinds.
        if (self.program === p) self.program = undefined;
        raw.deleteProgram(p);
      },
    };
    const Ctor = (globalThis as { WebGL2RenderingContext?: { prototype: object } }).WebGL2RenderingContext;
    if (Ctor && raw instanceof (Ctor as unknown as new () => object)) {
      // A real context: an object with every method bound once (no per-call Proxy cost).
      const out: Record<string, unknown> = {};
      for (let proto: object | null = Object.getPrototypeOf(raw); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        for (const k of Object.getOwnPropertyNames(proto)) {
          if (k === 'constructor' || k in out) continue;
          const d = Object.getOwnPropertyDescriptor(proto, k)!;
          if (typeof d.value === 'function') out[k] = overrides[k] ?? (d.value as (...a: unknown[]) => unknown).bind(raw);
          else if (d.get) Object.defineProperty(out, k, { get: () => (raw as unknown as Record<string, unknown>)[k], enumerable: true });
          else out[k] = d.value;
        }
      }
      return out as unknown as WebGL2RenderingContext;
    }
    // Test fakes (a Proxy): route through a Proxy with the same overrides.
    return new Proxy(raw, {
      get(t, k) {
        if (typeof k === 'string' && overrides[k]) return overrides[k];
        return Reflect.get(t, k);
      },
    });
  }
}
