/** GLSL ES 3.00 sources: flesh. */
import { NOISE_PERIOD } from '../noiseBake';

/** Shader-side options behind the quality tiers (ENG-0081/0082); see ../quality.ts. */
export interface FleshShaderOpts {
  /** `baked`: sample the tiling fbm/voronoi textures; `live`: evaluate the noise per pixel. */
  noise: 'baked' | 'live';
  /** fbm octaves for the live variant (2–4). */
  octaves: number;
  /** Subsurface scattering term. */
  sss: boolean;
  /** Toksvig-style specular anti-aliasing (uses fwidth). */
  specAA: boolean;
}

/** The original, full-cost flesh shader: live 4-octave fbm, SSS and spec AA. */
export const FLESH_LIVE_FULL: FleshShaderOpts = { noise: 'live', octaves: 4, sss: true, specAA: true };

const NOISE_COMMON = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  // Quintic fade: continuous second derivative, so no creases at cell borders.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Smooth voronoi edge distance: d2 - d1 with a soft minimum so membranes never form hard creases.
uniform float u_cellSoft;`;

/**
 * Baked noise (ENG-0081): the fbm and its gradient, and the three nearest voronoi feature
 * distances, come from tiling textures baked at load (src/render/noiseBake.ts).
 */
const NOISE_BAKED = /* glsl */ `
uniform sampler2D u_noise;  // x fbm, yz d(fbm)/dp
uniform sampler2D u_cells;  // xyz nearest voronoi distances d1 <= d2 <= d3
const float NOISE_PERIOD = ${NOISE_PERIOD.toFixed(1)};
float fbm(vec2 p) { return texture(u_noise, p / NOISE_PERIOD).x; }
vec2 fbmGrad(vec2 p) { return texture(u_noise, p / NOISE_PERIOD).yz; }
float cells(vec2 p) {
  vec3 d = texture(u_cells, p / NOISE_PERIOD).xyz;
  float k = max(u_cellSoft, 0.02);
  float smoothD1 = -k * log(exp(-d.x / k) + exp(-d.y / k) + exp(-d.z / k));
  return max(d.y - max(d.x, smoothD1), 0.0) * smoothstep(0.0, 0.08, d.y - d.x);
}`;

const NOISE_LIVE = /* glsl */ `
// Each octave is rotated so the value-noise lattices never line up into visible squares.
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < FBM_OCTAVES; i++) { v += a * noise(p); p = OCT * p + 17.1; a *= 0.5; }
  return v + a * 0.5;
}
// Distance to nearest cell edge: membranes, alveoli, fat lobules.
float cells(vec2 p) {
  // Domain-warp the input so the lattice regularity never shows.
  p += vec2(noise(p * 0.35 + 11.0), noise(p * 0.35 + 23.0)) * 1.2 - 0.6;
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  float k = max(u_cellSoft, 0.02);
  float sm = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
    float d = length(g + o - f);
    sm += exp(-d / k);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float smoothD1 = -k * log(sm);
  return max(d2 - max(d1, smoothD1), 0.0) * smoothstep(0.0, 0.08, d2 - d1);
}`;

/**
 * The operating field: a procedurally textured body region framed by a linen
 * drape. Kinds: 0 flesh, 1 heart, 2 lung, 3 gut, 4 liver, 5 brain, 6 bone.
 */
export function fleshShaderSource(opts: FleshShaderOpts = FLESH_LIVE_FULL): string {
  const noise = opts.noise === 'baked' ? NOISE_BAKED : NOISE_LIVE;
  return /* glsl */ `#version 300 es
precision highp float;
#define FBM_OCTAVES ${Math.max(1, Math.min(4, Math.round(opts.octaves)))}
#define NOISE_BAKED ${opts.noise === 'baked' ? 1 : 0}
#define SSS ${opts.sss ? 1 : 0}
#define SPEC_AA ${opts.specAA ? 1 : 0}
in vec2 v_uv;
uniform vec2 u_view;
uniform vec2 u_center;
uniform vec2 u_radii;
uniform float u_time;
uniform int u_kind;
uniform vec3 u_base;
uniform vec3 u_deep;
uniform vec3 u_vein;
uniform float u_pulse;
// Tissue warp (ART-0298): per-axis scale of the field about its centre from the organ's warp map
// (src/art/tissueWarp.ts). The operation draws wounds, fluids and ailments through the same scale,
// so nothing slides over the moving tissue. (0,0) = unset: the legacy rim-only swell.
uniform vec2 u_warp;
uniform vec2 u_light;
uniform float u_corrupt;
uniform sampler2D u_surface;
uniform vec2 u_surfTexel;
// Light rig: [0] surgeon's lamp, [1..2] candles. xy = position (virtual px), z = height, w = intensity.
uniform vec4 u_lights[3];
uniform vec3 u_lightCol[3];
uniform float u_rough;
/** Gore level: 0 full, 1 reduced (browned wounds), 2 minimal (ink-black, matte wounds). */
uniform float u_gore;
// The patient's people (src/surgery/species.ts): skin, depth of the hide, scattering, blood.
uniform vec3 u_skin;
uniform vec2 u_layers;   // x dermis thickness, y fat thickness (relative to human = 1)
uniform vec4 u_sssCol;   // rgb scatter tint, a strength
uniform vec2 u_hide;     // x coarseness (pores, stubble), y old scarring
uniform float u_veinAmt;
uniform vec3 u_blood;
uniform vec3 u_bloodDeep;
uniform float u_sheen;
// Curse corruption (ART-0181–0183): where it flows to, and the Hour's vein and necrosis colours.
uniform vec2 u_corruptAt;
uniform vec3 u_curseVein;
uniform vec3 u_curseAccent;
out vec4 o;
// smoothstep with edge0 > edge1 is undefined in GLSL; this is the portable falling edge.
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }

${NOISE_COMMON}
${noise}
// Height contributed by wounds (negative) and swelling (positive).
float surfH(vec2 uv) {
  vec4 s = texture(u_surface, uv);
  return s.a * 1.3 - s.r * 1.4;
}
void main() {
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_view;
  bool warped = u_warp.x > 0.0;
  vec2 q = (px - u_center) / (u_radii * (warped ? u_warp : vec2(1.0)));
  // Organs swell faintly with the heartbeat.
  // Heartbeat: the heart contracts ~5% in systole; other tissue barely stirs.
  float beat = u_pulse * u_pulse * (3.0 - 2.0 * u_pulse);
  float swell = warped ? 1.0 : 1.0 + beat * (u_kind == 1 ? 0.05 : 0.012);
  float r = length(q) / swell;
  float edge = r + (fbm(q * 3.0 + 4.0) - 0.5) * 0.08;

  // ---- drape (outside the opening): creased linen over an oak table, lit by the candle.
  // Folds radiate from the opening: a height field of stretched creases plus slack wrinkles.
  vec2 fq = (px - u_center) / u_radii;
  float ang = atan(fq.y, fq.x);
  float rad = length(fq);
  float folds = sin(ang * 9.0 + fbm(fq * 2.0) * 3.0) * 0.5 + 0.5;
  folds *= smoothstep(1.0, 1.35, rad) * (1.0 - smoothstep(1.6, 2.4, rad));
  float slack = fbm(px * 0.008 + vec2(3.0, 1.0));
  float fh = folds * 0.6 + slack * 0.8;
  vec2 fd = vec2(dFdx(fh), dFdy(fh)) * 40.0;
  vec3 fn = normalize(vec3(-fd, 1.0));
  vec3 fl = normalize(vec3((u_light - px) / 600.0, 0.7));
  float fdiff = max(dot(fn, fl), 0.0);
  // Linen weave.
  vec2 w = px * 0.9;
  float weave = 0.5 + 0.18 * sin(w.x * 2.2) * sin(w.y * 2.2) + 0.2 * noise(px * 0.35);
  vec3 linen = mix(vec3(0.42, 0.40, 0.34), vec3(0.62, 0.59, 0.5), weave);
  vec3 drape = linen * (0.18 + 0.85 * fdiff);
  drape *= 0.45 + 0.65 * rsmooth(950.0, 150.0, length(px - u_light));
  // Blood soaks into the linen nearest the wound, and old stains elsewhere.
  float soak = rsmooth(1.3, 1.0, rad) * (0.6 + 0.4 * fbm(px * 0.02));
  drape = mix(drape, vec3(0.22, 0.02, 0.03) * (0.5 + 0.6 * fdiff), soak * 0.85);
  drape = mix(drape, vec3(0.3, 0.1, 0.07) * (0.5 + 0.5 * fdiff), smoothstep(0.64, 0.74, fbm(px * 0.006 + 3.0)) * 0.55);
  // Oak table at the frame edges.
  float tableMask = smoothstep(2.05, 2.25, rad + 0.1 * fbm(fq * 3.0));
  vec3 oak = vec3(0.14, 0.08, 0.045) * (0.6 + 0.5 * noise(vec2(px.x * 0.02, px.y * 0.6))) * (0.4 + 0.6 * rsmooth(1100.0, 200.0, length(px - u_light)));
  drape = mix(drape, oak, tableMask);

  // ---- flesh
  vec2 uv = q * 4.0;
  float n = fbm(uv + vec2(0.0, u_time * 0.02));
  vec3 col = mix(u_deep, u_base, smoothstep(0.2, 0.85, n));
  float c = 0.0;
  if (u_kind == 2) {
    // Lung: alveolar lobules that inflate with each breath; anthracotic speckle.
    float breath = 0.5 + 0.5 * sin(u_time * 1.6);
    vec2 luv = uv * (2.6 - breath * 0.12);
    c = cells(luv);
    col *= 0.72 + 0.35 * smoothstep(0.0, 0.3, c) + breath * 0.05;
    col = mix(col, vec3(0.9, 0.7, 0.75), smoothstep(0.2, 0.45, c) * 0.25);
    col = mix(col, vec3(0.15, 0.12, 0.14), step(0.985, noise(uv * 30.0)) * 0.6);
  } else if (u_kind == 3) {
    // Gut: loops with a travelling peristaltic wave, mesenteric fat and serosa sheen.
    vec2 w = q + vec2(fbm(uv * 0.7), fbm(uv * 0.7 + 5.0)) * 0.45;
    float loops = sin(w.x * 14.0 + sin(w.y * 3.0) * 2.0);
    float wave = 0.5 + 0.5 * sin(w.x * 6.0 - u_time * 1.8);
    c = loops;
    col *= 0.72 + 0.22 * loops + 0.08 * wave;
    col = mix(col, vec3(0.92, 0.82, 0.5), smoothstep(0.75, 0.95, fbm(uv * 1.1 + 3.0)) * 0.55);
  } else if (u_kind == 4) {
    // Liver: glossy capsule over hexagonal lobules.
    c = cells(uv * 1.6);
    col *= 0.82 + 0.22 * smoothstep(0.0, 0.12, c);
    col = mix(col, col * vec3(0.9, 1.0, 0.7), smoothstep(0.6, 0.9, fbm(uv * 0.5)) * 0.3);
  } else if (u_kind == 5) {
    // Brain: gyri and sulci from warped ridged noise under a translucent meningeal veil.
    vec2 w = uv * 0.9 + vec2(fbm(uv * 0.6), fbm(uv * 0.6 + 7.0)) * 2.2;
    float ridge = 1.0 - abs(sin(fbm(w) * 16.0));
    c = ridge;
    col *= 0.6 + 0.45 * smoothstep(0.1, 0.8, ridge);
    col = mix(col, vec3(0.85, 0.8, 0.82), 0.12 + 0.05 * sin(u_time * 1.1));
  } else if (u_kind == 6) {
    // Bone: cortical grain with cancellous pits and a thin periosteum film.
    c = fbm(vec2(uv.x * 1.2, uv.y * 6.0));
    col = mix(col, vec3(0.86, 0.82, 0.7), 0.6) * (0.78 + 0.3 * c);
    col *= 1.0 - (1.0 - smoothstep(0.0, 0.12, cells(uv * 9.0))) * 0.25;
    col = mix(col, vec3(0.8, 0.45, 0.4), 0.12);
  } else if (u_kind == 1) {
    // Heart: coronary vessels along warped ridges, epicardial fat streaks, darker in diastole.
    vec2 w = uv * 0.8 + vec2(fbm(uv * 0.5), fbm(uv * 0.5 + 3.0)) * 1.8;
    float vessel = pow(1.0 - abs(fbm(w * 1.2) * 2.0 - 1.0), 18.0);
    c = fbm(uv * 1.5 + u_pulse * 0.3);
    col *= 0.8 + 0.25 * c;
    col = mix(col, vec3(0.95, 0.85, 0.55), smoothstep(0.62, 0.8, fbm(uv * 0.9 + 11.0)) * 0.45);
    col = mix(col, vec3(0.35, 0.02, 0.1), vessel * 0.7);
    col *= 0.9 + 0.1 * u_pulse;
  }
  else { c = cells(uv * 2.2); col *= 0.92 + 0.08 * smoothstep(0.0, 0.18, c); }

  // Veins: ridged noise.
  float v = 1.0 - abs(fbm(uv * 0.7 + 10.0) * 2.0 - 1.0);
  v = pow(v, 14.0);
  col = mix(col, u_vein, v * u_veinAmt);

  // Wet specular from a smooth, low-frequency height field (finite differences, not dFdx,
  // so the highlight rolls over broad swells instead of sparkling on every noise texel).
  vec2 hp = q * 2.2 + vec2(0.0, u_time * 0.02);
#if NOISE_BAKED
  vec2 grad = fbmGrad(hp);
#else
  float e = 0.02;
  float h0 = fbm(hp);
  vec2 grad = vec2(fbm(hp + vec2(e, 0.0)) - h0, fbm(hp + vec2(0.0, e)) - h0) / e;
#endif
  // Dome the field so light wraps around the organ's bulk.
  grad += q * 0.9;
  // Wounds and swellings from the surface layer shape the normal: cuts read as carved channels.
  vec4 sf = texture(u_surface, v_uv);
  vec2 st = u_surfTexel * 1.5;
  vec2 sg = vec2(surfH(v_uv + vec2(st.x, 0.0)) - surfH(v_uv - vec2(st.x, 0.0)), surfH(v_uv - vec2(0.0, st.y)) - surfH(v_uv + vec2(0.0, st.y)));
  grad += sg * 14.0;
  vec3 nrm = normalize(vec3(-grad * 0.35, 1.0));
  vec3 L = normalize(vec3((u_light - px) / 700.0, 0.9));
  // Wetness: glistening near wounds and blood, matte where the skin has dried.
  float wet = clamp(0.35 + 0.35 * fbm(q * 1.3 + 7.0) + sf.r * 0.8 + sf.g * 0.6 + sf.a * 0.3, 0.0, 1.0);
  // Specular anti-aliasing (Toksvig-style): widen the lobe where the normal varies within a pixel.
  // fwidth is evaluated per 2x2 quad; keep its influence gentle so it never reads as blocks.
#if SPEC_AA
  float nVar = smoothstep(0.0, 1.0, clamp(length(fwidth(nrm)) * 2.0, 0.0, 0.5));
#else
  float nVar = 0.0;
#endif
  float rough = clamp(mix(u_rough + u_sheen + 0.25, u_rough + u_sheen - 0.15, wet) + nVar * 0.3, 0.12, 0.9);
  float specPow = 2.0 / (rough * rough) - 2.0;
  float norm = (specPow + 8.0) / 25.13; // energy-normalised Blinn-Phong
  float diff = 0.0;
  float spec = 0.0;
  vec3 lit = vec3(0.0);
  vec3 specCol = vec3(0.0);
  for (int li = 0; li < 3; li++) {
    vec4 lt = u_lights[li];
    if (lt.w <= 0.0) continue;
    vec3 lv = vec3((lt.xy - px) / 700.0, lt.z);
    float att = lt.w / (1.0 + dot(lv.xy, lv.xy) * 1.6);
    vec3 ld = normalize(lv);
    float d = max(dot(nrm, ld), 0.0);
    vec3 hv = normalize(ld + vec3(0.0, 0.0, 1.0));
    float sp = min(pow(max(dot(nrm, hv), 0.0), specPow) * norm, 4.0);
    lit += u_lightCol[li] * d * att;
    specCol += u_lightCol[li] * sp * att;
    diff += d * att;
    spec += sp * att;
  }
  diff = clamp(diff, 0.0, 1.5);
  float cut = smoothstep(0.05, 0.7, sf.r);
  // Subsurface scattering: light bleeds red through flesh on the shadowed side.
#if SSS
  vec3 sss = u_base * u_sssCol.rgb * pow(1.0 - diff, 2.0) * 0.32 * u_sssCol.a;
#else
  vec3 sss = vec3(0.0);
#endif
  float fres = pow(1.0 - clamp(nrm.z, 0.0, 1.0), 3.0);
  col = col * (vec3(0.28, 0.27, 0.3) + 0.52 * lit) + sss + specCol * (0.08 + 0.22 * wet) + vec3(1.0, 0.75, 0.7) * fres * 0.12;

  // Wound interior: deep, wet, glistening maroon with a dark rim.
  vec3 woundCol = mix(u_blood, u_bloodDeep, smoothstep(0.3, 1.0, sf.r));
  float wspec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), 50.0);
  woundCol = mix(woundCol, vec3(0.3, 0.17, 0.08) * mix(1.0, 0.45, smoothstep(0.3, 1.0, sf.r)), step(0.5, u_gore));
  woundCol = mix(woundCol, vec3(0.04, 0.035, 0.035), step(1.5, u_gore));
  woundCol += vec3(1.0, 0.8, 0.8) * wspec * 0.8 * (1.0 - step(1.5, u_gore));
  float rim = smoothstep(0.02, 0.15, sf.r) * (1.0 - smoothstep(0.15, 0.45, sf.r));
  col = mix(col, woundCol, cut);
  col *= 1.0 - rim * 0.35;
  // The cut's lips show the tissue in section, so the depth of the hide reads: a line of skin,
  // the pale dermis (a hair on an elf, a thick leathery band on an orc), yellow fat, then the wound.
  if (u_gore < 1.5 && sf.r > 0.02) {
    float e1 = 0.05;
    float e2 = e1 + 0.055 * u_layers.x;
    float e3 = e2 + 0.05 * u_layers.y;
    float lit = 0.45 + 0.6 * diff;
    vec3 dermisCol = mix(vec3(0.86, 0.72, 0.64), u_skin, 0.25) * lit;
    vec3 fatCol = vec3(0.86, 0.72, 0.38) * lit;
    float sSkin = smoothstep(0.02, 0.03, sf.r) * (1.0 - smoothstep(e1 - 0.008, e1, sf.r));
    float sDerm = smoothstep(e1 - 0.008, e1, sf.r) * (1.0 - smoothstep(e2 - 0.01, e2, sf.r));
    float sFat = smoothstep(e2 - 0.01, e2, sf.r) * (1.0 - smoothstep(e3 - 0.012, e3, sf.r));
    float goreK = u_gore > 0.5 ? 0.5 : 1.0;
    col = mix(col, u_skin * lit, sSkin * 0.9 * goreK);
    col = mix(col, dermisCol, sDerm * 0.85 * goreK);
    col = mix(col, fatCol + vec3(0.1) * wspec, sFat * 0.75 * goreK);
  }
  // Blood staining and bruising.
  col = mix(col, vec3(0.26, 0.015, 0.04) * (0.7 + 0.5 * diff), clamp(sf.g * 1.3, 0.0, 1.0) * 0.85);
  // Scorch: blackened, cracked eschar with ember-red fissures.
  float crack = rsmooth(0.02, 0.0, cells(uv * 5.0));
  vec3 charCol = mix(vec3(0.06, 0.04, 0.035), vec3(0.5, 0.12, 0.03), crack * 0.6) * (0.6 + 0.6 * diff);
  col = mix(col, charCol, clamp(sf.b, 0.0, 1.0));
  // Swelling: inflamed, taut and shiny.
  col = mix(col, col * vec3(1.25, 0.88, 0.78) + spec * 0.25, clamp(sf.a * 1.2, 0.0, 1.0) * 0.75);
  // Fine wet glints, sparse and soft.
  // Wet glints: tiny round sparkles at jittered points, only on wet tissue, fading with footprint.
  vec2 gp = uv * 7.0;
  vec2 gi = floor(gp), gf = fract(gp);
  vec2 gc = vec2(hash(gi + 3.1), hash(gi + 8.7)) * 0.6 + 0.2;
  float gd = length(gf - gc);
  float glint = (1.0 - smoothstep(0.0, 0.06, gd)) * step(0.55, hash(gi + 1.3));
  float glintFoot = 1.0 - smoothstep(0.02, 0.12, fwidth(uv.x * 7.0));
  col += vec3(1.0, 0.96, 0.92) * glint * spec * wet * 0.5 * glintFoot;

  // Curse corruption (ART-0181): bruising creeps in from the rim; violet veins, bruise-black
  // necrosis and woodcut-hatched sigil scars spread from the Malison, driven by u_corrupt 0..1.
  float cor = u_corrupt * smoothstep(0.3, 1.0, r + fbm(uv * 1.7 + u_time * 0.1) * 0.4);
  col = mix(col, mix(vec3(0.16, 0.05, 0.2), u_curseAccent, 0.5), cor * 0.4);
  if (u_corrupt > 0.001) {
    vec2 toM = u_corruptAt - px;
    float dM = length(toM);
    vec2 dirM = toM / max(dM, 1.0);
    // Reach: the corruption spreads out from the Malison as it grows.
    float reach = u_corrupt * u_corrupt * 700.0;
    float cm = rsmooth(reach, reach * 0.35, dM + (fbm(q * 2.3 + 5.0) - 0.5) * 160.0);
    // Flow map (ART-0182): two-phase advection so the veins crawl toward the Malison without stretching.
    float ft = u_time * 0.4;
    float ph0 = fract(ft);
    float ph1 = fract(ft + 0.5);
    vec2 cuv = px * 0.012;
    vec2 flow = dirM * 1.6;
    float va = 1.0 - abs(fbm(cuv - flow * ph0) * 2.0 - 1.0);
    float vb = 1.0 - abs(fbm(cuv - flow * ph1 + 3.7) * 2.0 - 1.0);
    float wa = 1.0 - abs(ph0 * 2.0 - 1.0);
    float ridge = mix(vb, va, wa);
    float cveins = smoothstep(0.86, 0.97, ridge);
    // Fine capillary branching off the main veins.
    float fine = smoothstep(0.9, 0.98, 1.0 - abs(fbm(cuv * 2.7 - flow * ph0 * 2.0 + 9.0) * 2.0 - 1.0)) * 0.6;
    float vk = max(cveins, fine) * cm;
    // Bruise-black necrosis in blotches nearest the Malison.
    float nec = smoothstep(0.58, 0.72, fbm(px * 0.006 + 13.0) + (1.0 - dM / max(reach, 1.0)) * 0.25) * cm * u_corrupt;
    col = mix(col, u_curseAccent * 0.35 + vec3(0.02, 0.01, 0.02), nec * 0.6);
    // Woodcut-hatched sigil scarring: raised scar patches cut by parallel hatch strokes.
    // Scar patches are narrow welts (ridges of low-frequency noise); the hatching follows the lamp
    // side of each welt and breaks up like a cut woodblock line.
    float welt = 1.0 - abs(fbm(px * 0.0045 + 21.0) * 2.0 - 1.0);
    float scarM = smoothstep(0.9, 0.96, welt) * cm * smoothstep(0.35, 0.8, u_corrupt);
    float hatch = rsmooth(0.18, 0.04, abs(fract((px.x - px.y * 0.6) * 0.2) - 0.5)) * step(0.35, noise(px * 0.05));
    col = mix(col, mix(u_skin * 0.9, u_curseAccent, 0.3), scarM * 0.5);
    col = mix(col, u_curseAccent * 0.2, scarM * hatch * 0.7);
    // The veins glow faintly with the curse's pulse.
    float cpulse = 0.75 + 0.25 * sin(u_time * 2.2 - dM * 0.02);
    col = mix(col, u_curseVein * 0.55 * cpulse, vk * 0.7);
    col += u_curseVein * vk * 0.18 * cpulse;
  }

  // Cavity depth: occlusion under the retractor rim and a Fresnel sheen where tissue curves away.
  float cavity = smoothstep(0.7, 1.0, edge);
  col *= mix(1.0, 0.55, cavity * cavity);
  col += vec3(1.0, 0.8, 0.75) * smoothstep(0.82, 0.97, edge) * (1.0 - smoothstep(0.97, 1.0, edge)) * spec * 0.25;
  col *= rsmooth(1.02, 0.78, edge) * 0.6 + 0.4;
  float inside = rsmooth(1.0, 0.985, edge);
  // The skin collar around the opening: the patient's own hide, retracted, with its cut edge
  // showing the dermis in section. Its width follows the thickness of the hide.
  float collar = 0.055 + 0.03 * u_layers.x;
  float inCollar = rsmooth(1.0 + collar, 1.0 + collar - 0.012, edge) * smoothstep(0.985, 1.0, edge);
  vec2 sp = px * 0.25;
  float pores = noise(sp * 3.0);
  float stubble = step(0.93 - 0.1 * u_hide.x, hash(floor(px * 0.9))) * u_hide.x;
  float scar = smoothstep(0.72, 0.78, fbm(vec2(px.x * 0.004 + px.y * 0.01, px.y * 0.003) * 4.0)) * u_hide.y;
  vec3 skinCol = u_skin * (0.86 + 0.18 * pores * u_hide.x);
  skinCol = mix(skinCol, skinCol * 0.55, stubble * 0.5);
  skinCol = mix(skinCol, mix(u_skin, vec3(0.9, 0.78, 0.72), 0.5) * 1.05, scar * 0.6);
  // Light the collar like the drape (it curls away from the opening), with a thin sheen.
  float skinLit = 0.3 + 0.8 * fdiff + 0.25 * pow(max(fdiff, 0.0), 12.0) * (1.0 - u_sheen * 3.0);
  // The skin's scatter glow: strong in the fine-skinned, faint in thick hides.
  skinCol = skinCol * skinLit + u_skin * u_sssCol.rgb * 0.06 * u_sssCol.a;
  // The collar's inner lip: dermis in section, as wide as the hide is thick.
  float lip = rsmooth(1.0 + 0.004 + 0.012 * u_layers.x, 1.0, edge) * smoothstep(0.985, 0.995, edge);
  skinCol = mix(skinCol, mix(vec3(0.86, 0.72, 0.64), u_skin, 0.3) * (0.4 + 0.5 * fdiff), lip);
  vec3 outc = mix(drape, col * 0.3, rsmooth(1.06, 1.0, edge) * 0.6);
  outc = mix(outc, skinCol, inCollar);
  o = vec4(mix(outc, col, inside), 1.0);
}`;
}

/** The reference variant (live noise, every feature on): the shader lab and the mediump fallback build from it. */
export const FLESH_FS = fleshShaderSource(FLESH_LIVE_FULL);
