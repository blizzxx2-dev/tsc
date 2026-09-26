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
// Venue (ENG-0272/0274): 0 hospice, 1 field triage, 2 forensic slab.
uniform int u_venue;
// Muscle fibre direction (ENG-0093), unit vector in view space (y down).
uniform vec2 u_fiber;
// Fever flush and sweat (ART-0212), 0..1.
uniform float u_fever;
// Real-surface detail maps (CC0 scans, assets/textures/README.md); u_maps 0 until they load.
uniform sampler2D u_skinMap;  // R,G normal xy, B roughness
uniform sampler2D u_linenMap; // R,G normal xy, B weave
uniform sampler2D u_woodMap;  // colour
uniform sampler2D u_toneMap;  // skin-tone mottling, 0.5 = mean
uniform float u_maps;
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
// Per-pixel corruption painted by the curse's sources (ENG-0099); view px → map UV.
uniform sampler2D u_curseMap;
uniform float u_curseOn;
uniform mat3 u_curseXf;
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
// Drape height: creases gather where the linen is pulled tight round the opening (sharp-crested
// ridges that wander) and fade out into broad slack swells further off. Single-octave noise only:
// it is sampled three times per pixel for the normal.
float drapeH(vec2 p, out float ridge, out float nearHole) {
  vec2 fq = (p - u_center) / u_radii;
  float ang = atan(fq.y, fq.x);
  float rad = length(fq);
  float warpA = ang + (noise(fq * 1.5) - 0.5) * 0.7;
  ridge = 1.0 - abs(sin(warpA * 7.0 + noise(fq * 2.0) * 2.5));
  ridge *= ridge;
  nearHole = smoothstep(1.0, 1.12, rad) * (1.0 - smoothstep(1.3, 2.1, rad));
  float slack = noise(p * 0.006 + vec2(3.0, 1.0)) * 0.7 + noise(p * 0.013 + 7.0) * 0.3;
  return ridge * nearHole * 0.8 + slack * 0.5;
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
  // The fold normal comes from the height sampled a few pixels apart, not from screen derivatives,
  // which step visibly in 2×2 blocks wherever the creases are strong.
  float ridge, nearHole;
  float fh0 = drapeH(px, ridge, nearHole);
  float rdx, ndx;
  vec2 fd = vec2(drapeH(px + vec2(2.0, 0.0), rdx, ndx) - fh0, drapeH(px + vec2(0.0, 2.0), rdx, ndx) - fh0) * 19.0;
  // The linen's real weave, from the scanned map.
  vec3 linenM = u_maps > 0.5 ? texture(u_linenMap, px / 240.0).rgb : vec3(0.5);
  if (u_maps > 0.5) fd += (linenM.rg * 2.0 - 1.0) * 0.9;
  vec3 fn = normalize(vec3(-fd, 1.0));
  vec3 fl = normalize(vec3((u_light - px) / 600.0, 0.7));
  float fdiff = max(dot(fn, fl), 0.0);
  // Linen weave.
  vec2 w = px * 0.9;
  float weave = 0.5 + 0.18 * sin(w.x * 2.2) * sin(w.y * 2.2) + 0.2 * noise(px * 0.35);
  if (u_maps > 0.5) weave = mix(weave, linenM.b, 0.8);
  vec3 linen = mix(vec3(0.42, 0.40, 0.34), vec3(0.62, 0.59, 0.5), weave);
  vec3 drape = linen * (0.2 + 0.85 * fdiff);
  // Occlusion in the troughs between creases.
  drape *= 1.0 - 0.3 * nearHole * (1.0 - ridge);
  drape *= 0.55 + 0.6 * rsmooth(1000.0, 150.0, length(px - u_light));
  // Blood soaks into the linen nearest the wound, and old stains elsewhere.
  float soak = rsmooth(1.3, 1.0, rad) * (0.6 + 0.4 * fbm(px * 0.02));
  drape = mix(drape, vec3(0.22, 0.02, 0.03) * (0.5 + 0.6 * fdiff), soak * 0.85);
  drape = mix(drape, vec3(0.36, 0.2, 0.13) * (0.5 + 0.5 * fdiff), smoothstep(0.62, 0.78, fbm(px * 0.006 + 3.0)) * 0.3);
  // Oak table at the frame edges.
  float tableMask = smoothstep(2.05, 2.25, rad + 0.1 * fbm(fq * 3.0));
  vec3 oak = vec3(0.14, 0.08, 0.045) * (0.6 + 0.5 * noise(vec2(px.x * 0.02, px.y * 0.6))) * (0.4 + 0.6 * rsmooth(1100.0, 200.0, length(px - u_light)));
  if (u_maps > 0.5) oak = texture(u_woodMap, px / 320.0).rgb * 0.5 * (0.4 + 0.6 * rsmooth(1100.0, 200.0, length(px - u_light)));
  drape = mix(drape, oak, tableMask);
  if (u_venue == 1) {
    // Field triage (ENG-0272): coarse olive tent canvas, mud-spattered, over trampled earth and straw.
    float cw = 0.5 + 0.25 * sin(px.x * 1.4) * sin(px.y * 1.4) + 0.25 * noise(px * 0.2);
    vec3 canvas = mix(vec3(0.24, 0.24, 0.15), vec3(0.36, 0.35, 0.22), cw) * (0.2 + 0.85 * fdiff);
    float mud = smoothstep(0.55, 0.7, fbm(px * 0.012 + 11.0)) + step(0.965, noise(px * 0.08)) * 0.8;
    canvas = mix(canvas, vec3(0.12, 0.08, 0.04) * (0.5 + 0.6 * fdiff), clamp(mud, 0.0, 1.0) * 0.8);
    canvas = mix(canvas, vec3(0.2, 0.02, 0.03) * (0.5 + 0.6 * fdiff), soak * 0.7);
    float straw = smoothstep(0.82, 0.9, noise(vec2(px.x * 0.15 + px.y * 0.05, px.y * 0.02)));
    vec3 earth = mix(vec3(0.07, 0.05, 0.03), vec3(0.3, 0.24, 0.1), straw) * (0.5 + 0.5 * noise(px * 0.04));
    drape = mix(canvas, earth, tableMask);
  } else if (u_venue == 2) {
    // Forensic slab (ENG-0274): a grey sheet on cold, veined stone.
    vec3 sheet = mix(vec3(0.46, 0.47, 0.48), vec3(0.6, 0.61, 0.62), weave) * (0.25 + 0.8 * fdiff);
    sheet = mix(sheet, vec3(0.25, 0.1, 0.1) * (0.5 + 0.6 * fdiff), soak * 0.35);
    float vein = smoothstep(0.9, 0.97, 1.0 - abs(fbm(px * 0.004 + 17.0) * 2.0 - 1.0));
    vec3 stone = mix(vec3(0.3, 0.31, 0.32), vec3(0.18, 0.18, 0.2), vein) * (0.7 + 0.3 * noise(px * 0.05));
    drape = mix(sheet, stone, tableMask);
  }

  // ---- flesh
  vec2 uv = q * 4.0;
  float n = fbm(uv + vec2(0.0, u_time * 0.02));
  // A calm, painted base: the deep tone only in soft broad pools, never busy blotches.
  vec3 col = mix(u_deep, u_base, 0.25 + 0.75 * smoothstep(0.15, 0.9, n));
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
    // Gut: coiled loops of bowel as the contour bands of a smooth field. Bands keep a near-even width
    // and meander or close on themselves like coils; each is shaded as a tube across its width (lit
    // on the lamp-facing flank), with dark crevices between loops holding yellow mesenteric fat,
    // fine vessels crossing the loops, and a peristaltic swell travelling along them.
    float ge = 0.012;
    vec2 gq = q * 1.3 + 3.0;
    float h0 = fbm(gq) + 0.3 * noise(q * 3.0);
    float hx = fbm(gq + vec2(ge * 1.3, 0.0)) + 0.3 * noise((q + vec2(ge, 0.0)) * 3.0);
    float hy = fbm(gq + vec2(0.0, ge * 1.3)) + 0.3 * noise((q + vec2(0.0, ge)) * 3.0);
    vec2 hg = vec2(hx - h0, hy - h0) / ge;
    vec2 across = hg / max(length(hg), 1e-3);
    float band = h0 * 8.0;
    float bv = fract(band);
    float prof = sin(3.14159 * bv);
    vec2 toL = normalize(u_light - px + vec2(1e-3));
    float flank = cos(3.14159 * bv) * dot(across, toL);
    c = prof;
    float wave = 0.5 + 0.5 * sin(band * 0.7 + dot(q, vec2(-across.y, across.x)) * 12.0 - u_time * 1.8);
    col *= (0.5 + 0.5 * prof + 0.05 * wave) * (1.0 + 0.3 * flank);
    float crevice = rsmooth(0.12, 0.0, min(bv, 1.0 - bv));
    col = mix(col, vec3(0.9, 0.78, 0.46) * 0.75, crevice * smoothstep(0.35, 0.65, fbm(uv * 1.3 + 3.0)) * 0.55);
    float gv = pow(1.0 - abs(noise(vec2(dot(q, vec2(-across.y, across.x)) * 30.0, band * 0.5)) * 2.0 - 1.0), 14.0);
    col = mix(col, vec3(0.5, 0.1, 0.18), gv * prof * 0.3);
  } else if (u_kind == 4) {
    // Liver: a smooth, glossy capsule over fine lobules — a faint honeycomb mottle only up close —
    // with broad darker and lighter congestion.
    c = cells(uv * 7.0);
    col *= 0.93 + 0.08 * smoothstep(0.0, 0.1, c);
    col *= 0.86 + 0.24 * fbm(uv * 0.45 + 12.0);
    col = mix(col, col * vec3(1.05, 0.92, 0.85), smoothstep(0.55, 0.8, fbm(uv * 0.9 + 4.0)) * 0.35);
  } else if (u_kind == 5) {
    // Brain: rounded gyri as the contour bands of a smooth field — each lit across its width on
    // the lamp side — parted by narrow dark sulci, with the pia's vessels lying in the sulci and a
    // few larger veins crossing over, all under a faint translucent meningeal sheen.
    float be = 0.012;
    vec2 bq = q * 1.5 + 5.0;
    float b0 = fbm(bq) + 0.35 * noise(q * 4.0);
    float bx = fbm(bq + vec2(be * 1.5, 0.0)) + 0.35 * noise((q + vec2(be, 0.0)) * 4.0);
    float by = fbm(bq + vec2(0.0, be * 1.5)) + 0.35 * noise((q + vec2(0.0, be)) * 4.0);
    vec2 bg = vec2(bx - b0, by - b0) / be;
    vec2 acr = bg / max(length(bg), 1e-3);
    float gband = b0 * 8.0;
    float gv = fract(gband);
    float gyrus = sin(3.14159 * gv);
    vec2 toLb = normalize(u_light - px + vec2(1e-3));
    float gflank = cos(3.14159 * gv) * dot(acr, toLb);
    float sulcus = rsmooth(0.13, 0.0, min(gv, 1.0 - gv));
    c = gyrus;
    col *= (0.55 + 0.5 * gyrus) * (1.0 + 0.32 * gflank);
    col = mix(col, vec3(0.42, 0.16, 0.2), sulcus * 0.75);
    // Pial vessels: fine red threads along the sulci; a few larger veins crossing the gyri.
    col = mix(col, vec3(0.6, 0.1, 0.16), rsmooth(0.2, 0.0, min(gv, 1.0 - gv)) * 0.2);
    float bvein = pow(1.0 - abs(fbm(q * 1.1 + 31.0) * 2.0 - 1.0), 22.0);
    col = mix(col, vec3(0.42, 0.1, 0.22), bvein * 0.7);
    col = mix(col, vec3(0.88, 0.84, 0.86), 0.08 + 0.03 * sin(u_time * 1.1));
  } else if (u_kind == 6) {
    // Bone: ivory cortex with fine lamellar grain running lengthwise, a thin periosteum film
    // flushed with blood in patches and threaded with its vessels, and small nutrient pits.
    c = fbm(vec2(uv.x * 1.2, uv.y * 6.0));
    col = mix(col, vec3(0.86, 0.82, 0.7), 0.6) * (0.8 + 0.25 * c);
    float lam = noise(vec2(uv.x * 0.9, uv.y * 38.0 + noise(uv * 1.5) * 6.0));
    col *= 0.96 + 0.06 * smoothstep(0.3, 0.8, lam);
    float peri = smoothstep(0.45, 0.75, fbm(uv * 0.8 + 21.0));
    col = mix(col, vec3(0.78, 0.44, 0.38), 0.08 + 0.2 * peri);
    float pv = pow(1.0 - abs(fbm(vec2(uv.x * 1.4, uv.y * 0.6) + 40.0) * 2.0 - 1.0), 18.0);
    col = mix(col, vec3(0.62, 0.2, 0.2), pv * (0.1 + 0.2 * peri));
    vec2 fp = floor(uv * 5.0);
    float foramen = rsmooth(0.07, 0.02, length(fract(uv * 5.0) - 0.5 - (vec2(hash(fp), hash(fp + 3.3)) - 0.5) * 0.6)) * step(0.86, hash(fp + 7.0));
    col = mix(col, vec3(0.22, 0.1, 0.08), foramen * 0.7);
  } else if (u_kind == 7) {
    // Muscle (ENG-0093): fascicles as rounded bundles laid along u_fiber — each shaded across its
    // width so it reads as a cord — with soft, slightly paler seams of perimysium between them,
    // fine fibre streaks along the grain, and a satin sheen that runs lengthwise.
    vec2 fd = normalize(u_fiber + vec2(1e-4, 0.0));
    vec2 fp = vec2(-fd.y, fd.x);
    vec2 fq2 = vec2(dot(q, fd), dot(q, fp)) * 4.0;
    float wobble = fbm(vec2(fq2.x * 0.25, fq2.y * 1.2)) * 0.9;
    float across = fract((fq2.y + wobble) * 2.6);
    float bundle = sin(3.14159 * across);
    float seam = rsmooth(0.16, 0.0, min(across, 1.0 - across));
    float fibre = noise(vec2(fq2.x * 1.2, (fq2.y + wobble) * 90.0));
    c = bundle;
    col *= 0.7 + 0.32 * bundle;
    col *= 0.92 + 0.12 * fibre;
    col = mix(col, vec3(0.78, 0.5, 0.48), seam * 0.22);
    col *= 0.94 + 0.08 * sin(fq2.x * 1.6 + fbm(fq2 * 0.7) * 3.0);
  } else if (u_kind == 8) {
    // Skin (ENG-0093): pores, fine hair laid one way, and a sweat sheen of tiny beads.
    vec2 pc = floor(uv * 18.0);
    vec2 pf = fract(uv * 18.0) - 0.5 - (vec2(hash(pc), hash(pc + 4.1)) - 0.5) * 0.6;
    float pore = rsmooth(0.1, 0.03, length(pf)) * step(0.3, hash(pc + 2.2));
    c = 1.0 - pore;
    col = mix(col, col * 0.68, pore * 0.55);
    vec2 hp2 = floor(uv * 26.0);
    vec2 hf = fract(uv * 26.0) - 0.5;
    float hairOn = step(0.82, hash(hp2 + 3.0));
    float hair = rsmooth(0.05, 0.0, abs(hf.x * 0.8 + hf.y * 0.6 - (hash(hp2) - 0.5) * 0.2)) * rsmooth(0.45, 0.3, length(hf));
    col = mix(col, col * 0.45, hair * hairOn * 0.6);
    col *= 0.94 + 0.08 * fbm(uv * 3.0);
    // Sweat: scattered beads that catch the lamp.
    vec2 bp = floor(uv * 14.0);
    float bead = rsmooth(0.09, 0.0, length(fract(uv * 14.0) - 0.5 - (vec2(hash(bp), hash(bp + 1.7)) - 0.5) * 0.5)) * step(0.88, hash(bp + 9.1));
    col += vec3(1.0, 0.97, 0.92) * bead * 0.3;
  } else if (u_kind == 1) {
    // Heart: coronary vessels along warped ridges, epicardial fat streaks, darker in diastole.
    vec2 w = uv * 0.8 + vec2(fbm(uv * 0.5), fbm(uv * 0.5 + 3.0)) * 1.8;
    float vessel = pow(1.0 - abs(fbm(w * 1.2) * 2.0 - 1.0), 18.0);
    c = fbm(uv * 1.5 + u_pulse * 0.3);
    col *= 0.8 + 0.25 * c;
    // Epicardial fat lies along the coronary grooves, lobulated, thickest where they gather.
    float groove = pow(1.0 - abs(fbm(w * 1.2) * 2.0 - 1.0), 4.0);
    float fatH = groove * smoothstep(0.35, 0.7, fbm(uv * 0.9 + 11.0)) * (0.8 + 0.35 * noise(uv * 7.0));
    col = mix(col, vec3(0.95, 0.84, 0.55), clamp(fatH, 0.0, 1.0) * 0.55);
    col = mix(col, vec3(0.35, 0.02, 0.1), vessel * 0.7);
    col *= 0.9 + 0.1 * u_pulse;
  }
  else {
    c = cells(uv * 2.2);
    col *= 0.96 + 0.04 * smoothstep(0.0, 0.18, c);
    // Fascia: a faint connective-tissue grain, pale strands laid mostly one way under a wet film.
    vec2 fdir = normalize(u_fiber + vec2(1e-4, 0.0));
    vec2 fq3 = vec2(dot(q, fdir), dot(q, vec2(-fdir.y, fdir.x))) * 4.0;
    float strand = noise(vec2(fq3.x * 1.3, fq3.y * 22.0 + noise(fq3 * 1.7) * 4.0));
    col = mix(col, col * vec3(1.1, 1.04, 1.04) + vec3(0.03, 0.02, 0.02), smoothstep(0.6, 0.85, strand) * 0.3);
  }

  // Veins: a sparse branching network under a translucent surface — crisp trunks with a blurred
  // halo where they run deeper, fine capillaries between, and whole patches where none show.
  vec2 vw = uv * 0.6 + (vec2(noise(uv * 0.4 + 3.0), noise(uv * 0.4 + 8.0)) - 0.5) * 1.1 + 10.0;
  float ridgeV = 1.0 - abs(fbm(vw) * 2.0 - 1.0);
  float trunk = smoothstep(0.935, 0.985, ridgeV);
  float halo = smoothstep(0.82, 0.96, ridgeV) * 0.4;
  float capR = 1.0 - abs(noise(uv * 2.4 + 30.0) * 2.0 - 1.0);
  float cap = smoothstep(0.93, 0.985, capR) * 0.3;
  float patchV = smoothstep(0.3, 0.7, noise(uv * 0.35 + 50.0));
  float v = max(max(trunk, halo), cap) * (0.3 + 0.7 * patchV);
  // Skin hides its veins (ENG-0093): only a faint tracery shows through.
  col = mix(col, u_vein, v * u_veinAmt * (u_kind == 8 ? 0.3 : 0.55));

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
  // The liver's capsule is taut and smooth: only broad swells, no crinkle.
  if (u_kind == 4 || u_kind == 5) grad *= 0.3;
  // Dome the field so light wraps around the organ's bulk.
  grad += q * 0.9;
  // Wounds and swellings from the surface layer shape the normal: cuts read as carved channels.
  vec4 sf = texture(u_surface, v_uv);
  vec2 st = u_surfTexel * 1.5;
  vec2 sg = vec2(surfH(v_uv + vec2(st.x, 0.0)) - surfH(v_uv - vec2(st.x, 0.0)), surfH(v_uv - vec2(0.0, st.y)) - surfH(v_uv + vec2(0.0, st.y)));
  grad += sg * 14.0;
  // Skin pores and micro-wrinkles from the scanned map: full on skin fields, faint on organ tissue.
  vec3 skinMap = vec3(0.5);
  float skinK = 0.0;
  if (u_maps > 0.5) {
    skinMap = texture(u_skinMap, px / 110.0).rgb;
    skinK = (u_kind == 0 || u_kind == 8) ? 1.0 : 0.25;
    grad += (skinMap.rg * 2.0 - 1.0) * 2.5 * skinK;
    // Real skin-tone mottling (freckles, flush, capillary blotches) over the field's own colour.
    vec3 tone = texture(u_toneMap, px / 180.0).rgb * 2.0;
    col *= mix(vec3(1.0), tone, 0.35 * skinK);
  }
  vec3 nrm = normalize(vec3(-grad * 0.35, 1.0));
  vec3 L = normalize(vec3((u_light - px) / 700.0, 0.9));
  // Wetness: glistening near wounds and blood, matte where the skin has dried.
  float wet = clamp(0.5 + 0.25 * fbm(q * 1.3 + 7.0) + sf.r * 1.2 + sf.g * 0.8 + sf.a * 0.4, 0.0, 1.0);
  // Specular anti-aliasing (Toksvig-style): widen the lobe where the normal varies within a pixel.
  // fwidth is evaluated per 2x2 quad; keep its influence gentle so it never reads as blocks.
#if SPEC_AA
  float nVar = smoothstep(0.0, 1.0, clamp(length(fwidth(nrm)) * 2.0, 0.0, 0.5));
#else
  float nVar = 0.0;
#endif
  float rough = clamp(mix(u_rough + u_sheen + 0.25, u_rough + u_sheen - 0.15, wet) + nVar * 0.3, 0.12, 0.9);
  rough = clamp(mix(rough, rough * (0.6 + 0.8 * skinMap.b), skinK * 0.7), 0.12, 0.9);
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
  col = col * (vec3(0.2, 0.19, 0.21) + 0.78 * lit) + sss + specCol * (0.1 + 0.45 * wet) + vec3(1.0, 0.75, 0.7) * fres * 0.1;

  // Wound interior: deep, wet, glistening maroon with a dark rim.
  vec3 woundCol = mix(u_blood, u_bloodDeep * 0.55, smoothstep(0.2, 0.9, sf.r));
  // Depth: the deeper the cut, the less lamp reaches its floor (a cavity, not a painted line).
  woundCol *= mix(1.0, 0.35, smoothstep(0.35, 1.0, sf.r));
  float wspec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), 50.0);
  woundCol = mix(woundCol, vec3(0.3, 0.17, 0.08) * mix(1.0, 0.45, smoothstep(0.3, 1.0, sf.r)), step(0.5, u_gore));
  woundCol = mix(woundCol, vec3(0.04, 0.035, 0.035), step(1.5, u_gore));
  woundCol += vec3(1.0, 0.85, 0.85) * wspec * 1.3 * (1.0 - step(1.5, u_gore));
  float rim = smoothstep(0.02, 0.15, sf.r) * (1.0 - smoothstep(0.15, 0.45, sf.r));
  col = mix(col, woundCol, cut);
  col *= 1.0 - rim * 0.55;
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
  // Thin films dry to a brown crust at the edge; thick pools stay dark, wet and glossy.
  float bl = clamp(sf.g * 1.3, 0.0, 1.0);
  float thick = smoothstep(0.35, 0.8, sf.g);
  vec3 bloodCol = mix(vec3(0.3, 0.07, 0.04), vec3(0.24, 0.01, 0.035), thick) * (0.7 + 0.5 * diff);
  bloodCol += vec3(1.0, 0.8, 0.8) * spec * thick * 0.9;
  float rimB = smoothstep(0.08, 0.2, sf.g) * (1.0 - smoothstep(0.2, 0.4, sf.g));
  bloodCol *= 1.0 - rimB * 0.45;
  col = mix(col, bloodCol, bl * 0.88);
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
  float glint = (1.0 - smoothstep(0.0, 0.06, gd)) * step(0.8, hash(gi + 1.3));
  float glintFoot = 1.0 - smoothstep(0.02, 0.12, fwidth(uv.x * 7.0));
  col += vec3(1.0, 0.96, 0.92) * glint * spec * wet * 0.5 * glintFoot;

  // Curse corruption (ART-0181): bruising creeps in from the rim; violet veins, bruise-black
  // necrosis and woodcut-hatched sigil scars spread from the Malison, driven by u_corrupt 0..1.
  // With a curse map (ENG-0099) the corruption lies where its sources painted it, not rim-in.
  float cmap = 0.0;
  if (u_curseOn > 0.5) {
    vec2 muv = (u_curseXf * vec3(px, 1.0)).xy;
    vec2 inMap = step(vec2(0.0), muv) * step(muv, vec2(1.0));
    cmap = texture(u_curseMap, muv).r * inMap.x * inMap.y;
  }
  float cmapN = cmap + (fbm(q * 2.3 + 5.0) - 0.5) * 0.3 * step(0.01, cmap);
  float cor = u_curseOn > 0.5 ? smoothstep(0.1, 0.9, cmapN) * 0.8 : u_corrupt * smoothstep(0.3, 1.0, r + fbm(uv * 1.7 + u_time * 0.1) * 0.4);
  col = mix(col, mix(vec3(0.16, 0.05, 0.2), u_curseAccent, 0.5), cor * 0.4);
  float cAmt = u_curseOn > 0.5 ? cmap : u_corrupt;
  if (cAmt > 0.001) {
    vec2 toM = u_corruptAt - px;
    float dM = length(toM);
    vec2 dirM = toM / max(dM, 1.0);
    // Reach: the corruption spreads out from the Malison as it grows (or as far as it was painted).
    float reach = u_curseOn > 0.5 ? 700.0 : u_corrupt * u_corrupt * 700.0;
    float cm = u_curseOn > 0.5 ? smoothstep(0.08, 0.45, cmapN) : rsmooth(reach, reach * 0.35, dM + (fbm(q * 2.3 + 5.0) - 0.5) * 160.0);
    // The corruption front: the thin band where the map is still rising.
    float cfront = u_curseOn > 0.5 ? smoothstep(0.03, 0.12, cmapN) * rsmooth(0.4, 0.18, cmapN) : 0.0;
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
    // Veins blacken along the advancing front (ENG-0099).
    float vfront = max(cveins, fine * 1.4) * cfront;
    col = mix(col, vec3(0.03, 0.01, 0.03), clamp(vfront, 0.0, 1.0) * 0.85);
    // Bruise-black necrosis in blotches nearest the Malison.
    float nec = smoothstep(0.58, 0.72, fbm(px * 0.006 + 13.0) + (1.0 - dM / max(reach, 1.0)) * 0.25) * cm * max(u_corrupt, cAmt);
    col = mix(col, u_curseAccent * 0.35 + vec3(0.02, 0.01, 0.02), nec * 0.6);
    // Woodcut-hatched sigil scarring: raised scar patches cut by parallel hatch strokes.
    // Scar patches are narrow welts (ridges of low-frequency noise); the hatching follows the lamp
    // side of each welt and breaks up like a cut woodblock line.
    float welt = 1.0 - abs(fbm(px * 0.0045 + 21.0) * 2.0 - 1.0);
    float scarM = smoothstep(0.9, 0.96, welt) * cm * smoothstep(0.35, 0.8, max(u_corrupt, cAmt));
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
  // The collar is hide rolled back over the retractors: a rounded cross-section that rises from
  // the cut lip, crests, and tucks under the drape. Light it by that profile, not the drape's.
  float cc = clamp((edge - 1.0) / collar, 0.0, 1.0);
  vec2 rv = normalize(px - u_center + vec2(1e-3));
  float roll = cos(3.14159 * cc);
  vec3 cn = normalize(vec3(-rv * roll * 0.85, 0.55 + 0.45 * sin(3.14159 * cc)));
  float cdiff = max(dot(cn, fl), 0.0);
  float skinLit = 0.22 + 0.9 * cdiff + 0.28 * pow(cdiff, 14.0) * (1.0 - u_sheen * 3.0);
  // Contact shadows: where it tucks under the linen, and down into the cut.
  skinLit *= mix(0.5, 1.0, rsmooth(1.0, 0.72, cc)) * mix(0.72, 1.0, smoothstep(0.0, 0.22, cc));
  // The collar's pores catch the lamp too, and it carries the same mottled tone.
  if (u_maps > 0.5) {
    skinLit *= 1.0 + 0.35 * dot(skinMap.rg * 2.0 - 1.0, normalize(u_light - px));
    skinCol *= mix(vec3(1.0), texture(u_toneMap, px / 260.0).rgb * 2.0, 0.5);
  }
  // The skin's scatter glow: strong in the fine-skinned, faint in thick hides.
  skinCol = skinCol * skinLit + u_skin * u_sssCol.rgb * 0.06 * u_sssCol.a;
  // The collar's inner lip: dermis in section, as wide as the hide is thick.
  float lip = rsmooth(1.0 + 0.004 + 0.012 * u_layers.x, 1.0, edge) * smoothstep(0.985, 0.995, edge);
  skinCol = mix(skinCol, mix(vec3(0.86, 0.72, 0.64), u_skin, 0.3) * (0.4 + 0.5 * fdiff), lip);
  if (u_fever > 0.001) {
    // Fever (ART-0212): a blotchy flush over the field, and sweat beads that catch the lamp.
    float flush = u_fever * (0.55 + 0.45 * fbm(q * 2.2 + 31.0));
    col = mix(col, col * vec3(1.18, 0.82, 0.8) + vec3(0.06, 0.0, 0.0), flush * 0.5);
    skinCol = mix(skinCol, skinCol * vec3(1.15, 0.85, 0.82), flush * 0.6);
    vec2 sbp = floor(px * 0.07);
    vec2 sbf = fract(px * 0.07) - 0.5 - (vec2(hash(sbp), hash(sbp + 1.7)) - 0.5) * 0.5;
    float bead = rsmooth(0.12, 0.0, length(sbf)) * step(1.0 - 0.18 * u_fever, hash(sbp + 9.1));
    float glint = 0.6 + 0.4 * sin(u_time * 3.0 + hash(sbp) * 20.0);
    col += vec3(1.0, 0.97, 0.92) * bead * glint * 0.35;
    skinCol += vec3(1.0, 0.97, 0.92) * bead * glint * 0.3;
  }
  if (u_venue == 2) {
    // A corpse (ENG-0274): waxy grey pallor, and livor mortis pooled purple-red on the dependent (lower) side.
    float livor = smoothstep(-0.1, 0.8, q.y + (fbm(q * 3.0 + 2.0) - 0.5) * 0.4);
    col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.95, 0.93, 0.9) + 0.06, 0.6);
    col = mix(col, vec3(0.34, 0.1, 0.2), livor * 0.55);
    skinCol = mix(skinCol, vec3(dot(skinCol, vec3(0.3, 0.5, 0.2))) * vec3(0.92, 0.94, 0.95), 0.6);
    skinCol = mix(skinCol, vec3(0.4, 0.16, 0.26), livor * 0.5);
  }
  vec3 outc = mix(drape, col * 0.3, rsmooth(1.06, 1.0, edge) * 0.6);
  outc = mix(outc, skinCol, inCollar);
  o = vec4(mix(outc, col, inside), 1.0);
}`;
}

/** The reference variant (live noise, every feature on): the shader lab and the mediump fallback build from it. */
export const FLESH_FS = fleshShaderSource(FLESH_LIVE_FULL);
