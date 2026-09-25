import { describe, expect, it } from 'vitest';
import { classifyTier, fallbackPlan, FULL_CAPS, matchQuirks, QUIRKS, toMediump, type GpuCaps } from '../src/render/caps';
import { Gfx } from '../src/render/gfx';
import { formatShaderLog, GlRegistry, VRAM_BUDGET } from '../src/render/registry';
import { RenderTargetPool } from '../src/render/targets';
import { checkerPixels, Texture, textureBytes } from '../src/render/texture';
import { scissorRect } from '../src/render/viewport';
import { fakeCanvas, fakeGl, installFakeDom } from './fakegl';

const caps = (o: Partial<GpuCaps>): GpuCaps => ({ ...FULL_CAPS, ...o });

describe('GPU tiers, quirks and fallback matrix (ENG-0191–0193)', () => {
  it('classifies by benchmark and lets capability gaps only lower the tier', () => {
    expect(classifyTier(caps({}), 1.2).tier).toBe('high');
    expect(classifyTier(caps({}), 4).tier).toBe('medium');
    expect(classifyTier(caps({}), 12).tier).toBe('low');
    expect(classifyTier(caps({ halfFloatRT: false, floatRT: false }), 1).tier).toBe('medium');
    expect(classifyTier(caps({ maxTextureSize: 2048 }), 1).tier).toBe('low');
    expect(classifyTier(caps({ highpFS: false }), 1).tier).toBe('low');
  });

  it('software rasterisers are forced to Low (quirk + detection)', () => {
    const sw = caps({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', software: true });
    expect(classifyTier(sw, 0.5).tier).toBe('low');
    expect(matchQuirks(sw).some((q) => q.workarounds?.includes('software'))).toBe(true);
  });

  it('quirks are data: a renderer regex caps the tier and sets workarounds', () => {
    const table = [{ match: 'fancy gpu 9000', tier: 'medium' as const, workarounds: ['noMsaa' as const] }];
    const c = caps({ renderer: 'Fancy GPU 9000 rev B' });
    expect(classifyTier(c, 1, table).tier).toBe('medium');
    expect(fallbackPlan(c, table).aa).toBe('fxaa');
    expect(QUIRKS.length).toBeGreaterThan(3);
  });

  it('fallback matrix: float RT, MSAA, texture size, timer query, precision', () => {
    const full = fallbackPlan(caps({}));
    expect(full).toMatchObject({ bloomFormat: 'rgba16f', aa: 'msaa', gpuProfiler: true, fleshVariant: 'full' });
    expect(fallbackPlan(caps({ floatRT: false })).bloomFormat).toBe('rgba8');
    expect(fallbackPlan(caps({ maxSamples: 2 })).aa).toBe('fxaa');
    expect(fallbackPlan(caps({ maxTextureSize: 4096 })).atlasPageSize).toBe(4096);
    expect(fallbackPlan(caps({ timerQuery: false })).gpuProfiler).toBe(false);
    expect(fallbackPlan(caps({ highpFS: false })).fleshVariant).toBe('mediump');
    expect(toMediump('precision highp float;\nhighp vec2 a;')).toBe('precision mediump float;\nmediump vec2 a;');
  });
});

describe('GL resource registry (ENG-0198/0227)', () => {
  it('counts objects and bytes, deletes through GL, and reports the top consumers over budget', () => {
    const f = fakeGl();
    const reg = new GlRegistry(f.gl);
    const a = reg.createTexture('big');
    reg.setBytes(a, 500 * 2 ** 20);
    reg.createBuffer('vbo');
    expect(reg.count()).toBe(2);
    expect(reg.count('texture')).toBe(1);
    const logs: string[] = [];
    expect(reg.checkBudget(VRAM_BUDGET.low, (m) => logs.push(m))).toContain('big');
    reg.checkBudget(VRAM_BUDGET.low, (m) => logs.push(m));
    expect(logs.length).toBe(1); // logged once
    expect(reg.checkBudget(VRAM_BUDGET.high)).toBeNull();
    reg.release(a);
    expect(reg.count('texture')).toBe(0);
    expect(f.count('deleteTexture')).toBe(1);
  });

  it('quotes the failing GLSL line in shader errors', () => {
    const msg = formatShaderLog("ERROR: 0:2: 'foo' : undeclared identifier", 'void main() {\n  foo = 1.0;\n}');
    expect(msg).toContain('2| foo = 1.0;');
  });

  it('context loss drops every handle and restore runs recreate callbacks in order', () => {
    const f = fakeGl();
    const reg = new GlRegistry(f.gl);
    const order: string[] = [];
    reg.onRestore(() => order.push('textures'), 10);
    reg.onRestore(() => order.push('programs'), 0);
    reg.createTexture('t');
    reg.contextLost();
    expect(reg.count()).toBe(0);
    reg.contextRestored();
    expect(order).toEqual(['programs', 'textures']);
    expect(reg.losses).toBe(1);
  });
});

describe('RenderTargetPool (ENG-0107)', () => {
  it('reuses by key, recreates on resize, accounts bytes and falls back from RGBA16F', () => {
    const f = fakeGl();
    const reg = new GlRegistry(f.gl);
    const pool = new RenderTargetPool(reg, false);
    const a = pool.acquire('scene', 1920, 1080);
    expect(pool.acquire('scene', 1920, 1080)).toBe(a);
    expect(a.bytes).toBe(1920 * 1080 * 4);
    const b = pool.acquire('scene', 1280, 720);
    expect(b).not.toBe(a);
    expect(reg.count('texture')).toBe(1);
    expect(pool.acquire('hdr', 64, 64, { format: 'rgba16f' }).format).toBe('rgba8');
    const m = pool.acquire('mask', 256, 128, { format: 'r8', depthStencil: true });
    expect(m.bytes).toBe(256 * 128 * (1 + 4));
    expect(reg.bytes()).toBe(pool.bytes());
    pool.releaseAll();
    expect(reg.count()).toBe(0);
  });

  it('textures track VRAM bytes with the mip overhead and survive a context restore', () => {
    const f = fakeGl();
    const reg = new GlRegistry(f.gl);
    const t = new Texture(reg, checkerPixels(), { filter: 'trilinear' });
    expect(t.bytes).toBe(textureBytes(64, 64, true));
    const before = t.tex;
    reg.contextLost();
    reg.contextRestored();
    expect(t.tex).not.toBe(before);
    expect(reg.count('texture')).toBe(1);
    t.dispose();
    expect(reg.count('texture')).toBe(0);
  });
});

describe('scissor clip conversion (ENG-0027)', () => {
  it('maps safe-area rects to device pixels under DPR and aspect margins', () => {
    // 16:9 at DPR 2: 2560×1440 backbuffer.
    expect(scissorRect({ x: 100, y: 100, w: 200, h: 50 }, { w: 1280, h: 720, ox: 0, oy: 0 }, 2560, 1440)).toEqual({ x: 200, y: 1440 - 300, w: 400, h: 100 });
    // 21:9 view (1720 wide, 220 margin) on a 3440×1440 backbuffer.
    expect(scissorRect({ x: 0, y: 0, w: 1280, h: 720 }, { w: 1720, h: 720, ox: 220, oy: 0 }, 3440, 1440)).toEqual({ x: 440, y: 0, w: 2560, h: 1440 });
  });
});

describe('Gfx batching with a fake WebGL2 context (ENG-0024/0026/0031/0032)', () => {
  installFakeDom();
  const mk = () => {
    const f = fakeGl();
    const g = new Gfx(fakeCanvas(f), 1280, 720);
    return { f, g };
  };
  const pageTex = (g: Gfx, name: string) => {
    const t = new Texture(g.registry, checkerPixels(16), { label: name });
    g.sprites.add(
      {
        name,
        pages: [{ file: '', w: 16, h: 16 }],
        frames: { [`${name}/a`]: { page: 0, x: 0, y: 0, w: 8, h: 8 }, [`${name}/b`]: { page: 0, x: 8, y: 8, w: 8, h: 8, px: 0, py: 0 } },
      },
      [{ tex: t.tex, w: 16, h: 16 }],
    );
    return t;
  };

  it('text and three sprite pages go out in one draw call', () => {
    const { f, g } = mk();
    for (const n of ['p1', 'p2', 'p3']) pageTex(g, n);
    g.beginScreen();
    const before = f.count('drawElements');
    g.text('Lancet', 100, 100, { shadow: false });
    g.sprite('p1/a', 10, 10);
    g.rect(0, 0, 10, 10, 0xffffffff);
    g.sprite('p2/a', 20, 10);
    g.sprite('p3/b', 30, 10);
    g.text('COOL', 200, 100, { shadow: false });
    g.endFrame();
    expect(f.count('drawElements') - before).toBe(1);
    expect(g.stats.drawCalls).toBe(1);
  });

  it('a ninth texture forces a texture flush', () => {
    const { g } = mk();
    const names = Array.from({ length: 9 }, (_, i) => `s${i}`);
    for (const n of names) pageTex(g, n);
    g.beginScreen();
    for (const n of names) g.sprite(`${n}/a`, 0, 0);
    g.endFrame();
    expect(g.stats.flushes.texture).toBe(1);
    expect(g.stats.drawCalls).toBe(2);
  });

  it('sprite() places the frame on its pivot with atlas UVs', () => {
    const { g, f } = mk();
    pageTex(g, 'p');
    g.beginScreen();
    g.sprite('p/b', 50, 60, { scale: 2 });
    g.endFrame();
    const call = f.calls.filter((c) => c.fn === 'bufferSubData' && c.args[0] === f.gl.ARRAY_BUFFER).pop()!;
    const data = call.args[2] as Float32Array;
    // First vertex: top-left at the pivot (0,0) → (50,60); UV (0.5, 0.5); unit 1.
    expect([data[0], data[1], data[2], data[3], data[5]]).toEqual([50, 60, 0.5, 0.5, 1]);
    // Third vertex: bottom-right, 8 px frame × 2 scale.
    expect([data[12], data[13]]).toEqual([66, 76]);
  });

  it('nineSlice keeps corners at their pixel size at any rect size (ENG-0035)', () => {
    const { g, f } = mk();
    const t = new Texture(g.registry, checkerPixels(32), { label: 'panel' });
    g.sprites.add({ name: 'ui', pages: [{ file: '', w: 32, h: 32 }], frames: { 'ui/panel': { page: 0, x: 0, y: 0, w: 32, h: 32 } } }, [
      { tex: t.tex, w: 32, h: 32 },
    ]);
    g.beginScreen();
    g.nineSlice('ui/panel', { x: 100, y: 50, w: 400, h: 300 }, { l: 8, t: 8, r: 8, b: 8 });
    g.endFrame();
    const d = f.calls.filter((c) => c.fn === 'bufferSubData' && c.args[0] === f.gl.ARRAY_BUFFER).pop()!.args[2] as Float32Array;
    // First quad = top-left corner: 8×8 px at the rect origin, UVs 0..0.25.
    expect([d[0], d[1], d[6], d[7], d[12], d[13]]).toEqual([100, 50, 108, 50, 108, 58]);
    expect([d[14], d[15]]).toEqual([0.25, 0.25]);
    // Indexed quads (ENG-0020): 9 quads are 36 vertices and 54 indices.
    expect(g.stats.vertices).toBe(36);
    expect(g.stats.indices).toBe(54);
  });

  it('textured meshes map frame-relative UVs into the atlas (ENG-0039)', () => {
    const { g, f } = mk();
    pageTex(g, 'm');
    g.beginScreen();
    g.mesh([0, 0, 10, 0, 10, 10], [0, 0, 1, 0, 1, 1], [0, 1, 2], 'm/b');
    g.endFrame();
    const d = f.calls.filter((c) => c.fn === 'bufferSubData' && c.args[0] === f.gl.ARRAY_BUFFER).pop()!.args[2] as Float32Array;
    expect([d[2], d[3], d[14], d[15], d[5]]).toEqual([0.5, 0.5, 1, 1, 1]);
  });

  it('a 200k-vertex polyline renders across overflow flushes (ENG-0022)', () => {
    const { g } = mk();
    const pts = Array.from({ length: 200000 }, (_, i) => ({ x: (i % 1000) * 1.2, y: Math.floor(i / 1000) * 3 }));
    g.beginScreen();
    expect(() => g.polyline(pts, 2, 0xffffffff)).not.toThrow();
    g.endFrame();
    expect(g.stats.flushes.overflow).toBeGreaterThan(10);
    expect(g.stats.vertices).toBe((pts.length - 1) * 4);
    expect(g.stats.indices).toBe((pts.length - 1) * 6);
  });

  it('missing sprite frames draw the magenta checker instead of throwing', () => {
    const { g } = mk();
    g.beginScreen();
    expect(() => g.sprite('nope/none', 0, 0)).not.toThrow();
    g.endFrame();
    expect(g.stats.drawCalls).toBe(1);
  });

  it('withBlend restores the previous blend mode even if the callback throws', () => {
    const { g } = mk();
    g.beginScreen();
    expect(() =>
      g.withBlend('multiply', () => {
        throw new Error('x');
      }),
    ).toThrow();
    expect(g.currentBlend).toBe('alpha');
  });

  it('camera changes are uniforms: panning does not change vertex data', () => {
    const { g, f } = mk();
    g.beginScreen();
    g.rect(10, 10, 5, 5, 0xffffffff);
    g.flush();
    const a = Array.from((f.calls.filter((c) => c.fn === 'bufferSubData' && c.args[0] === f.gl.ARRAY_BUFFER).pop()!.args[2] as Float32Array).slice(0, 36));
    g.setCamera([2, 0, 0, 2, -300, -100]);
    g.rect(10, 10, 5, 5, 0xffffffff);
    g.flush();
    const b = Array.from((f.calls.filter((c) => c.fn === 'bufferSubData' && c.args[0] === f.gl.ARRAY_BUFFER).pop()!.args[2] as Float32Array).slice(0, 36));
    expect(b).toEqual(a);
    const xf = f.calls.filter((c) => c.fn === 'uniformMatrix3fv').pop()!.args[2] as Float32Array;
    expect(Array.from(xf)).toEqual([2, 0, 0, 0, 2, 0, -300, -100, 1]);
  });

  it('context loss and restore recreate programs, buffers and the glyph atlas', () => {
    const { g } = mk();
    const programs = g.registry.count('program');
    g.contextLost();
    expect(g.registry.count()).toBe(0);
    g.contextRestored();
    expect(g.registry.count('program')).toBe(programs);
    expect(g.registry.count('buffer')).toBe(2); // vertex + index buffer (ENG-0020)
    expect(g.registry.count('texture')).toBeGreaterThanOrEqual(1);
    g.beginScreen();
    g.text('ok', 0, 0);
    expect(() => g.endFrame()).not.toThrow();
  });

  it('forced fallbacks: no MSAA → FXAA pass, no float targets → RGBA8 bloom', () => {
    const f = fakeGl({ maxSamples: 0, extensions: [] });
    const g = new Gfx(fakeCanvas(f), 1280, 720);
    expect(g.plan.aa).toBe('fxaa');
    expect(g.plan.bloomFormat).toBe('rgba8');
    g.beginWorld();
    g.rect(0, 0, 10, 10, 0xffffffff);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    expect(g.targets.get('fxaa')).toBeDefined();
    // Mip-chain bloom (ENG-0148): five levels, all RGBA8 without float render targets.
    for (let i = 1; i <= 5; i++) expect(g.targets.get(`bloom${i}`)!.format).toBe('rgba8');
  });

  it('render scale shrinks the world target but not the backbuffer', () => {
    const { g } = mk();
    g.renderScale = 0.5;
    g.beginWorld();
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    expect(g.targets.get('scene')!.w).toBe(640);
    expect(g.targets.get('scene')!.h).toBe(360);
  });
});
