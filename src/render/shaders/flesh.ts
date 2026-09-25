/** GLSL ES 3.00 sources: flesh. */

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  // Quintic fade: continuous second derivative, so no creases at cell borders.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Each octave is rotated so the value-noise lattices never line up into visible squares.
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = OCT * p + 17.1; a *= 0.5; }
  return v + a * 0.5;
}
// Distance to nearest cell edge: membranes, alveoli, fat lobules.
// Smooth voronoi edge distance: d2 - d1 with a soft minimum so membranes never form hard creases.
uniform float u_cellSoft;
float cells(vec2 p) {
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
export const FLESH_FS = /* glsl */ `#version 300 es
precision highp float;
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
uniform vec2 u_light;
uniform float u_corrupt;
uniform sampler2D u_surface;
uniform vec2 u_surfTexel;
// Light rig: [0] surgeon's lamp, [1..2] candles. xy = position (virtual px), z = height, w = intensity.
uniform vec4 u_lights[3];
uniform vec3 u_lightCol[3];
uniform float u_rough;
out vec4 o;
// smoothstep with edge0 > edge1 is undefined in GLSL; this is the portable falling edge.
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }

${NOISE}
// Height contributed by wounds (negative) and swelling (positive).
float surfH(vec2 uv) {
  vec4 s = texture(u_surface, uv);
  return s.a * 1.3 - s.r * 1.4;
}
void main() {
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_view;
  vec2 q = (px - u_center) / u_radii;
  // Organs swell faintly with the heartbeat.
  // Heartbeat: the heart contracts ~5% in systole; other tissue barely stirs.
  float beat = u_pulse * u_pulse * (3.0 - 2.0 * u_pulse);
  float swell = 1.0 + beat * (u_kind == 1 ? 0.05 : 0.012);
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
  col = mix(col, u_vein, v * 0.45);

  // Wet specular from a smooth, low-frequency height field (finite differences, not dFdx,
  // so the highlight rolls over broad swells instead of sparkling on every noise texel).
  vec2 hp = q * 2.2 + vec2(0.0, u_time * 0.02);
  float e = 0.02;
  float h0 = fbm(hp);
  vec2 grad = vec2(fbm(hp + vec2(e, 0.0)) - h0, fbm(hp + vec2(0.0, e)) - h0) / e;
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
  float nVar = smoothstep(0.0, 1.0, clamp(length(fwidth(nrm)) * 2.0, 0.0, 0.5));
  float rough = clamp(mix(u_rough + 0.25, u_rough - 0.15, wet) + nVar * 0.3, 0.12, 0.9);
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
  vec3 sss = u_base * vec3(1.25, 0.35, 0.28) * pow(1.0 - diff, 2.0) * 0.32;
  float fres = pow(1.0 - clamp(nrm.z, 0.0, 1.0), 3.0);
  col = col * (vec3(0.28, 0.27, 0.3) + 0.52 * lit) + sss + specCol * (0.08 + 0.22 * wet) + vec3(1.0, 0.75, 0.7) * fres * 0.12;

  // Wound interior: deep, wet, glistening maroon with a dark rim.
  vec3 woundCol = mix(vec3(0.42, 0.03, 0.05), vec3(0.16, 0.0, 0.02), smoothstep(0.3, 1.0, sf.r));
  float wspec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), 50.0);
  woundCol += vec3(1.0, 0.8, 0.8) * wspec * 0.8;
  float rim = smoothstep(0.02, 0.15, sf.r) * (1.0 - smoothstep(0.15, 0.45, sf.r));
  col = mix(col, woundCol, cut);
  col *= 1.0 - rim * 0.35;
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

  // Curse corruption: purple-black bruising that creeps in from the rim.
  float cor = u_corrupt * smoothstep(0.3, 1.0, r + fbm(uv * 1.7 + u_time * 0.1) * 0.4);
  col = mix(col, vec3(0.16, 0.05, 0.2), cor * 0.7);

  // Retractor rim darkening.
  col *= rsmooth(1.02, 0.78, edge) * 0.6 + 0.4;
  float inside = rsmooth(1.0, 0.985, edge);
  vec3 outc = mix(drape, col * 0.3, rsmooth(1.06, 1.0, edge) * 0.6);
  o = vec4(mix(outc, col, inside), 1.0);
}`;
