/** ENG-0146: the post chain is an ordered pass list whose flags drive the generated shader. */
import { describe, expect, it } from 'vitest';
import { POST_PASSES, POST_PASS_COUNT, PostPipeline, postPassDefines } from '../../../src/render/postPasses';
import { POST_FS, postShaderSource } from '../../../src/render/shaders/post';

describe('post pass list', () => {
  it('lists the roadmap passes in pipeline order with unique ids', () => {
    const ids = POST_PASSES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const order = ['bloom', 'chroma', 'litany', 'damage', 'lut', 'vignette', 'grain', 'dither'];
    for (const id of order) expect(ids).toContain(id);
    // Sampling-position passes precede colour passes; output shaping comes last.
    expect(ids.indexOf('chroma')).toBeLessThan(ids.indexOf('bloom'));
    expect(ids.indexOf('lut')).toBeLessThan(ids.indexOf('vignette'));
    expect(ids.indexOf('grain')).toBeLessThan(ids.indexOf('dither'));
    expect(ids[ids.length - 1]).toBe('dither');
  });

  it('generates one macro per pass reading its u_pass slot', () => {
    const defines = postPassDefines();
    POST_PASSES.forEach((p, i) => expect(defines).toContain(`#define P_${p.id.toUpperCase()} u_pass[${i}]`));
    expect(POST_FS).toContain(`uniform float u_pass[${POST_PASS_COUNT}];`);
    // Every pass is actually consulted by the shader body.
    for (const p of POST_PASSES) expect(POST_FS.split(`P_${p.id.toUpperCase()}`).length).toBeGreaterThan(2);
  });

  it('is data-driven: a custom pass list yields a matching shader header', () => {
    const src = postShaderSource([
      { id: 'shake', label: 'a', uniforms: [] },
      { id: 'bloom', label: 'b', uniforms: [] },
    ]);
    expect(src).toContain('uniform float u_pass[2];');
    expect(src).toContain('#define P_BLOOM u_pass[1]');
  });

  it('flags default on, toggle by id and reject unknown ids', () => {
    const chain = new PostPipeline();
    expect(chain.flags().every((f) => f === 1)).toBe(true);
    expect(chain.setEnabled('bloom', false)).toBe(true);
    expect(chain.enabled('bloom')).toBe(false);
    expect(chain.flags()[chain.index('bloom')]).toBe(0);
    expect(chain.toggle('bloom')).toBe(true);
    expect(chain.enabled('bloom')).toBe(true);
    expect(chain.setEnabled('nope', true)).toBe(false);
    chain.setAll(false);
    expect(chain.flags().every((f) => f === 0)).toBe(true);
    expect(chain.describe().split('\n')).toHaveLength(POST_PASS_COUNT);
  });
});
