/**
 * Headless stand-ins for WebGL2 and a 2D canvas, enough to construct `Gfx`
 * and exercise batching, the resource registry and render targets in Node.
 * Every GL call is logged; constants resolve to stable unique numbers.
 */
export interface FakeGl {
  gl: WebGL2RenderingContext;
  calls: { fn: string; args: unknown[] }[];
  count(fn: string): number;
  /** Objects created and not deleted, by kind. */
  live(): Record<string, number>;
  lose(): void;
}

export function fakeGl(opts: { maxSamples?: number; extensions?: string[]; renderer?: string } = {}): FakeGl {
  const calls: { fn: string; args: unknown[] }[] = [];
  const consts = new Map<string, number>();
  const live = new Map<object, string>();
  let lost = false;
  const exts = new Set(opts.extensions ?? ['EXT_color_buffer_float', 'EXT_disjoint_timer_query_webgl2', 'WEBGL_debug_renderer_info']);
  const special: Record<string, (...a: unknown[]) => unknown> = {
    getParameter: (p) => {
      if (p === c('MAX_SAMPLES')) return opts.maxSamples ?? 4;
      if (p === c('MAX_TEXTURE_SIZE')) return 8192;
      if (p === c('UNMASKED_RENDERER_WEBGL') || p === c('RENDERER')) return opts.renderer ?? 'ANGLE (Fake GPU)';
      if (p === c('MAX_TEXTURE_MAX_ANISOTROPY_EXT')) return 16;
      return 0;
    },
    getExtension: (name) => (exts.has(name as string) ? new Proxy({}, { get: (_t, k) => c(String(k)) }) : null),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    getUniformLocation: () => ({}),
    checkFramebufferStatus: () => c('FRAMEBUFFER_COMPLETE'),
    isContextLost: () => lost,
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getError: () => 0,
    getQueryParameter: () => false,
  };
  function c(name: string): number {
    let v = consts.get(name);
    if (v === undefined) consts.set(name, (v = 0x1000 + consts.size));
    return v;
  }
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_t, key) {
      const k = String(key);
      if (/^[A-Z0-9_]+$/.test(k)) return c(k);
      if (k === 'then') return undefined;
      return (...args: unknown[]) => {
        calls.push({ fn: k, args });
        if (special[k]) return special[k](...args);
        const m = /^create(\w+)$/.exec(k);
        if (m) {
          const o = { kind: m[1] };
          live.set(o, m[1]);
          return o;
        }
        if (/^delete\w+$/.test(k) && args[0]) live.delete(args[0] as object);
        return undefined;
      };
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    calls,
    count: (fn) => calls.filter((x) => x.fn === fn).length,
    live: () => {
      const out: Record<string, number> = {};
      for (const k of live.values()) out[k] = (out[k] ?? 0) + 1;
      return out;
    },
    lose: () => {
      lost = true;
    },
  };
}

/** Minimal DOM for GlyphAtlas: a 2D canvas that measures every glyph as 20 px wide. */
export function installFakeDom(): void {
  const ctx2d = new Proxy({} as Record<string, unknown>, {
    get(_t, k) {
      if (k === 'measureText') return (s: string) => ({ width: 20 * [...s].length, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 12 });
      if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      return () => undefined;
    },
    set: () => true,
  });
  const g = globalThis as unknown as { document?: unknown };
  g.document ??= {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }),
  };
}

/** A canvas whose getContext('webgl2') returns the fake. */
export function fakeCanvas(f: FakeGl, w = 1280, h = 720): HTMLCanvasElement {
  return { width: w, height: h, getContext: () => f.gl } as unknown as HTMLCanvasElement;
}
