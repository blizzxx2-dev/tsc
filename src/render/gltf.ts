/**
 * glTF 2.0 binary (.glb) parser: turns a GLB into flat CPU-side data the 3D renderer uploads.
 * Supports what the Blender pipeline exports: triangle meshes with POSITION, NORMAL, TEXCOORD_0,
 * TANGENT, COLOR_0; u8/u16/u32 indices; the node hierarchy (TRS or matrix); metallic-roughness
 * materials with base-colour, metallic-roughness, normal, occlusion and emissive textures (embedded
 * images); KHR_materials_emissive_strength; and material `extras` (sss, flicker) used by the game.
 */
import { fromTRS, identity, multiply, transformPoint, type Mat4, type V3 } from './mat4';

export interface GltfPrimitive {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array | null;
  tangents: Float32Array | null;
  colors: Float32Array | null;
  indices: Uint16Array | Uint32Array;
  material: number;
}

export interface GltfMaterial {
  name: string;
  baseColor: [number, number, number, number];
  baseColorTex: number | null;
  metallic: number;
  roughness: number;
  metallicRoughnessTex: number | null;
  normalTex: number | null;
  normalScale: number;
  occlusionTex: number | null;
  emissive: V3;
  emissiveTex: number | null;
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff: number;
  doubleSided: boolean;
  /** Game extras: subsurface wrap for skin and wax (0..1), and a candle-flame flicker on emissive. */
  sss: number;
  flicker: number;
}

export interface GltfImage {
  mime: string;
  bytes: Uint8Array;
}

/** A texture: an image plus its sampler wrap mode (repeat unless clamped). */
export interface GltfTexture {
  image: number;
  repeat: boolean;
}

export interface GltfAnchor {
  world: Mat4;
  /** Blender custom properties (exported as glTF extras): colour, intensity, range, fov… */
  extras: Record<string, unknown>;
}

export interface GltfDraw {
  mesh: number;
  world: Mat4;
  name: string;
}

export interface GltfModel {
  meshes: GltfPrimitive[][];
  materials: GltfMaterial[];
  textures: GltfTexture[];
  images: GltfImage[];
  draws: GltfDraw[];
  /** Named empties (anchor points placed in Blender: `cam`, `key`, `candle.*`) with their custom properties. */
  anchors: Map<string, GltfAnchor>;
  bounds: { min: V3; max: V3 };
}

const GLB_MAGIC = 0x46546c67;
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseGlb(buf: ArrayBuffer): GltfModel {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB file');
  if (dv.getUint32(4, true) !== 2) throw new Error('unsupported glTF version');
  let off = 12;
  let json: any = null;
  let bin: Uint8Array | null = null;
  while (off < dv.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const body = new Uint8Array(buf, off + 8, len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB has no JSON chunk');

  const view = (i: number): Uint8Array => {
    const bv = json.bufferViews[i];
    if (!bin) throw new Error('GLB has no BIN chunk');
    return new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset ?? 0), bv.byteLength);
  };
  const accessor = (i: number): Float32Array | Uint16Array | Uint32Array => {
    const a = json.accessors[i];
    const n = COMPONENTS[a.type] * a.count;
    const bv = json.bufferViews[a.bufferView];
    const src = view(a.bufferView);
    const stride = bv.byteStride ?? 0;
    const base = a.byteOffset ?? 0;
    const comps = COMPONENTS[a.type];
    const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType as number]!;
    const dvs = new DataView(src.buffer, src.byteOffset, src.byteLength);
    const read = (o: number): number => {
      switch (a.componentType) {
        case 5126:
          return dvs.getFloat32(o, true);
        case 5125:
          return dvs.getUint32(o, true);
        case 5123:
          return a.normalized ? dvs.getUint16(o, true) / 65535 : dvs.getUint16(o, true);
        case 5122:
          return a.normalized ? Math.max(-1, dvs.getInt16(o, true) / 32767) : dvs.getInt16(o, true);
        case 5121:
          return a.normalized ? dvs.getUint8(o) / 255 : dvs.getUint8(o);
        default:
          return a.normalized ? Math.max(-1, dvs.getInt8(o) / 127) : dvs.getInt8(o);
      }
    };
    const out = a.componentType === 5125 ? new Uint32Array(n) : a.componentType === 5123 && !a.normalized ? new Uint16Array(n) : a.componentType === 5121 && !a.normalized ? new Uint16Array(n) : new Float32Array(n);
    const es = stride || comps * size;
    for (let e = 0; e < a.count; e++) for (let c = 0; c < comps; c++) out[e * comps + c] = read(base + e * es + c * size);
    return out;
  };
  const floats = (i: number | undefined): Float32Array | null => {
    if (i === undefined) return null;
    const v = accessor(i);
    return v instanceof Float32Array ? v : Float32Array.from(v);
  };

  const texIndex = (t: any): number | null => (t && typeof t.index === 'number' ? t.index : null);
  const materials: GltfMaterial[] = (json.materials ?? []).map((m: any) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    const strength = m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    const e = m.emissiveFactor ?? [0, 0, 0];
    return {
      name: m.name ?? '',
      baseColor: pbr.baseColorFactor ?? [1, 1, 1, 1],
      baseColorTex: texIndex(pbr.baseColorTexture),
      metallic: pbr.metallicFactor ?? 1,
      roughness: pbr.roughnessFactor ?? 1,
      metallicRoughnessTex: texIndex(pbr.metallicRoughnessTexture),
      normalTex: texIndex(m.normalTexture),
      normalScale: m.normalTexture?.scale ?? 1,
      occlusionTex: texIndex(m.occlusionTexture),
      emissive: [e[0] * strength, e[1] * strength, e[2] * strength],
      emissiveTex: texIndex(m.emissiveTexture),
      alphaMode: m.alphaMode ?? 'OPAQUE',
      alphaCutoff: m.alphaCutoff ?? 0.5,
      doubleSided: !!m.doubleSided,
      sss: m.extras?.sss ?? 0,
      flicker: m.extras?.flicker ?? 0,
    };
  });
  if (!materials.length)
    materials.push({ name: 'default', baseColor: [0.8, 0.8, 0.8, 1], baseColorTex: null, metallic: 0, roughness: 0.8, metallicRoughnessTex: null, normalTex: null, normalScale: 1, occlusionTex: null, emissive: [0, 0, 0], emissiveTex: null, alphaMode: 'OPAQUE', alphaCutoff: 0.5, doubleSided: false, sss: 0, flicker: 0 });

  const images: GltfImage[] = (json.images ?? []).map((im: any) => ({ mime: im.mimeType ?? 'image/png', bytes: typeof im.bufferView === 'number' ? view(im.bufferView).slice() : new Uint8Array(0) }));
  const textures: GltfTexture[] = (json.textures ?? []).map((t: any) => {
    const s = typeof t.sampler === 'number' ? json.samplers[t.sampler] : {};
    return { image: t.extensions?.KHR_texture_basisu?.source ?? t.source ?? 0, repeat: (s.wrapS ?? 10497) === 10497 };
  });

  const meshes: GltfPrimitive[][] = (json.meshes ?? []).map((m: any) =>
    m.primitives
      .filter((p: any) => (p.mode ?? 4) === 4)
      .map((p: any) => {
        const positions = floats(p.attributes.POSITION)!;
        const count = positions.length / 3;
        let indices: Uint16Array | Uint32Array;
        if (typeof p.indices === 'number') {
          const raw = accessor(p.indices);
          indices = raw instanceof Uint32Array || count > 65535 ? Uint32Array.from(raw) : Uint16Array.from(raw);
        } else indices = count > 65535 ? Uint32Array.from({ length: count }, (_, i) => i) : Uint16Array.from({ length: count }, (_, i) => i);
        let colors = floats(p.attributes.COLOR_0);
        if (colors && colors.length === count * 3) {
          const c4 = new Float32Array(count * 4);
          for (let i = 0; i < count; i++) c4.set([colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2], 1], i * 4);
          colors = c4;
        }
        return {
          positions,
          normals: floats(p.attributes.NORMAL) ?? flatNormals(positions, indices),
          uvs: floats(p.attributes.TEXCOORD_0),
          tangents: floats(p.attributes.TANGENT),
          colors,
          indices,
          material: typeof p.material === 'number' ? p.material : 0,
        };
      }),
  );

  // Walk the scene graph for world transforms.
  const draws: GltfDraw[] = [];
  const anchors = new Map<string, GltfAnchor>();
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  const visit = (ni: number, parent: Mat4) => {
    const n = json.nodes[ni];
    const local = n.matrix ? new Float32Array(n.matrix) : fromTRS(n.translation, n.rotation, n.scale);
    const world = multiply(parent, local);
    if (typeof n.mesh === 'number') {
      draws.push({ mesh: n.mesh, world, name: n.name ?? '' });
      for (const prim of meshes[n.mesh] ?? [])
        for (let i = 0; i < prim.positions.length; i += 3) {
          const p = transformPoint(world, [prim.positions[i], prim.positions[i + 1], prim.positions[i + 2]]);
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[k]);
            max[k] = Math.max(max[k], p[k]);
          }
        }
    } else if (n.name) anchors.set(n.name, { world, extras: n.extras ?? {} });
    for (const c of n.children ?? []) visit(c, world);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  for (const r of scene?.nodes ?? json.nodes?.map((_: unknown, i: number) => i) ?? []) visit(r, identity());
  return { meshes, materials, textures, images, draws, anchors, bounds: { min, max } };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Face normals for meshes exported without them. */
function flatNormals(pos: Float32Array, idx: ArrayLike<number>): Float32Array {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) n[v + k] += f[k];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}
