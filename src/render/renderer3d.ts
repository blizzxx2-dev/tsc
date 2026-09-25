/**
 * The 3D layer: glTF models drawn into the world target (before the 2D world batch and the post
 * chain), so sets, props and busts are graded, bloomed and vignetted with everything else.
 *
 * Shading is metallic-roughness PBR (GGX / Smith / Schlick) in linear light, written out in the
 * display-referred space the 2D layer uses. Lighting is built for candle-lit interiors: one
 * shadowed key light (a spot: the operating lamp or a window), up to six point lights (candles,
 * braziers) with flicker, a sky/ground hemisphere ambient, and exponential fog. Materials may
 * carry `sss` (wrap lighting with a warm transmission for skin, wax and cloth) and `flicker`
 * (candle-flame emissive).
 */
import type { GltfMaterial, GltfModel } from './gltf';
import { lookAt, multiply, normalMatrix, perspective, type Mat4, type V3 } from './mat4';
import type { GlRegistry } from './registry';
import { uploadKtx2 } from './ktx2';

const MAX_LIGHTS = 6;
const SHADOW_SIZE = 4096;

export interface PointLight {
  pos: V3;
  /** Linear RGB × intensity. */
  color: V3;
  range: number;
  /** 0..1 candle flicker amount. */
  flicker?: number;
}

export interface KeyLight {
  pos: V3;
  target: V3;
  color: V3;
  /** Full cone angle in radians. */
  cone: number;
  range: number;
  shadow?: boolean;
}

export interface Camera3D {
  pos: V3;
  target: V3;
  fovY: number;
  near?: number;
  far?: number;
}

export interface Scene3D {
  camera: Camera3D;
  key?: KeyLight;
  lights: PointLight[];
  ambient: { sky: V3; ground: V3 };
  fog?: { color: V3; density: number };
  exposure?: number;
  items: { model: Model3D; matrix?: Mat4 }[];
  time?: number;
  /** Where to draw, in output pixels (defaults to the whole bound target). */
  viewport?: { x: number; y: number; w: number; h: number };
  /** Clear colour+depth of the viewport first (icons); otherwise depth only. */
  clearColor?: [number, number, number, number];
}

export const PBR_VS = /* glsl */ `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec2 a_uv;
layout(location=3) in vec4 a_tan;
layout(location=4) in vec4 a_col;
uniform mat4 u_model;
uniform mat4 u_viewProj;
uniform mat4 u_lightVP;
uniform mat3 u_nrmMat;
out vec3 v_world;
out vec3 v_nrm;
out vec2 v_uv;
out vec4 v_tan;
out vec4 v_col;
out vec4 v_light;
void main() {
  vec4 w = u_model * vec4(a_pos, 1.0);
  v_world = w.xyz;
  v_nrm = normalize(u_nrmMat * a_nrm);
  v_tan = vec4(normalize(mat3(u_model) * a_tan.xyz), a_tan.w);
  v_uv = a_uv;
  v_col = a_col;
  v_light = u_lightVP * w;
  gl_Position = u_viewProj * w;
}`;

export const PBR_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_world;
in vec3 v_nrm;
in vec2 v_uv;
in vec4 v_tan;
in vec4 v_col;
in vec4 v_light;
uniform vec3 u_camPos;
uniform vec4 u_base;
uniform vec2 u_mr;
uniform vec3 u_emis;
uniform vec4 u_has;      // base, mr, normal, occlusion
uniform float u_hasEmis;
uniform float u_hasTan;
uniform float u_normalScale;
uniform float u_sss;
uniform float u_flicker;
uniform float u_alphaCut;
uniform sampler2D t_base;
uniform sampler2D t_mr;
uniform sampler2D t_nrm;
uniform sampler2D t_occ;
uniform sampler2D t_emis;
uniform sampler2DShadow t_shadow;
uniform int u_nLights;
uniform vec3 u_lightPos[${MAX_LIGHTS}];
uniform vec3 u_lightCol[${MAX_LIGHTS}];
uniform float u_lightRange[${MAX_LIGHTS}];
uniform vec3 u_keyPos;
uniform vec3 u_keyDir;
uniform vec3 u_keyCol;
uniform float u_keyCos;
uniform float u_keyRange;
uniform float u_shadowOn;
uniform vec3 u_ambSky;
uniform vec3 u_ambGround;
uniform vec3 u_fogCol;
uniform float u_fogDensity;
uniform float u_exposure;
uniform float u_time;
out vec4 o;

const float PI = 3.14159265;
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

float D_GGX(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float G_Smith(float nv, float nl, float r) { float k = (r + 1.0) * (r + 1.0) / 8.0; return (nv / (nv * (1.0 - k) + k)) * (nl / (nl * (1.0 - k) + k)); }
vec3 F_Schlick(float vh, vec3 f0) { return f0 + (1.0 - f0) * pow(1.0 - vh, 5.0); }

vec3 shade(vec3 L, vec3 radiance, vec3 N, vec3 V, vec3 albedo, float metal, float rough, vec3 f0) {
  vec3 H = normalize(L + V);
  float nl = dot(N, L);
  float nv = max(dot(N, V), 1e-4);
  float nlc = max(nl, 0.0);
  float nh = max(dot(N, H), 0.0);
  float vh = max(dot(V, H), 0.0);
  vec3 F = F_Schlick(vh, f0);
  float a = max(rough * rough, 0.002);
  vec3 spec = D_GGX(nh, a) * G_Smith(nv, nlc, rough) * F / max(4.0 * nv * nlc, 1e-4);
  vec3 kd = (1.0 - F) * (1.0 - metal);
  // Subsurface: wrap the terminator and let a warm, reddened light through thin parts.
  float w = u_sss * 0.5;
  float wrapped = max((nl + w) / (1.0 + w), 0.0);
  vec3 diffuse = kd * albedo / PI * mix(vec3(nlc), vec3(wrapped) * vec3(1.0, 0.72, 0.6) + vec3(nlc) * vec3(0.0, 0.28, 0.4), u_sss);
  return (diffuse + spec * nlc) * radiance;
}

float shadowAt(vec4 lp, float nl) {
  if (u_shadowOn < 0.5) return 1.0;
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = mix(0.0025, 0.0006, clamp(nl, 0.0, 1.0));
  float s = 0.0;
  vec2 texel = vec2(1.0 / ${SHADOW_SIZE}.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) s += texture(t_shadow, vec3(p.xy + vec2(x, y) * texel * 1.5, p.z - bias));
  return s / 9.0;
}

void main() {
  vec4 base = u_base * v_col;
  if (u_has.x > 0.5) { vec4 t = texture(t_base, v_uv); base *= vec4(toLinear(t.rgb), t.a); }
  if (base.a < u_alphaCut) discard;
  float rough = u_mr.y;
  float metal = u_mr.x;
  if (u_has.y > 0.5) { vec4 t = texture(t_mr, v_uv); rough *= t.g; metal *= t.b; }
  rough = clamp(rough, 0.04, 1.0);
  vec3 N = normalize(v_nrm);
  if (!gl_FrontFacing) N = -N;
  if (u_has.z > 0.5) {
    vec3 tn = texture(t_nrm, v_uv).xyz * 2.0 - 1.0;
    tn.xy *= u_normalScale;
    vec3 T;
    vec3 B;
    if (u_hasTan > 0.5) { T = normalize(v_tan.xyz - N * dot(N, v_tan.xyz)); B = cross(N, T) * v_tan.w; }
    else {
      // Derivative-based tangent frame when the mesh has none.
      vec3 dp1 = dFdx(v_world); vec3 dp2 = dFdy(v_world);
      vec2 du1 = dFdx(v_uv); vec2 du2 = dFdy(v_uv);
      vec3 dp2p = cross(dp2, N); vec3 dp1p = cross(N, dp1);
      T = dp2p * du1.x + dp1p * du2.x; B = dp2p * du1.y + dp1p * du2.y;
      float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
      T *= inv; B *= inv;
    }
    N = normalize(mat3(T, B, N) * tn);
  }
  float ao = u_has.w > 0.5 ? texture(t_occ, v_uv).r : 1.0;
  vec3 V = normalize(u_camPos - v_world);
  vec3 albedo = base.rgb;
  vec3 f0 = mix(vec3(0.04), albedo, metal);
  vec3 col = vec3(0.0);

  // Key light (spot) with shadow.
  if (u_keyRange > 0.0) {
    vec3 Lv = u_keyPos - v_world;
    float dist = length(Lv);
    vec3 L = Lv / dist;
    float cone = smoothstep(u_keyCos, mix(u_keyCos, 1.0, 0.35), dot(-L, u_keyDir));
    float att = cone / (1.0 + dist * dist * 0.09) * clamp(1.0 - pow(dist / u_keyRange, 4.0), 0.0, 1.0);
    if (att > 0.0) col += shade(L, u_keyCol * att * shadowAt(v_light, dot(N, L)), N, V, albedo, metal, rough, f0);
  }
  // Point lights (candles), each with its own flicker.
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= u_nLights) break;
    vec3 Lv = u_lightPos[i] - v_world;
    float dist = length(Lv);
    float r = u_lightRange[i];
    float fall = clamp(1.0 - pow(dist / r, 4.0), 0.0, 1.0);
    float att = fall * fall / (dist * dist + 1.0);
    col += shade(Lv / dist, u_lightCol[i] * att, N, V, albedo, metal, rough, f0);
  }
  // Hemisphere ambient, with a rough approximation of reflected ambient for metals.
  vec3 amb = mix(u_ambGround, u_ambSky, N.y * 0.5 + 0.5);
  vec3 R = reflect(-V, N);
  vec3 ambSpec = mix(u_ambGround, u_ambSky, R.y * 0.5 + 0.5) * F_Schlick(max(dot(N, V), 0.0), f0) * (1.0 - rough);
  col += (amb * albedo * (1.0 - metal) + ambSpec * 1.5) * ao;
  // Emissive (candle flames, embers).
  vec3 em = u_emis;
  if (u_hasEmis > 0.5) em *= toLinear(texture(t_emis, v_uv).rgb);
  float fl = 1.0 - u_flicker * (0.25 + 0.25 * sin(u_time * 11.0 + v_world.x * 7.0) * sin(u_time * 4.3 + v_world.z * 5.0));
  col += em * fl;
  col *= u_exposure;
  // Fog toward the room's darkness.
  float fd = length(u_camPos - v_world);
  col = mix(toLinear(u_fogCol), col, exp(-u_fogDensity * fd));
  // Back to the display-referred space the 2D layer and post chain work in.
  o = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), base.a);
}`;

export const SHADOW_VS = /* glsl */ `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_model;
uniform mat4 u_lightVP;
void main() { gl_Position = u_lightVP * u_model * vec4(a_pos, 1.0); }`;

export const SHADOW_FS = /* glsl */ `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(1.0); }`;

interface GpuPrim {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  count: number;
  type: number;
  material: GltfMaterial;
  hasTan: boolean;
}

/** A glTF model on the GPU. Keeps its parsed data so it can rebuild after a context loss. */
export class Model3D {
  private prims: GpuPrim[][] = [];
  private textures: (WebGLTexture | null)[] = [];
  private bitmaps: (ImageBitmap | null)[] = [];
  private ready = false;
  private offRestore: () => void;
  /** Texture bytes on the GPU (compressed where the device allows). */
  gpuBytes = 0;

  private constructor(
    private gl: WebGL2RenderingContext,
    private reg: GlRegistry,
    readonly data: GltfModel,
    private anisotropy: number,
  ) {
    this.offRestore = reg.onRestore(() => {
      this.prims = [];
      this.textures = [];
      this.ready = false;
      void this.upload();
    }, 30);
  }

  /** Decode (PNG/JPEG) or transcode (KTX2) the embedded images and upload everything. */
  static async create(gl: WebGL2RenderingContext, reg: GlRegistry, data: GltfModel, anisotropy = 1): Promise<Model3D> {
    const m = new Model3D(gl, reg, data, anisotropy);
    m.bitmaps = await Promise.all(
      data.images.map((im) =>
        im.mime !== 'image/ktx2' && typeof createImageBitmap === 'function' && im.bytes.length
          ? createImageBitmap(new Blob([im.bytes as Uint8Array<ArrayBuffer>], { type: im.mime }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).catch(() => null)
          : Promise.resolve(null),
      ),
    );
    await m.upload();
    return m;
  }

  get isReady(): boolean {
    return this.ready;
  }

  /** Named anchors from the scene (camera and light placeholders set in Blender). */
  anchor(name: string): { world: Mat4; extras: Record<string, unknown> } | undefined {
    return this.data.anchors.get(name);
  }

  /** Anchors whose name starts with `prefix` (e.g. every `candle.`). */
  anchors(prefix: string): { name: string; world: Mat4; extras: Record<string, unknown> }[] {
    return [...this.data.anchors].filter(([n]) => n.startsWith(prefix)).map(([name, a]) => ({ name, ...a }));
  }

  private uploadBitmap(bmp: ImageBitmap, repeat: boolean): WebGLTexture {
    const gl = this.gl;
    const t = this.reg.createTexture('model-tex');
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext && this.anisotropy > 1) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropy);
    const bytes = Math.round(bmp.width * bmp.height * 4 * (4 / 3));
    this.reg.setBytes(t, bytes);
    this.gpuBytes += bytes;
    return t;
  }

  private async upload(): Promise<void> {
    const gl = this.gl;
    this.gpuBytes = 0;
    // One GPU texture per image; textures sharing an image share it.
    const byImage = new Map<number, Promise<WebGLTexture | null>>();
    const imageTex = (i: number, repeat: boolean): Promise<WebGLTexture | null> => {
      let p = byImage.get(i);
      if (!p) {
        const im = this.data.images[i];
        const bmp = this.bitmaps[i];
        p = im?.mime === 'image/ktx2' ? uploadKtx2(gl, this.reg, im.bytes, repeat, this.anisotropy).then((u) => (u ? ((this.gpuBytes += u.bytes), u.tex) : null)) : Promise.resolve(bmp ? this.uploadBitmap(bmp, repeat) : null);
        byImage.set(i, p);
      }
      return p;
    };
    this.textures = await Promise.all(this.data.textures.map((tx) => imageTex(tx.image, tx.repeat)));
    this.prims = this.data.meshes.map((mesh) =>
      mesh.map((p) => {
        const vao = this.reg.createVertexArray('model-vao');
        gl.bindVertexArray(vao);
        const buffers: WebGLBuffer[] = [];
        const attr = (loc: number, data: Float32Array | null, size: number, fallback: number[]) => {
          if (!data) {
            gl.disableVertexAttribArray(loc);
            gl.vertexAttrib4f(loc, fallback[0], fallback[1], fallback[2], fallback[3]);
            return;
          }
          const b = this.reg.createBuffer('model-vbo');
          gl.bindBuffer(gl.ARRAY_BUFFER, b);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          this.reg.setBytes(b, data.byteLength);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
          buffers.push(b);
        };
        attr(0, p.positions, 3, [0, 0, 0, 1]);
        attr(1, p.normals, 3, [0, 1, 0, 0]);
        attr(2, p.uvs, 2, [0, 0, 0, 0]);
        attr(3, p.tangents, 4, [1, 0, 0, 1]);
        attr(4, p.colors, 4, [1, 1, 1, 1]);
        const ib = this.reg.createBuffer('model-ibo');
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.indices, gl.STATIC_DRAW);
        this.reg.setBytes(ib, p.indices.byteLength);
        buffers.push(ib);
        gl.bindVertexArray(null);
        return { vao, buffers, count: p.indices.length, type: p.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, material: this.data.materials[p.material] ?? this.data.materials[0], hasTan: !!p.tangents };
      }),
    );
    this.ready = true;
  }

  texture(i: number | null): WebGLTexture | null {
    return i === null ? null : (this.textures[i] ?? null);
  }

  /** Every primitive with its world matrix (model matrix × node transform). */
  *draws(matrix: Mat4 | undefined): Generator<{ prim: GpuPrim; world: Mat4 }> {
    for (const d of this.data.draws) for (const prim of this.prims[d.mesh] ?? []) yield { prim, world: matrix ? multiply(matrix, d.world) : d.world };
  }

  dispose(): void {
    this.offRestore();
    for (const mesh of this.prims)
      for (const p of mesh) {
        this.reg.release(p.vao);
        for (const b of p.buffers) this.reg.release(b);
      }
    for (const t of new Set(this.textures)) this.reg.release(t);
    for (const b of this.bitmaps) b?.close();
    this.prims = [];
    this.textures = [];
    this.ready = false;
  }
}

/** Draws Scene3D into whatever framebuffer is bound (with a depth attachment). */
export class Renderer3D {
  private prog!: WebGLProgram;
  private shadowProg!: WebGLProgram;
  private shadowFb: WebGLFramebuffer | null = null;
  private shadowTex: WebGLTexture | null = null;
  private white!: WebGLTexture;
  private locs = new Map<string, WebGLUniformLocation | null>();
  stats = { draws: 0, tris: 0 };

  constructor(
    private gl: WebGL2RenderingContext,
    private reg: GlRegistry,
  ) {
    this.build();
    reg.onRestore(() => {
      this.locs.clear();
      this.shadowFb = this.shadowTex = null;
      this.build();
    }, 25);
  }

  private build(): void {
    const gl = this.gl;
    this.prog = this.reg.createProgram('pbr', PBR_VS, PBR_FS);
    this.shadowProg = this.reg.createProgram('pbr-shadow', SHADOW_VS, SHADOW_FS);
    this.white = this.reg.createTexture('pbr-white');
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    const key = `${p === this.prog ? 'm' : 's'}:${name}`;
    if (!this.locs.has(key)) this.locs.set(key, this.gl.getUniformLocation(p, name));
    return this.locs.get(key)!;
  }

  private ensureShadow(): void {
    if (this.shadowFb) return;
    const gl = this.gl;
    this.shadowTex = this.reg.createTexture('shadow-map');
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.reg.setBytes(this.shadowTex, SHADOW_SIZE * SHADOW_SIZE * 4);
    this.shadowFb = this.reg.createFramebuffer('shadow-map');
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
  }

  /**
   * Draw a scene into the currently bound framebuffer. `target` is that framebuffer (restored after
   * the shadow pass) and its size; the viewport may be a sub-rect (icons).
   */
  render(s: Scene3D, target: { fb: WebGLFramebuffer | null; w: number; h: number }): void {
    const gl = this.gl;
    this.stats.draws = this.stats.tris = 0;
    const vp = s.viewport ?? { x: 0, y: 0, w: target.w, h: target.h };
    const cam = s.camera;
    const proj = perspective(cam.fovY, vp.w / vp.h, cam.near ?? 0.05, cam.far ?? 60);
    const viewProj = multiply(proj, lookAt(cam.pos, cam.target));
    const key = s.key;
    const shadowed = !!key?.shadow;
    const lightVP = key ? multiply(perspective(key.cone * 1.05, 1, 0.1, key.range), lookAt(key.pos, key.target, Math.abs(key.target[1] - key.pos[1]) > 0.99 * Math.hypot(key.target[0] - key.pos[0], key.target[1] - key.pos[1], key.target[2] - key.pos[2]) ? [0, 0, 1] : [0, 1, 0])) : new Float32Array(16);

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);

    // Shadow pass from the key light.
    if (shadowed) {
      this.ensureShadow();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
      gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.shadowProg);
      gl.uniformMatrix4fv(this.u(this.shadowProg, 'u_lightVP'), false, lightVP);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.5, 3);
      gl.disable(gl.CULL_FACE);
      for (const it of s.items)
        for (const { prim, world } of it.model.draws(it.matrix)) {
          if (prim.material.alphaMode === 'BLEND') continue;
          gl.uniformMatrix4fv(this.u(this.shadowProg, 'u_model'), false, world);
          gl.bindVertexArray(prim.vao);
          gl.drawElements(gl.TRIANGLES, prim.count, prim.type, 0);
        }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
    gl.viewport(vp.x, vp.y, vp.w, vp.h);
    if (s.viewport) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(vp.x, vp.y, vp.w, vp.h);
    }
    if (s.clearColor) {
      gl.clearColor(...s.clearColor);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    } else gl.clear(gl.DEPTH_BUFFER_BIT);

    const p = this.prog;
    gl.useProgram(p);
    const U = (n: string) => this.u(p, n);
    gl.uniformMatrix4fv(U('u_viewProj'), false, viewProj);
    gl.uniformMatrix4fv(U('u_lightVP'), false, lightVP);
    gl.uniform3fv(U('u_camPos'), cam.pos);
    const t = s.time ?? 0;
    const lights = s.lights.slice(0, MAX_LIGHTS);
    gl.uniform1i(U('u_nLights'), lights.length);
    if (lights.length) {
      gl.uniform3fv(U('u_lightPos'), lights.flatMap((l) => l.pos));
      gl.uniform3fv(
        U('u_lightCol'),
        lights.flatMap((l, i) => {
          const f = 1 - (l.flicker ?? 0) * (0.18 + 0.18 * Math.sin(t * 9.3 + i * 2.1) * Math.sin(t * 3.7 + i));
          return l.color.map((c) => c * f);
        }),
      );
      gl.uniform1fv(U('u_lightRange'), lights.map((l) => l.range));
    }
    if (key) {
      const d = [key.target[0] - key.pos[0], key.target[1] - key.pos[1], key.target[2] - key.pos[2]];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      gl.uniform3fv(U('u_keyPos'), key.pos);
      gl.uniform3f(U('u_keyDir'), d[0] / dl, d[1] / dl, d[2] / dl);
      gl.uniform3fv(U('u_keyCol'), key.color);
      gl.uniform1f(U('u_keyCos'), Math.cos(key.cone / 2));
      gl.uniform1f(U('u_keyRange'), key.range);
    } else gl.uniform1f(U('u_keyRange'), 0);
    gl.uniform1f(U('u_shadowOn'), shadowed ? 1 : 0);
    gl.uniform3fv(U('u_ambSky'), s.ambient.sky);
    gl.uniform3fv(U('u_ambGround'), s.ambient.ground);
    gl.uniform3fv(U('u_fogCol'), s.fog?.color ?? [0, 0, 0]);
    gl.uniform1f(U('u_fogDensity'), s.fog?.density ?? 0);
    gl.uniform1f(U('u_exposure'), s.exposure ?? 1);
    gl.uniform1f(U('u_time'), t);
    const units: [string, number][] = [
      ['t_base', 0],
      ['t_mr', 1],
      ['t_nrm', 2],
      ['t_occ', 3],
      ['t_emis', 4],
      ['t_shadow', 5],
    ];
    for (const [n, i] of units) gl.uniform1i(U(n), i);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, shadowed ? this.shadowTex : null);

    const opaque: { prim: GpuPrim; world: Mat4; model: Model3D }[] = [];
    const blended: typeof opaque = [];
    for (const it of s.items) for (const d of it.model.draws(it.matrix)) (d.prim.material.alphaMode === 'BLEND' ? blended : opaque).push({ ...d, model: it.model });
    const drawList = (list: typeof opaque) => {
      for (const { prim, world, model } of list) {
        const m = prim.material;
        gl.uniformMatrix4fv(U('u_model'), false, world);
        gl.uniformMatrix3fv(U('u_nrmMat'), false, normalMatrix(world));
        gl.uniform4fv(U('u_base'), m.baseColor);
        gl.uniform2f(U('u_mr'), m.metallic, m.roughness);
        gl.uniform3fv(U('u_emis'), m.emissive);
        gl.uniform1f(U('u_normalScale'), m.normalScale);
        gl.uniform1f(U('u_sss'), m.sss);
        gl.uniform1f(U('u_flicker'), m.flicker);
        gl.uniform1f(U('u_alphaCut'), m.alphaMode === 'MASK' ? m.alphaCutoff : -1);
        gl.uniform1f(U('u_hasTan'), prim.hasTan ? 1 : 0);
        const texs = [m.baseColorTex, m.metallicRoughnessTex, m.normalTex, m.occlusionTex, m.emissiveTex].map((i) => model.texture(i));
        texs.forEach((tx, i) => {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, tx ?? this.white);
        });
        gl.uniform4f(U('u_has'), texs[0] ? 1 : 0, texs[1] ? 1 : 0, texs[2] ? 1 : 0, texs[3] ? 1 : 0);
        gl.uniform1f(U('u_hasEmis'), texs[4] ? 1 : 0);
        if (m.doubleSided) gl.disable(gl.CULL_FACE);
        else gl.enable(gl.CULL_FACE);
        gl.bindVertexArray(prim.vao);
        gl.drawElements(gl.TRIANGLES, prim.count, prim.type, 0);
        this.stats.draws++;
        this.stats.tris += prim.count / 3;
      }
    };
    drawList(opaque);
    if (blended.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawList(blended);
      gl.depthMask(true);
    }

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
  }
}
