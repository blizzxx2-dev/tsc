/** ENG-0202: boot-time parallel shader compile with readable errors naming the variant's defines and source lines. */
import { describe, expect, it } from 'vitest';
import { formatShaderLog, ShaderError, shaderDefines } from '../../../src/render/registry';
import { precompileCatalog, shaderCatalog } from '../../../src/render/shaderCatalog';
import { fakeGl } from '../../fakegl';

describe('parallel shader compile (ENG-0202)', () => {
  it('issues every compile up front with KHR_parallel_shader_compile and polls completion across frames', async () => {
    const f = fakeGl({ extensions: ['KHR_parallel_shader_compile'] });
    const variants = shaderCatalog().slice(0, 6);
    // Programs complete one frame at a time.
    let frame = 0;
    const gl = new Proxy(f.gl, {
      get(t, k) {
        if (k === 'getProgramParameter') return (_p: unknown, pname: number) => (pname === t.LINK_STATUS ? true : frame >= 2);
        return Reflect.get(t, k);
      },
    });
    const progress: number[] = [];
    const fails = await precompileCatalog(
      gl,
      variants,
      (n) => progress.push(n),
      async () => void frame++,
    );
    expect(fails).toEqual([]);
    // Every link was issued before the first completion poll resolved.
    const calls = f.calls.map((c) => c.fn);
    expect(calls.filter((c) => c === 'linkProgram')).toHaveLength(6);
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(6);
    expect(frame).toBe(2);
    expect(f.live().Program ?? 0).toBe(0);
  });

  it('falls back to a few compiles per frame without the extension', async () => {
    const f = fakeGl({ extensions: [] });
    let frames = 0;
    const fails = await precompileCatalog(f.gl, shaderCatalog().slice(0, 10), undefined, async () => void frames++);
    expect(fails).toEqual([]);
    expect(frames).toBe(2);
  });

  it('reports a failing variant with its defines and the offending source line', async () => {
    const f = fakeGl({ extensions: ['KHR_parallel_shader_compile'] });
    const bad = {
      name: 'scene',
      vs: '#version 300 es\nvoid main(){}',
      fs: '#version 300 es\n#define KIND 7\nprecision mediump float;\nout vec4 o;\nvoid main(){ o = vec4(nope); }',
    };
    const gl = new Proxy(f.gl, {
      get(t, k) {
        if (k === 'getProgramParameter') return (_p: unknown, pname: number) => pname !== t.LINK_STATUS;
        if (k === 'getShaderParameter') return (s: { kind: string; src?: string }) => !(s as { src?: string }).src?.includes('nope');
        if (k === 'shaderSource') return (s: { src?: string }, src: string) => void (s.src = src);
        if (k === 'getShaderInfoLog') return () => "ERROR: 0:5: 'nope' : undeclared identifier";
        return Reflect.get(t, k);
      },
    });
    const fails = await precompileCatalog(gl, [bad], undefined, async () => undefined);
    expect(fails).toHaveLength(1);
    expect(fails[0].name).toBe('scene [KIND=7]');
    expect(fails[0].stage).toBe('fragment');
    expect(fails[0].log).toContain('5| void main(){ o = vec4(nope); }');
  });

  it('names the variant defines in ShaderError messages', () => {
    expect(shaderDefines('#version 300 es\n#define KIND 3\n#define LIVE_NOISE\nvoid main(){}')).toEqual(['KIND=3', 'LIVE_NOISE']);
    const e = new ShaderError('flesh', 'fragment', 'ERROR: 0:3: bad', '#version 300 es\n#define TIER 2\nfloat x = ;');
    expect(e.message).toContain('[flesh · TIER=2] fragment shader failed');
    expect(e.message).toContain('3| float x = ;');
    expect(formatShaderLog('ERROR: 0:1: x', 'line one')).toContain('1| line one');
  });
});
