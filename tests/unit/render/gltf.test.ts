import { Document, NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../../../src/render/gltf';
import { mergeLights } from '../../../src/scenes/sets';

async function glb(): Promise<ArrayBuffer> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const pos = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buf);
  const idx = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buf);
  const tex = doc
    .createTexture('wood')
    .setImage(new Uint8Array([1, 2, 3]))
    .setMimeType('image/png');
  const mat = doc
    .createMaterial('oak')
    .setBaseColorFactor([0.5, 0.4, 0.3, 1])
    .setRoughnessFactor(0.7)
    .setMetallicFactor(0)
    .setBaseColorTexture(tex)
    .setExtras({ sss: 0.4 });
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx).setMaterial(mat);
  const mesh = doc.createMesh('tri').addPrimitive(prim);
  const child = doc.createNode('tri').setMesh(mesh).setTranslation([0, 2, 0]);
  const parent = doc.createNode('root').setTranslation([10, 0, 0]).addChild(child);
  const cam = doc.createNode('cam').setTranslation([0, 1, 5]).setExtras({ fov: 40 });
  doc.createScene('s').addChild(parent).addChild(cam);
  const bytes = await new NodeIO().writeBinary(doc);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('glTF binary parser', () => {
  it('reads meshes, materials, world transforms, anchors and extras', async () => {
    const m = parseGlb(await glb());
    expect(m.meshes).toHaveLength(1);
    expect(Array.from(m.meshes[0][0].indices)).toEqual([0, 1, 2]);
    expect(m.meshes[0][0].normals.length).toBe(9); // generated flat normals
    expect(m.materials[0]).toMatchObject({ name: 'oak', metallic: 0, sss: 0.4 });
    expect(m.materials[0].roughness).toBeCloseTo(0.7);
    expect(m.materials[0].baseColorTex).toBe(0);
    expect(m.images[0]).toMatchObject({ mime: 'image/png' });
    // Parent (10,0,0) × child (0,2,0): the draw sits at (10,2,0).
    expect(Array.from(m.draws[0].world.slice(12, 15))).toEqual([10, 2, 0]);
    expect(m.bounds.min).toEqual([10, 2, 0]);
    expect(m.bounds.max).toEqual([11, 3, 0]);
    const cam = m.anchors.get('cam')!;
    expect(Array.from(cam.world.slice(12, 15))).toEqual([0, 1, 5]);
    expect(cam.extras).toEqual({ fov: 40 });
  });

  it('rejects files that are not GLB', () => {
    expect(() => parseGlb(new ArrayBuffer(16))).toThrow(/not a GLB/);
  });
});

describe('set candle lights', () => {
  it('merges the closest candles until the cap, keeping the total light', () => {
    const ls = [0, 0.1, 0.2, 5, 10].map((x) => ({ pos: [x, 0, 0] as [number, number, number], color: [1, 1, 1] as [number, number, number], range: 2 }));
    const m = mergeLights(ls, 3);
    expect(m).toHaveLength(3);
    expect(m.reduce((s, l) => s + l.color[0], 0)).toBe(5);
    expect(m[0].pos[0]).toBeCloseTo(0.1);
  });
});
