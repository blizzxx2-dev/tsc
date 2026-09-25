/** ENG-0029: the GL state cache leaves no redundant state calls in a steady-state frame. */
import { describe, expect, it } from 'vitest';
import { GlStateCache } from '../../../src/render/stateCache';
import { fakeCanvas, fakeGl, installFakeDom, type FakeGl } from '../../fakegl';

/** Replays raw GL calls through a state model and counts the ones that changed nothing. */
function redundant(f: FakeGl, calls: FakeGl['calls']): string[] {
  const gl = f.gl as unknown as Record<string, number>;
  const st = new Map<string, unknown>();
  let unit = gl.TEXTURE0;
  const out: string[] = [];
  const set = (k: string, v: unknown, name: string) => {
    if (st.has(k) && JSON.stringify(st.get(k)) === JSON.stringify(v) && st.get(k) === v) out.push(name);
    else if (st.has(k) && typeof v !== 'object' && st.get(k) === v) out.push(name);
    st.set(k, v);
  };
  for (const c of calls) {
    const a = c.args;
    switch (c.fn) {
      case 'useProgram':
        set('prog', a[0], c.fn);
        break;
      case 'bindVertexArray':
        set('vao', a[0], c.fn);
        break;
      case 'activeTexture':
        if (unit === a[0]) out.push(c.fn);
        unit = a[0] as number;
        break;
      case 'bindTexture':
        set(`tex:${unit}:${a[0]}`, a[1], c.fn);
        break;
      case 'bindBuffer':
        if (a[0] === gl.ARRAY_BUFFER) set('ab', a[1], c.fn);
        break;
      case 'bindFramebuffer':
        set(`fb:${a[0]}`, a[1], c.fn);
        break;
      case 'enable':
      case 'disable':
        set(`cap:${a[0]}`, c.fn, c.fn);
        break;
      case 'blendFunc':
        set('blend', `${a[0]},${a[1]},${a[0]},${a[1]}`, c.fn);
        break;
      case 'blendFuncSeparate':
        set('blend', a.join(','), c.fn);
        break;
      case 'viewport':
        set('viewport', a.join(','), c.fn);
        break;
    }
  }
  return out;
}

async function steadyFrame() {
  installFakeDom();
  const { Gfx } = await import('../../../src/render/gfx');
  const f = fakeGl();
  const g = new Gfx(fakeCanvas(f), 1280, 720);
  const frame = () => {
    g.beginLayer('surface');
    g.circle(600, 400, 30, 0x80ffffff);
    g.endLayer();
    g.beginWorld();
    g.rect(0, 0, 100, 100, 0xff0000ff);
    g.setBlend('add');
    g.glow(640, 360, 40, 0xffffffff);
    g.setBlend('alpha');
    g.text('Vitals', 40, 40, { size: 20 });
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'operation' });
    g.rect(10, 10, 200, 40, 0xff202020);
    g.text('Score 1200', 20, 36, { size: 18 });
    g.endFrame();
    g.resetStats();
  };
  frame();
  frame();
  const mark = f.calls.length;
  frame();
  return { f, g, calls: f.calls.slice(mark) };
}

describe('GL state cache (ENG-0029)', () => {
  it('forwards no redundant program, VAO, texture, framebuffer, blend or viewport calls in a steady frame', async () => {
    const { f, g, calls } = await steadyFrame();
    expect(redundant(f, calls)).toEqual([]);
    expect(g.stateCache.stats.skipped).toBeGreaterThan(20);
  });

  it('tracks bindings across units and forgets deleted objects', () => {
    const f = fakeGl();
    const c = new GlStateCache(f.gl);
    const gl = c.gl;
    const t1 = gl.createTexture();
    const t2 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t1);
    gl.bindTexture(gl.TEXTURE_2D, t1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, t1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t2);
    gl.deleteTexture(t2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    expect(f.calls.filter((x) => x.fn === 'bindTexture')).toHaveLength(3);
    expect(c.stats.skipped).toBe(2);
    c.reset();
    gl.useProgram(null);
    expect(f.count('useProgram')).toBe(1);
  });
});
