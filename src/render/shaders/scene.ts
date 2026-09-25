/** GLSL ES 3.00 sources: scene. */

/**
 * Story environments, one specialised program per location (`#define KIND n`, compiled on
 * first use by Gfx.sceneField). Interiors are raymarched sets lit by candles and window
 * light; exteriors are layered 2.5D paintings with parallax, weather and ambient life.
 *
 *  0 hospice ward     1 street (Tanners' Rows)  2 anatomy theatre   3 chapel of Saint Ildra
 *  4 Kessendorf night 5 war camp                6 apothecary        7 plague alley
 *  8 guildhall        9 surgeon's tent         10 graveyard        11 prospectors' camp
 * 12 brood forest    13 ruined abbey loft      14 dawn battlefield 15 title key-art
 *
 * u_light: 0 night, 1 dusk, 2 day.  u_variant: 1 = burned hospice / rain at night.
 * u_parallax: pointer offset (-1..1); every layer bleeds past the frame so it never shows an edge.
 */
export const SCENE_FS = /* glsl */ `#version 300 es
#ifndef KIND
#define KIND 0
#endif
precision highp float;
in vec2 v_uv;
uniform vec2 u_view;
uniform float u_time;
uniform int u_kind;
uniform float u_light;
uniform float u_variant;
uniform vec2 u_parallax;
out vec4 o;

// ================================================================== library
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = OCT * p + 17.1; a *= 0.5; } return v; }
float fbm3(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = OCT * p + 17.1; a *= 0.5; } return v; }
float flick(float s) { return 0.82 + 0.1 * sin(u_time * 9.0 + s) * sin(u_time * 4.3 + s * 2.1) + 0.08 * noise(vec2(u_time * 6.0, s)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// 3D distance functions.
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdTorus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
// 2D distance functions (exterior layers).
float sd2Box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sd2Seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sd2Tri(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c, v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// Paint a 2D silhouette: 1 inside, soft by pixel size.
float fill(float d, float px) { return clamp(0.5 - d / px, 0.0, 1.0); }
// A small standing figure (head, cloak, legs) with a walking bob; p in figure units (height ~1).
float figure(vec2 p, float phase) {
  float bob = abs(sin(phase)) * 0.03;
  p.y -= bob;
  float head = length(p - vec2(0.0, 0.88)) - 0.1;
  float body = sd2Tri(p, vec2(-0.2, 0.18), vec2(0.2, 0.18), vec2(0.0, 0.82)) - 0.04;
  float legs = min(sd2Seg(p, vec2(-0.06, 0.2), vec2(-0.08 + sin(phase) * 0.08, 0.0)), sd2Seg(p, vec2(0.06, 0.2), vec2(0.08 - sin(phase) * 0.08, 0.0))) - 0.035;
  return min(min(head, body), legs);
}
// Stars and a moon for night skies.
vec3 starfield(vec2 sp, float amt) {
  vec2 sg = floor(sp * vec2(260.0, 146.0));
  float st = step(0.9965, hash(sg)) * (0.5 + 0.5 * sin(u_time * 2.0 + hash(sg) * 40.0));
  return vec3(0.8, 0.85, 1.0) * st * amt;
}
vec3 moon(vec2 sp, vec2 mp, vec3 col) {
  float md = length((sp - mp) * vec2(1.78, 1.0));
  col += vec3(0.5, 0.55, 0.7) * 0.1 / (md * md * 50.0 + 0.3);
  float disc = rsmooth(0.046, 0.042, md);
  vec3 m = vec3(0.86, 0.87, 0.92) * (0.78 + 0.28 * fbm((sp - mp) * 40.0));
  return mix(col, m, disc);
}
// Snow and rain overlays (FX layers).
vec3 snow(vec2 sp, vec3 col, float amt) {
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 q = sp * vec2(1.78, 1.0) * (18.0 + fk * 14.0) + vec2(sin(u_time * 0.3 + fk) * 2.0, u_time * (1.5 + fk));
    vec2 qi = floor(q), qf = fract(q) - 0.5;
    vec2 off = vec2(hash(qi) - 0.5, hash(qi + 1.7) - 0.5) * 0.6;
    float flake = rsmooth(0.08 - fk * 0.03, 0.0, length(qf - off)) * step(0.55, hash(qi + 9.0));
    col += vec3(0.85, 0.87, 0.95) * flake * (0.6 - fk * 0.25) * amt;
  }
  return col;
}
vec3 rain(vec2 sp, vec3 col, float amt) {
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 q = vec2(sp.x * (70.0 + fk * 40.0) + sp.y * 8.0, sp.y * (5.0 + fk) + u_time * (6.0 + fk * 2.0));
    vec2 qi = floor(q);
    float streak = step(0.93, hash(vec2(qi.x, qi.y))) * rsmooth(0.12, 0.0, abs(fract(q.x) - 0.5)) * smoothstep(0.0, 0.4, fract(q.y)) * rsmooth(1.0, 0.6, fract(q.y));
    col += vec3(0.55, 0.6, 0.72) * streak * (0.3 - fk * 0.07) * amt;
  }
  return col;
}
// Drifting fog bank at height h (0..1 screen), thickness t.
float fogBank(vec2 sp, float h, float t, float speed, float seed) {
  float f = fbm(vec2(sp.x * 3.0 + u_time * speed + seed, sp.y * 7.0 + seed));
  return rsmooth(h + t, h - t * 0.3, sp.y + (f - 0.5) * t) * (0.4 + 0.6 * f);
}
// Dust motes and ash floating in a light pool (FX layer).
float motes(vec2 sp, float density) {
  float m = 0.0;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 q = sp * vec2(1.78, 1.0) * (22.0 + fk * 16.0) + vec2(u_time * 0.12 * (fk + 1.0), -u_time * (0.18 + fk * 0.1));
    q += vec2(sin(q.y * 0.6 + u_time), cos(q.x * 0.5 + u_time * 0.7)) * 0.2;
    vec2 qi = floor(q), qf = fract(q) - 0.5;
    m += rsmooth(0.06, 0.0, length(qf - (vec2(hash(qi), hash(qi + 3.0)) - 0.5) * 0.7)) * step(1.0 - density, hash(qi + 11.0)) * (0.6 - fk * 0.2);
  }
  return m;
}
// Timber-framed gable skyline: returns roof height at x for a row.
float gables(float x, float seed, float base, float amp, float width) {
  float i = floor(x / width + seed);
  float f = fract(x / width + seed);
  float h = base + amp * hash1(i * 13.1 + seed);
  return h + width * 0.62 * (1.0 - abs(f - 0.5) * 2.0);
}

// ================================================================== interiors (raymarched)
#if KIND == 0 || KIND == 2 || KIND == 3 || KIND == 6 || KIND == 7 || KIND == 8 || KIND == 9 || KIND == 13
#define INTERIOR 1
#endif

#ifdef INTERIOR
// Material ids.
#define M_FLOOR 0.0
#define M_STONE 1.0
#define M_PILLAR 2.0
#define M_VAULT 3.0
#define M_WOOD 4.0
#define M_LINEN 5.0
#define M_GLASS 6.0
#define M_WAX 7.0
#define M_BRASS 8.0
#define M_CANVAS 9.0
#define M_STRAW 10.0
#define M_PLASTER 11.0
#define M_PAPER 12.0
#define M_FRAME 13.0
#define M_HERB 14.0
#define M_IRON 15.0
#define M_GILT 16.0
#define M_CLOTH 17.0
void U(inout float d, inout float m, float nd, float nm) { if (nd < d) { d = nd; m = nm; } }

// Stone arcade shared by ward, chapel and abbey: back wall with arches, two rows of pillars.
float arcade(vec3 p, out float m, float wallZ) {
  float d = p.y; m = M_FLOOR;
  float cell = mod(p.x + 2.0, 4.0) - 2.0;
  float wall = sdBox(p - vec3(0.0, 3.5, wallZ), vec3(40.0, 4.0, 0.6));
  float archHole = min(sdBox(vec3(cell, p.y - 1.8, p.z - wallZ), vec3(1.3, 1.8, 1.0)), length(vec2(cell, p.y - 3.6)) - 1.3);
  wall = max(wall, -archHole);
  U(d, m, wall, M_STONE);
  vec3 q = p; q.x = cell;
  float pil = min(sdCyl(q - vec3(0.0, 3.0, wallZ - 2.5), 0.42, 3.0), sdCyl(q - vec3(0.0, 3.0, wallZ - 7.5), 0.42, 3.0));
  pil = min(pil, sdBox(q - vec3(0.0, 0.15, wallZ - 2.5), vec3(0.6, 0.15, 0.6)));
  pil = min(pil, sdBox(q - vec3(0.0, 0.15, wallZ - 7.5), vec3(0.6, 0.15, 0.6)));
  pil = min(pil, sdBox(q - vec3(0.0, 6.05, wallZ - 2.5), vec3(0.58, 0.12, 0.58)));
  pil = min(pil, sdBox(q - vec3(0.0, 6.05, wallZ - 7.5), vec3(0.58, 0.12, 0.58)));
  U(d, m, pil, M_PILLAR);
  return d;
}

// ------------------------------------------------------------------ per-location sets
#if KIND == 0
// Hospice of Saint Ildra, the ward: vaulted arcade, cots, a leech-jar shelf, candle alcoves.
const int NL = 5;
const int NSH = 3;
vec3 lightPos(int i) {
  if (i == 0) return vec3(0.0, 1.45, 0.98);
  if (i == 1) return vec3(4.0, 1.45, 0.98);
  if (i == 2) return vec3(2.0, 1.12, 4.75);
  if (i == 3) return vec3(6.0, 1.12, 4.75);
  return vec3(-2.0, 1.12, 4.75);
}
vec3 lightCol(int i) { if (u_variant > 0.5) return vec3(0.9, 0.22, 0.05) * (i == 2 || i == 4 ? 0.6 : 0.0); return vec3(1.0, 0.62, 0.3) * (i < 2 ? 0.45 : 1.0) * mix(1.0, 0.35, step(1.5, u_light)); }
bool isFlame(int i) { return u_variant < 0.5; }
#define MOON_K (u_variant > 0.5 ? 1.4 : 0.45)
vec3 camPos() { return vec3(2.0 + sin(u_time * 0.15) * 0.25, 3.3, -5.2); }
vec3 camTarget() { return vec3(2.0 + sin(u_time * 0.15) * 0.1, 1.45, 6.0); }
#define FOG_K 0.022
float map(vec3 p, out float m) {
  float d = arcade(p, m, 9.0);
  float ceilD = 7.2 - p.y - 0.25 * cos(p.x * 0.52);
  if (u_variant > 0.5) ceilD = max(ceilD, -(length(p.xz - vec2(2.5, 5.0)) - 2.2 + 0.8 * fbm3(p.xz)));
  U(d, m, ceilD, M_VAULT);
  // Candle alcoves carved into the front pillars, a candle in each.
  float cell = mod(p.x + 2.0, 4.0) - 2.0;
  vec3 q = vec3(cell, p.y, p.z);
  float niche = min(sdBox(q - vec3(0.0, 1.35, 1.05), vec3(0.24, 0.32, 0.22)), length(vec2(q.x, q.y - 1.67)) - 0.24);
  niche = max(niche, abs(q.z - 1.05) - 0.22);
  if (m == M_PILLAR && abs(p.z - 1.5) < 1.0) d = max(d, -niche);
  U(d, m, sdCyl(q - vec3(0.0, 1.17, 1.02), 0.045, 0.14), M_WAX);
  // Cots between the pillars: frame, straw mattress, linen, pillow, and a sleeper in some.
  float bc = mod(p.x, 4.0) - 2.0;
  float bid = floor(p.x / 4.0);
  vec3 bq = vec3(bc, p.y, p.z - 3.7);
  if (abs(p.x) < 9.0) {
    float frame = sdBox(bq - vec3(0.0, 0.42, 0.0), vec3(0.48, 0.05, 1.0));
    vec3 lq = vec3(abs(bq.x) - 0.44, bq.y - 0.2, abs(bq.z) - 0.96);
    frame = min(frame, sdBox(lq, vec3(0.04, 0.22, 0.04)));
    frame = min(frame, sdBox(bq - vec3(0.0, 0.62, 0.98), vec3(0.48, 0.2, 0.03)));
    U(d, m, frame, M_WOOD);
    float mat = sdRBox(bq - vec3(0.0, 0.53, 0.0), vec3(0.44, 0.08, 0.94), 0.06);
    float sleeper = hash1(bid * 7.3) > 0.35 ? sdEll(bq - vec3(0.05, 0.64, -0.1), vec3(0.28, 0.13, 0.72)) : 1e5;
    float linen = smin(mat, sleeper, 0.12) - 0.012 * sin(bq.z * 14.0 + bq.x * 6.0) * step(0.55, bq.y);
    U(d, m, linen, M_LINEN);
    U(d, m, sdEll(bq - vec3(0.0, 0.66, 0.78), vec3(0.3, 0.07, 0.14)), M_LINEN);
    vec3 tq = vec3(bc - 0.0, p.y, p.z - 4.75);
    U(d, m, sdCyl(tq - vec3(0.0, 0.42, 0.0), 0.17, 0.03), M_WOOD);
    U(d, m, sdCyl(tq - vec3(0.0, 0.2, 0.0), 0.04, 0.2), M_WOOD);
    U(d, m, sdCyl(tq - vec3(0.0, 0.53, 0.0), 0.045, 0.08), M_WAX);
  }
  // Leech-jar shelf against the right-hand arch.
  vec3 sq = p - vec3(4.0, 0.0, 8.1);
  float shelf = 1e5;
  for (int k = 0; k < 3; k++) shelf = min(shelf, sdBox(sq - vec3(0.0, 0.9 + float(k) * 0.62, 0.0), vec3(1.1, 0.025, 0.24)));
  shelf = min(shelf, sdBox(vec3(abs(sq.x) - 1.1, sq.y - 1.3, sq.z), vec3(0.04, 1.3, 0.24)));
  U(d, m, shelf, M_WOOD);
  if (abs(sq.x) < 1.1 && sq.y > 0.9 && sq.y < 2.5) {
    float row = floor((sq.y - 0.9) / 0.62);
    float jx = mod(sq.x + 0.18, 0.36) - 0.18;
    vec3 jq = vec3(jx, sq.y - (0.9 + row * 0.62) - 0.12, sq.z);
    float jar = sdRBox(jq, vec3(0.12, 0.11, 0.12), 0.05);
    U(d, m, jar, M_GLASS);
    U(d, m, sdCyl(jq - vec3(0.0, 0.13, 0.0), 0.085, 0.025), M_WAX);
  }
  return d;
}
vec3 beyond(vec3 rd) {
  vec3 night = mix(vec3(0.02, 0.025, 0.05), vec3(0.08, 0.09, 0.14), smoothstep(-0.2, 0.6, rd.y));
  vec3 day = mix(vec3(0.55, 0.6, 0.62), vec3(0.75, 0.8, 0.85), smoothstep(-0.2, 0.6, rd.y));
  vec3 dusk = mix(vec3(0.5, 0.25, 0.12), vec3(0.2, 0.15, 0.25), smoothstep(-0.1, 0.5, rd.y));
  return u_light > 1.5 ? day : u_light > 0.5 ? dusk : night;
}
#endif

#if KIND == 2
// The anatomy theatre: tiered wooden galleries round a slab, a brass lamp, a drain gutter.
const int NL = 4;
const int NSH = 2;
const vec3 CEN = vec3(0.0, 0.0, 5.0);
vec3 lightPos(int i) {
  if (i == 0) return vec3(0.0, 2.62, 4.2);
  if (i == 1) return vec3(-3.4, 2.0, 7.4);
  if (i == 2) return vec3(3.4, 2.0, 7.4);
  return vec3(0.0, 3.4, 9.2);
}
vec3 lightCol(int i) { return i == 0 ? vec3(1.0, 0.72, 0.4) * 0.7 : vec3(1.0, 0.6, 0.28) * 0.9; }
bool isFlame(int i) { return true; }
vec3 camPos() { return vec3(sin(u_time * 0.12) * 0.3, 4.4, -1.6); }
vec3 camTarget() { return vec3(0.0, 0.55, 6.6); }
float map(vec3 p, out float m) {
  float d = p.y; m = M_FLOOR;
  // Drain gutter down the middle of the floor.
  d = max(d, -sdBox(p - vec3(0.0, 0.0, 4.2), vec3(0.07, 0.04, 8.0)));
  vec2 rp = p.xz - CEN.xz;
  float r = length(rp);
  // Tiers: concentric wooden steps rising behind the slab (back half only).
  float back = rp.y + 1.2;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float R = 3.3 + fk * 0.95;
    float tier = max(max(abs(r - R) - 0.48, p.y - (0.55 + fk * 0.75)), -back);
    U(d, m, tier, M_WOOD);
    // Balustrade rail and turned balusters.
    float rail = max(length(vec2(r - (R - 0.44), p.y - (1.35 + fk * 0.75))) - 0.045, -back);
    float ang = atan(rp.y, rp.x);
    float bal = max(max(length(vec2((fract(ang * (R * 3.0) / 6.2832) - 0.5) * 6.2832 * R / (R * 3.0), r - (R - 0.44))) - 0.03, abs(p.y - (0.95 + fk * 0.75)) - 0.4), -back);
    U(d, m, min(rail, bal), M_WOOD);
  }
  // Outer wall and dome.
  U(d, m, max(8.2 - r, -p.y), M_PLASTER);
  U(d, m, 6.8 - p.y + 0.02 * r * r, M_VAULT);
  // The slab: stone top on turned legs, a sheeted body.
  vec3 sq = p - vec3(0.0, 0.0, 4.2);
  float slab = sdRBox(sq - vec3(0.0, 0.92, 0.0), vec3(0.6, 0.07, 1.15), 0.03);
  slab = min(slab, sdBox(vec3(abs(sq.x) - 0.45, sq.y - 0.45, abs(sq.z) - 0.95), vec3(0.07, 0.45, 0.07)));
  U(d, m, slab, M_STONE);
  float body = sdEll(sq - vec3(0.0, 1.08, 0.05), vec3(0.34, 0.12, 0.95)) - 0.015 * sin(sq.z * 18.0);
  body = smin(body, sdEll(sq - vec3(0.0, 1.08, -0.95), vec3(0.14, 0.1, 0.13)), 0.1);
  U(d, m, body, M_LINEN);
  // Brass lamp on its chain.
  vec3 lq = p - vec3(0.0, 2.8, 4.2);
  float lamp = max(abs(sdEll(lq, vec3(0.42, 0.16, 0.42))) - 0.012, lq.y + 0.02);
  lamp = min(lamp, sdTorus(lq - vec3(0.0, -0.02, 0.0), 0.42, 0.02));
  lamp = min(lamp, sdCyl(lq - vec3(0.0, 0.16, 0.0), 0.06, 0.06));
  for (int k = 0; k < 3; k++) { float a = float(k) * 2.094; lamp = min(lamp, sdCap(lq, vec3(cos(a) * 0.4, -0.02, sin(a) * 0.4), vec3(0.0, 0.9, 0.0), 0.008)); }
  lamp = min(lamp, sdCap(p, vec3(0.0, 3.7, 4.2), vec3(0.0, 6.8, 4.2), 0.02));
  U(d, m, lamp, M_BRASS);
  for (int k = 0; k < 6; k++) { float a = float(k) * 1.047; U(d, m, sdCyl(lq - vec3(cos(a) * 0.3, -0.1, sin(a) * 0.3), 0.025, 0.06), M_WAX); }
  return d;
}
vec3 beyond(vec3 rd) { return vec3(0.02, 0.015, 0.012); }
#endif

#if KIND == 3
// Chapel of Saint Ildra: pews, altar and reliquary, the sun-in-palm rose window.
const int NL = 4;
const int NSH = 2;
vec3 lightPos(int i) {
  if (i == 0) return vec3(-0.9, 1.55, 10.2);
  if (i == 1) return vec3(0.9, 1.55, 10.2);
  if (i == 2) return vec3(-2.9, 1.2, 4.0);
  return vec3(2.9, 1.2, 6.5);
}
vec3 lightCol(int i) { return vec3(1.0, 0.62, 0.3) * (i < 2 ? 1.2 : 0.7); }
bool isFlame(int i) { return true; }
vec3 camPos() { return vec3(sin(u_time * 0.13) * 0.2, 2.5, -1.8); }
vec3 camTarget() { return vec3(0.0, 2.35, 10.0); }
float map(vec3 p, out float m) {
  float d = p.y; m = M_FLOOR;
  // Nave walls with engaged pillars; the east wall pierced by the rose and a lancet.
  float side = 4.2 - abs(p.x);
  U(d, m, side, M_STONE);
  vec3 q = vec3(abs(p.x) - 3.9, p.y, mod(p.z, 3.0) - 1.5);
  U(d, m, sdCyl(q - vec3(0.0, 3.2, 0.0), 0.36, 3.2), M_PILLAR);
  float east = sdBox(p - vec3(0.0, 4.0, 12.3), vec3(6.0, 4.5, 0.35));
  float rose = length(p.xy - vec2(0.0, 4.4)) - 2.1;
  float lancet = min(sdBox(vec3(p.x, p.y - 1.55, 0.0), vec3(0.55, 1.1, 1.0)), length(p.xy - vec2(0.0, 2.6)) - 0.55);
  east = max(east, -min(rose, lancet));
  U(d, m, east, M_STONE);
  U(d, m, 7.6 - p.y - 0.2 * cos(p.x * 0.75), M_VAULT);
  // Pews: two blocks of benches.
  if (p.z < 9.0 && p.z > 1.0) {
    vec3 pq = vec3(abs(p.x) - 1.75, p.y, mod(p.z - 1.0, 1.35) - 0.675);
    float pew = sdBox(pq - vec3(0.0, 0.45, 0.0), vec3(1.2, 0.04, 0.22));
    pew = min(pew, sdBox(pq - vec3(0.0, 0.78, 0.2), vec3(1.2, 0.3, 0.03)));
    pew = min(pew, sdBox(vec3(abs(pq.x) - 1.18, pq.y - 0.45, pq.z), vec3(0.04, 0.45, 0.24)));
    U(d, m, pew, M_WOOD);
  }
  // Altar, cloth and reliquary.
  vec3 aq = p - vec3(0.0, 0.0, 10.4);
  U(d, m, sdBox(aq - vec3(0.0, 0.5, 0.0), vec3(1.3, 0.5, 0.5)), M_STONE);
  U(d, m, sdBox(aq - vec3(0.0, 0.9, -0.02), vec3(1.34, 0.12, 0.52)), M_CLOTH);
  vec3 rq = aq - vec3(0.0, 1.2, 0.0);
  float rel = sdBox(rq, vec3(0.32, 0.18, 0.18));
  rel = min(rel, max(sdBox(rq - vec3(0.0, 0.26, 0.0), vec3(0.34, 0.12, 0.2)), abs(rq.x) + (rq.y - 0.26) * 2.6 - 0.34));
  U(d, m, rel, M_GILT);
  for (int k = 0; k < 2; k++) U(d, m, sdCyl(p - vec3(k == 0 ? -0.9 : 0.9, 1.3, 10.2), 0.05, 0.28), M_WAX);
  return d;
}
// The window: a sun in an open palm, rose-leaded, on a field of deep blue with red quarries.
vec3 windowGlass(vec2 w) {
  vec2 c = w - vec2(0.0, 4.4);
  float r = length(c), a = atan(c.y, c.x);
  vec3 blue = vec3(0.12, 0.2, 0.75), red = vec3(0.7, 0.08, 0.1), gold = vec3(1.0, 0.75, 0.2), pale = vec3(0.95, 0.85, 0.7);
  vec3 col = mix(blue, red, step(0.5, fract(a / 6.2832 * 12.0 + 0.25 * step(1.4, r))) * step(1.35, r));
  // Palm: an open hand rising from the bottom of the rose.
  vec2 h = c - vec2(0.0, -0.55);
  float palm = length(h * vec2(1.0, 1.3)) - 0.42;
  for (int k = 0; k < 4; k++) {
    float fx = -0.27 + float(k) * 0.18;
    palm = min(palm, length(vec2(h.x - fx, max(0.0, abs(h.y - 0.55 - 0.05 * float(k == 1 || k == 2)) - 0.22))) - 0.07);
  }
  palm = min(palm, length(vec2(h.x + 0.42 - (h.y + 0.1) * 0.6, max(0.0, abs(h.y + 0.05) - 0.14))) - 0.07);
  col = mix(col, pale, step(palm, 0.0));
  // Sun above the palm, rays out to the tracery.
  vec2 s = c - vec2(0.0, 0.35);
  float sun = length(s) - 0.36;
  float rays = step(0.5, fract(atan(s.y, s.x) / 6.2832 * 16.0)) * step(length(s), 1.3) * step(0.42, length(s));
  col = mix(col, gold * 0.9, rays * step(0.0, palm));
  col = mix(col, gold * 1.2, step(sun, 0.0));
  // Lead cames: radial spokes, concentric rings, a quarry grid in the lancet.
  float lead = rsmooth(0.035, 0.015, abs(r - 1.35)) + rsmooth(0.03, 0.012, abs(r - 2.05));
  lead += rsmooth(0.03, 0.01, abs(fract(a / 6.2832 * 12.0) - 0.5) * r * 0.52) * step(1.35, r);
  lead += rsmooth(0.03, 0.01, abs(sun)) + rsmooth(0.03, 0.01, abs(palm));
  vec2 g = fract(w * vec2(3.0, 2.2)) - 0.5;
  float lq = step(r, 0.0) + step(3.0, w.y) * 0.0;
  if (w.y < 3.1) {
    col = mix(vec3(0.7, 0.1, 0.12), mix(vec3(0.15, 0.25, 0.8), vec3(0.9, 0.7, 0.2), hash(floor(w * vec2(3.0, 2.2)))), hash(floor(w * vec2(3.0, 2.2)) + 3.0));
    lead = rsmooth(0.06, 0.03, 0.5 - max(abs(g.x), abs(g.y)));
  }
  col *= 0.8 + 0.3 * noise(w * 18.0);
  return col * (1.0 - clamp(lead + lq, 0.0, 1.0));
}
vec3 beyond(vec3 rd) { return vec3(0.0); }
#endif

#if KIND == 6
// Hospice apothecary: shelves of jars, an alembic on the bench, herbs drying from a rafter.
const int NL = 3;
const int NSH = 2;
vec3 lightPos(int i) {
  if (i == 0) return vec3(-0.6, 1.25, 1.9);
  if (i == 1) return vec3(1.9, 2.2, 2.6);
  return vec3(-2.4, 2.3, 3.2);
}
vec3 lightCol(int i) { return vec3(1.0, 0.62, 0.3) * (i == 0 ? 1.2 : 0.55); }
bool isFlame(int i) { return i == 0; }
vec3 camPos() { return vec3(sin(u_time * 0.14) * 0.15, 2.05, -1.9); }
vec3 camTarget() { return vec3(0.2, 1.55, 4.0); }
float map(vec3 p, out float m) {
  float d = p.y; m = M_FLOOR;
  U(d, m, 4.3 - p.z, M_PLASTER);
  U(d, m, 3.8 - abs(p.x), M_PLASTER);
  U(d, m, 3.4 - p.y, M_VAULT);
  // Ceiling beams and the herb rafter.
  vec3 bq = vec3(p.x, p.y - 3.25, mod(p.z, 1.6) - 0.8);
  U(d, m, sdBox(bq, vec3(4.0, 0.12, 0.1)), M_WOOD);
  U(d, m, sdBox(p - vec3(0.0, 2.75, 2.2), vec3(3.6, 0.07, 0.07)), M_WOOD);
  float hx = mod(p.x + 0.25, 0.5) - 0.25;
  float hid = floor((p.x + 0.25) / 0.5);
  if (abs(p.x) < 3.4) {
    float len = 0.28 + 0.18 * hash1(hid);
    vec3 hq = vec3(hx, p.y - 2.62, p.z - 2.2);
    float string = sdCap(hq, vec3(0.0, 0.1, 0.0), vec3(0.0, -0.08, 0.0), 0.006);
    // A bunch flares from the tie downward: stems plus a leafy fringe.
    float t2 = clamp(-(hq.y + 0.08) / len, 0.0, 1.0);
    float bundle = length(hq.xz) - (0.012 + 0.045 * sqrt(t2)) - 0.02 * noise(vec2(atan(hq.z, hq.x) * 4.0, hq.y * 40.0)) * t2;
    bundle = max(bundle, abs(hq.y + 0.08 + len * 0.5) - len * 0.5);
    U(d, m, string, M_WOOD);
    U(d, m, bundle * 0.7, M_HERB);
  }
  // Wall shelves with jars and bottles.
  vec3 sq = p - vec3(0.0, 0.0, 4.05);
  float shelf = 1e5;
  for (int k = 0; k < 4; k++) shelf = min(shelf, sdBox(sq - vec3(0.0, 0.75 + float(k) * 0.6, 0.0), vec3(3.4, 0.025, 0.24)));
  U(d, m, shelf, M_WOOD);
  if (sq.y > 0.75 && sq.y < 2.75 && abs(sq.x) < 3.4) {
    float row = floor((sq.y - 0.75) / 0.6);
    float cid = floor((sq.x + 0.2) / 0.4);
    float jx = mod(sq.x + 0.2, 0.4) - 0.2;
    float hsh = hash(vec2(cid, row));
    vec3 jq = vec3(jx, sq.y - (0.75 + row * 0.6), sq.z);
    float body = hsh > 0.5 ? sdRBox(jq - vec3(0.0, 0.15, 0.0), vec3(0.13, 0.14, 0.13), 0.06) : sdEll(jq - vec3(0.0, 0.13, 0.0), vec3(0.12, 0.13, 0.12));
    if (hsh < 0.5) body = min(body, sdCyl(jq - vec3(0.0, 0.3, 0.0), 0.035, 0.07));
    if (hsh > 0.9) body = 1e5;
    U(d, m, body, M_GLASS);
    U(d, m, sdCyl(jq - vec3(0.0, hsh > 0.5 ? 0.3 : 0.39, 0.0), hsh > 0.5 ? 0.1 : 0.04, 0.02), M_WAX);
  }
  // Bench with the alembic, a mortar and a candle.
  vec3 tq = p - vec3(0.2, 0.0, 2.3);
  U(d, m, sdBox(tq - vec3(0.0, 0.9, 0.0), vec3(1.8, 0.05, 0.55)), M_WOOD);
  U(d, m, sdBox(vec3(abs(tq.x) - 1.65, tq.y - 0.45, abs(tq.z) - 0.45), vec3(0.06, 0.45, 0.06)), M_WOOD);
  vec3 aq = tq - vec3(0.55, 0.0, 0.0);
  float alembic = length(aq - vec3(0.0, 1.17, 0.0)) - 0.23;
  alembic = smin(alembic, sdCap(aq, vec3(0.0, 1.3, 0.0), vec3(0.0, 1.62, 0.0), 0.05), 0.05);
  alembic = smin(alembic, sdEll(aq - vec3(0.0, 1.7, 0.0), vec3(0.13, 0.1, 0.13)), 0.04);
  alembic = min(alembic, sdCap(aq, vec3(0.08, 1.72, 0.0), vec3(0.75, 1.2, 0.05), 0.022));
  U(d, m, alembic, M_GLASS);
  U(d, m, length(aq - vec3(0.78, 1.08, 0.05)) - 0.13, M_GLASS);
  U(d, m, sdCyl(aq - vec3(0.0, 0.99, 0.0), 0.16, 0.04), M_BRASS);
  vec3 mq = tq - vec3(-0.9, 1.02, 0.1);
  float mortar = max(sdCyl(mq, 0.14, 0.09), -sdCyl(mq - vec3(0.0, 0.05, 0.0), 0.1, 0.09));
  mortar = min(mortar, sdCap(mq, vec3(0.0, 0.0, 0.0), vec3(0.12, 0.2, 0.04), 0.025));
  U(d, m, mortar, M_STONE);
  U(d, m, sdCyl(tq - vec3(-0.8, 1.04, -0.4), 0.04, 0.1), M_WAX);
  return d;
}
vec3 beyond(vec3 rd) { return vec3(0.02); }
#endif


#if KIND == 7
// Plague alley in Tanners' Rows: jettied walls leaning in, a cart of the dead, a beaked physician in the fog.
const int NL = 3;
const int NSH = 2;
vec3 lightPos(int i) {
  if (i == 0) return vec3(-1.02, 2.45, 4.3);
  if (i == 1) return vec3(1.0, 2.2, 11.0);
  return vec3(-0.2, 1.8, 16.0);
}
vec3 lightCol(int i) { return vec3(1.0, 0.6, 0.28) * (i == 0 ? 1.4 : 0.9); }
bool isFlame(int i) { return true; }
vec3 camPos() { return vec3(0.15 + sin(u_time * 0.12) * 0.08, 1.9, -1.2); }
vec3 camTarget() { return vec3(0.1, 1.75, 10.0); }
#define FOG_K 0.075
#define FOG_COL vec3(0.2, 0.2, 0.21)
float jetty(float y) { return 0.28 * smoothstep(2.3, 2.45, y) + 0.28 * smoothstep(4.3, 4.45, y); }
float map(vec3 p, out float m) {
  float d = p.y + 0.05 * smoothstep(0.25, 0.0, abs(p.x)); m = M_FLOOR;
  float wl = p.x + 1.45 - jetty(p.y) - 0.04 * sin(p.z * 0.4);
  float wr = 1.45 - p.x - jetty(p.y) + 0.04 * sin(p.z * 0.37 + 1.0);
  float eave = 6.0 + 0.8 * hash1(floor(p.z / 3.2) + step(0.0, p.x) * 7.0);
  float walls = max(min(wl, wr) * 0.9, p.y - eave);
  U(d, m, walls, M_PLASTER);
  // Eaves: a dark soffit board along each wall top.
  U(d, m, max(abs(p.y - eave) - 0.08, min(wl, wr) - 0.25), M_WOOD);
  U(d, m, 22.0 - p.z, M_PLASTER);
  // Lantern bracket on the left wall.
  vec3 lq = p - vec3(-1.02, 2.45, 4.3);
  float lan = max(sdBox(lq, vec3(0.09, 0.13, 0.09)), -sdBox(lq, vec3(0.07, 0.11, 0.2)));
  lan = min(lan, sdCap(p, vec3(-1.45, 2.7, 4.3), vec3(-1.02, 2.7, 4.3), 0.02));
  lan = min(lan, sdCap(p, vec3(-1.02, 2.7, 4.3), vec3(-1.02, 2.58, 4.3), 0.01));
  U(d, m, lan, M_IRON);
  // The cart: bed, sides, two wheels, shafts on the cobbles; shrouded bodies heaped on it.
  vec3 cq = p - vec3(0.35, 0.0, 6.2);
  cq.xz = rot(0.25) * cq.xz;
  float cart = sdBox(cq - vec3(0.0, 0.78, 0.0), vec3(0.55, 0.05, 1.05));
  cart = min(cart, sdBox(vec3(abs(cq.x) - 0.55, cq.y - 0.95, cq.z), vec3(0.03, 0.17, 1.05)));
  cart = min(cart, sdCap(vec3(abs(cq.x), cq.yz), vec3(0.3, 0.72, -1.0), vec3(0.3, 0.1, -2.2), 0.04));
  U(d, m, cart, M_WOOD);
  vec3 wq = vec3(abs(cq.x) - 0.68, cq.y - 0.48, cq.z - 0.2);
  float wheel = max(abs(length(wq.yz) - 0.44) - 0.045, abs(wq.x) - 0.04);
  float spokes = max(max(min(abs(wq.y), abs(wq.z)) - 0.025, length(wq.yz) - 0.44), abs(wq.x) - 0.025);
  U(d, m, min(wheel, spokes), M_WOOD);
  float bodies = sdEll(cq - vec3(-0.15, 1.02, 0.35), vec3(0.24, 0.16, 0.8));
  bodies = smin(bodies, sdEll(cq - vec3(0.22, 1.0, -0.2), vec3(0.22, 0.15, 0.75)), 0.1);
  bodies = smin(bodies, sdEll(cq - vec3(0.02, 1.22, 0.05), vec3(0.2, 0.13, 0.62)), 0.1);
  bodies -= 0.012 * sin(cq.z * 16.0 + cq.x * 7.0);
  U(d, m, bodies, M_LINEN);
  U(d, m, sdEll(cq - vec3(-0.35, 0.95, -1.02), vec3(0.06, 0.05, 0.14)), M_CLOTH + 10.0); // a hand hanging from the shroud
  // The beak-masked physician, far off in the fog.
  vec3 dq = p - vec3(-0.25, 0.0, 14.5);
  float doc = sdEll(dq - vec3(0.0, 0.85, 0.0), vec3(0.34, 0.85, 0.3));
  doc = smin(doc, length(dq - vec3(0.0, 1.78, 0.0)) - 0.15, 0.05);
  doc = min(doc, sdCyl(dq - vec3(0.0, 1.93, 0.0), 0.38, 0.015));
  doc = min(doc, sdCyl(dq - vec3(0.0, 2.05, 0.0), 0.14, 0.12));
  doc = min(doc, sdCap(dq, vec3(0.0, 1.74, -0.1), vec3(0.18, 1.62, -0.42), 0.035));
  doc = min(doc, sdCap(dq, vec3(0.3, 0.9, 0.0), vec3(0.55, 1.9, 0.1), 0.02)); // his staff
  U(d, m, doc, M_CLOTH);
  return d;
}
vec3 beyond(vec3 rd) {
  vec3 sky = u_light > 1.5 ? vec3(0.6, 0.62, 0.64) : u_light > 0.5 ? mix(vec3(0.7, 0.35, 0.18), vec3(0.2, 0.14, 0.2), smoothstep(0.2, 0.6, rd.y)) : vec3(0.05, 0.06, 0.1);
  return sky * 1.2;
}
#endif

#if KIND == 8
// Guildhall of Surgeons: panelled walls, portraits of guild masters, an anatomy chart.
const int NL = 4;
const int NSH = 2;
vec3 lightPos(int i) {
  if (i < 3) { float a = float(i) * 2.094 + u_time * 0.05; return vec3(cos(a) * 0.7, 3.35, 4.6 + sin(a) * 0.7); }
  return vec3(2.6, 1.3, 2.0);
}
vec3 lightCol(int i) { return vec3(1.0, 0.62, 0.3) * (i < 3 ? 0.9 : 0.6); }
bool isFlame(int i) { return true; }
vec3 camPos() { return vec3(sin(u_time * 0.12) * 0.2, 1.8, -2.0); }
vec3 camTarget() { return vec3(0.0, 2.3, 8.0); }
float map(vec3 p, out float m) {
  float d = p.y; m = M_FLOOR;
  U(d, m, 8.5 - p.z, M_PLASTER);
  U(d, m, 4.6 - abs(p.x), M_PLASTER);
  U(d, m, 5.4 - p.y, M_VAULT);
  // Wainscot panelling.
  float wain = min(8.35 - p.z, 4.45 - abs(p.x));
  wain = max(wain, p.y - 1.25);
  U(d, m, wain, M_WOOD);
  // Anatomy chart on the end wall; portraits along it and the side walls.
  U(d, m, sdBox(p - vec3(0.0, 2.9, 8.42), vec3(1.05, 1.45, 0.04)), M_PAPER);
  vec3 fq = vec3(abs(p.x) - 2.6, p.y - 2.9, p.z - 8.38);
  float frame = max(sdBox(fq, vec3(0.62, 0.8, 0.08)), -sdBox(fq - vec3(0.0, 0.0, -0.05), vec3(0.5, 0.68, 0.06)));
  U(d, m, frame, M_FRAME);
  U(d, m, sdBox(fq - vec3(0.0, 0.0, 0.02), vec3(0.52, 0.7, 0.02)), M_PAPER + 20.0);
  vec3 sq = vec3(4.45 - abs(p.x), p.y - 2.8, mod(p.z, 2.6) - 1.3);
  float sf = max(sdBox(sq, vec3(0.08, 0.72, 0.52)), -sdBox(sq - vec3(-0.05, 0.0, 0.0), vec3(0.06, 0.6, 0.42)));
  if (p.z < 7.0) { U(d, m, sf, M_FRAME); U(d, m, sdBox(sq, vec3(0.02, 0.62, 0.44)), M_PAPER + 20.0); }
  // Long table, chairs.
  U(d, m, sdBox(p - vec3(0.0, 0.85, 4.6), vec3(0.8, 0.05, 2.2)), M_WOOD);
  U(d, m, sdBox(vec3(abs(p.x) - 0.65, p.y - 0.42, abs(p.z - 4.6) - 2.0), vec3(0.06, 0.42, 0.06)), M_WOOD);
  vec3 cq = vec3(abs(p.x) - 1.2, p.y, mod(p.z - 3.4, 1.2) - 0.6);
  if (p.z > 2.8 && p.z < 6.6) {
    float ch = sdBox(cq - vec3(0.0, 0.5, 0.0), vec3(0.24, 0.04, 0.24));
    ch = min(ch, sdBox(cq - vec3(0.24, 1.0, 0.0), vec3(0.03, 0.5, 0.22)));
    U(d, m, ch, M_WOOD);
  }
  // Iron candle crown over the table.
  U(d, m, sdTorus(p - vec3(0.0, 3.25, 4.6), 0.75, 0.02), M_IRON);
  U(d, m, sdCap(p, vec3(0.0, 3.25, 4.6), vec3(0.0, 5.4, 4.6), 0.02), M_IRON);
  return d;
}
vec3 beyond(vec3 rd) { return vec3(0.02); }
// Portraits of past masters: dark ground, a lit face, a white ruff, a black gown.
vec3 portraitPaint(vec2 u, float seed) {
  vec3 col = mix(vec3(0.08, 0.06, 0.04), vec3(0.18, 0.12, 0.06), fbm(u * 3.0 + seed));
  float face = length((u - vec2(0.0, 0.18)) * vec2(1.25, 1.0)) - 0.2;
  float ruff = length((u - vec2(0.0, -0.08)) * vec2(0.7, 2.2)) - 0.2;
  float gown = sd2Tri(u, vec2(-0.55, -0.7), vec2(0.55, -0.7), vec2(0.0, 0.05));
  float cap = length((u - vec2(0.0, 0.32)) * vec2(1.0, 1.8)) - 0.2;
  col = mix(col, vec3(0.04, 0.03, 0.03), step(gown, 0.0));
  col = mix(col, vec3(0.85, 0.8, 0.7) * (0.8 + 0.2 * sin(u.x * 80.0)), step(ruff, 0.0));
  col = mix(col, vec3(0.7, 0.5, 0.38) * (0.75 + 0.3 * smoothstep(0.2, -0.2, u.x + u.y)), step(face, 0.0));
  col = mix(col, vec3(0.05), step(cap, 0.0) * step(0.28, u.y) * step(0.5, hash1(seed)));
  return col * (0.85 + 0.2 * noise(u * 40.0));
}
// The anatomy chart: a woodcut écorché with lettered callouts.
vec3 anatomyChart(vec2 u) {
  vec3 col = vec3(0.86, 0.78, 0.6) * (0.85 + 0.2 * fbm(u * 6.0));
  vec2 b = u - vec2(0.0, -0.05);
  float head = abs(length(b - vec2(0.0, 0.55)) - 0.1) - 0.012;
  float torso = abs(length((b - vec2(0.0, 0.15)) * vec2(1.4, 0.8)) - 0.22) - 0.012;
  float limbs = min(min(sd2Seg(b, vec2(-0.14, 0.32), vec2(-0.32, -0.05)), sd2Seg(b, vec2(0.14, 0.32), vec2(0.32, -0.05))), min(sd2Seg(b, vec2(-0.07, -0.05), vec2(-0.12, -0.6)), sd2Seg(b, vec2(0.07, -0.05), vec2(0.12, -0.6)))) - 0.02;
  float ribs = abs(fract((b.y - 0.02) * 22.0) - 0.5) * 0.045 - 0.004;
  ribs = max(ribs, length((b - vec2(0.0, 0.15)) * vec2(1.4, 0.8)) - 0.2);
  float ink = min(min(head, torso), min(abs(limbs) - 0.008, ribs));
  for (int k = 0; k < 5; k++) {
    float fy = 0.55 - float(k) * 0.26;
    float side = k % 2 == 0 ? 1.0 : -1.0;
    ink = min(ink, sd2Seg(b, vec2(side * 0.12, fy), vec2(side * 0.42, fy + 0.04)) - 0.003);
    ink = min(ink, length(b - vec2(side * 0.46, fy + 0.04)) - 0.02);
  }
  col = mix(col, vec3(0.12, 0.07, 0.04), rsmooth(0.006, 0.0, ink));
  col = mix(col, vec3(0.6, 0.1, 0.08), rsmooth(0.03, 0.0, length(b - vec2(0.08, 0.2)) - 0.02));
  return col;
}
#endif

#if KIND == 9
// The field surgeon's tent: a trestle table, a lantern, bloody straw, a saw rack; canvas lit through.
const int NL = 2;
const int NSH = 2;
vec3 lightPos(int i) { return i == 0 ? vec3(0.1, 2.05 + sin(u_time * 0.8) * 0.02, 2.7) : vec3(-1.8, 0.95, 4.0); }
vec3 lightCol(int i) { return vec3(1.0, 0.64, 0.32) * (i == 0 ? 0.8 : 0.4); }
bool isFlame(int i) { return i == 0; }
vec3 camPos() { return vec3(sin(u_time * 0.14) * 0.15, 2.2, -1.9); }
vec3 camTarget() { return vec3(0.2, 1.05, 5.0); }
float map(vec3 p, out float m) {
  float d = p.y; m = M_STRAW;
  // Ridge tent: two roof slopes, low walls and the back flap.
  float roof = (3.1 - p.y - abs(p.x) * 0.85) * 0.75 + 0.03 * sin(p.z * 3.0 + p.x);
  U(d, m, roof, M_CANVAS);
  U(d, m, 2.9 - abs(p.x), M_CANVAS);
  U(d, m, 5.6 - p.z + 0.05 * sin(p.x * 4.0), M_CANVAS);
  U(d, m, sdCyl(p - vec3(0.0, 1.6, 5.2), 0.07, 1.6), M_WOOD);
  U(d, m, sdCap(p, vec3(0.0, 3.08, -2.0), vec3(0.0, 3.08, 6.0), 0.06), M_WOOD);
  // Trestle table with a stained sheet.
  vec3 tq = p - vec3(0.2, 0.0, 3.0);
  U(d, m, sdBox(tq - vec3(0.0, 0.86, 0.0), vec3(1.25, 0.04, 0.5)), M_WOOD);
  vec3 lq = vec3(abs(tq.x) - 1.0, tq.y - 0.42, tq.z);
  lq.xy = rot(0.0) * lq.xy;
  U(d, m, min(sdCap(lq, vec3(0.0, 0.42, 0.0), vec3(-0.2, -0.42, 0.4), 0.04), sdCap(lq, vec3(0.0, 0.42, 0.0), vec3(0.2, -0.42, -0.4), 0.04)), M_WOOD);
  U(d, m, sdRBox(tq - vec3(-0.1, 0.92, 0.0), vec3(0.95, 0.025, 0.5), 0.02) - 0.01 * sin(tq.x * 12.0), M_LINEN);
  // Lantern hanging from the ridge.
  vec3 lnq = p - vec3(0.1, 2.05 + sin(u_time * 0.8) * 0.02, 2.7);
  float lan = max(sdBox(lnq, vec3(0.1, 0.14, 0.1)), -sdBox(lnq, vec3(0.08, 0.12, 0.2)));
  lan = min(lan, sdCap(lnq, vec3(0.0, 0.14, 0.0), vec3(0.0, 1.0, 0.0), 0.012));
  lan = min(lan, sdCyl(lnq - vec3(0.0, 0.17, 0.0), 0.08, 0.03));
  U(d, m, lan, M_IRON);
  // Saw rack on the right wall.
  vec3 rq = p - vec3(2.35, 1.5, 3.8);
  U(d, m, sdBox(rq, vec3(0.04, 0.06, 0.9)), M_WOOD);
  for (int k = 0; k < 3; k++) {
    vec3 sq = rq - vec3(-0.05, -0.32, -0.55 + float(k) * 0.55);
    float blade = sdBox(sq, vec3(0.01, 0.26, 0.1 - sq.y * 0.12));
    U(d, m, blade, M_IRON);
    U(d, m, sdBox(sq - vec3(-0.02, 0.3, 0.0), vec3(0.03, 0.06, 0.12)), M_WOOD);
  }
  // A bucket.
  U(d, m, max(sdCyl(p - vec3(-1.5, 0.22, 3.6), 0.22, 0.22), -sdCyl(p - vec3(-1.5, 0.3, 3.6), 0.19, 0.22)), M_WOOD);
  return d;
}
vec3 beyond(vec3 rd) { return vec3(0.05, 0.04, 0.03); }
#endif

#if KIND == 13
// Ruined abbey choir loft: a roofless nave, broken walls, the great east window open to the moon.
const int NL = 3;
const int NSH = 1;
vec3 lightPos(int i) { return i == 0 ? vec3(-2.5, 1.35, 4.0) : i == 1 ? vec3(2.5, 1.35, 7.0) : vec3(0.0, 1.0, 10.8); }
vec3 lightCol(int i) { return vec3(1.0, 0.6, 0.3) * (i == 2 ? 0.8 : 1.0); }
#define EXPOSURE 1.45
#define MOON_K 1.1
#define MOON_DIR normalize(vec3(0.12, 0.42, 1.0))
bool isFlame(int i) { return true; }
vec3 camPos() { return vec3(sin(u_time * 0.1) * 0.3, 3.8, -3.0); }
vec3 camTarget() { return vec3(0.0, 2.9, 12.0); }
float map(vec3 p, out float m) {
  float d = p.y; m = M_FLOOR;
  float top = 3.6 + 2.8 * fbm3(vec2(p.z * 0.3, sign(p.x) * 3.0)) - 1.6 * smoothstep(0.55, 0.8, noise(vec2(p.z * 0.5, sign(p.x) + 4.0)));
  float side = max(abs(p.x) - 4.3, 3.8 - abs(p.x));
  side = max(side, p.y - top);
  float wz = mod(p.z, 3.0) - 1.5;
  float win = min(max(abs(wz) - 0.45, abs(p.y - 2.5) - 1.0), length(vec2(wz, p.y - 3.5)) - 0.45);
  side = max(side, -win);
  U(d, m, side, M_STONE);
  vec3 q = vec3(abs(p.x) - 3.7, p.y, mod(p.z, 3.0) - 0.0);
  q.z = mod(p.z, 3.0) - 3.0 * step(1.5, mod(p.z, 3.0));
  U(d, m, max(sdBox(q, vec3(0.3, 6.0, 0.3)), p.y - top - 0.5), M_PILLAR);
  float east = sdBox(p - vec3(0.0, 4.0, 13.0), vec3(4.4, 4.0, 0.4));
  float gw = min(sdBox(vec3(p.x, p.y - 3.1, 0.0), vec3(1.7, 2.1, 1.0)), length(p.xy - vec2(0.0, 5.2)) - 1.7);
  east = max(east, -gw);
  east = max(east, p.y - (7.4 - abs(p.x) * 0.75) - 1.0 * noise(p.xy * 0.8));
  U(d, m, east, M_STONE);
  float tr = max(sdBox(vec3(p.x, p.y - 3.0, p.z - 13.0), vec3(0.08, 2.2, 0.12)), p.y - 4.5 - 0.4 * noise(p.xy * 3.0));
  tr = min(tr, max(sdTorus((p - vec3(0.0, 5.2, 13.0)).xzy, 1.1, 0.08), p.x - 0.3));
  U(d, m, tr, M_STONE);
  vec3 sq = vec3(abs(p.x) - 2.9, p.y, mod(p.z, 1.1) - 0.55);
  if (p.z > 1.0 && p.z < 9.5) {
    float st = sdBox(sq - vec3(0.0, 0.5, 0.0), vec3(0.3, 0.05, 0.45));
    st = min(st, sdBox(sq - vec3(0.32, 1.1, 0.0), vec3(0.04, 1.1, 0.5)));
    st = min(st, sdBox(sq - vec3(0.0, 0.25, 0.47), vec3(0.3, 0.25, 0.03)));
    st = max(st, p.y - 1.6 - 0.6 * noise(vec2(p.z * 2.0, sign(p.x)))); // broken backs
    U(d, m, st, M_WOOD);
  }
  float rub = p.y - 0.55 * smoothstep(0.55, 0.9, fbm3(p.xz * 0.6)) - 0.2 * noise(p.xz * 4.0);
  U(d, m, rub, M_STONE);
  vec3 bq = p - vec3(1.2, 0.3, 8.5);
  bq.xz = rot(0.5) * bq.xz;
  U(d, m, sdRBox(bq, vec3(0.5, 0.3, 0.35), 0.05), M_STONE);
  return d;
}
vec3 beyond(vec3 rd) {
  vec3 sky = mix(vec3(0.1, 0.12, 0.22), vec3(0.02, 0.025, 0.06), smoothstep(0.0, 0.8, rd.y));
  if (u_light > 1.5) sky = mix(vec3(0.7, 0.6, 0.5), vec3(0.35, 0.45, 0.65), smoothstep(-0.1, 0.7, rd.y));
  else if (u_light > 0.5) sky = mix(vec3(0.75, 0.38, 0.16), vec3(0.14, 0.12, 0.25), smoothstep(-0.1, 0.6, rd.y));
  vec2 sp = vec2(atan(rd.x, rd.z) * 1.2 + 0.5, rd.y * 1.2 + 0.3);
  sky += starfield(sp, u_light < 0.5 ? 1.0 : 0.0);
  float cl = fbm(sp * vec2(3.0, 8.0) + vec2(u_time * 0.01, 0.0));
  sky = mix(sky, vec3(0.2, 0.22, 0.3), smoothstep(0.55, 0.85, cl) * 0.5);
  float md = length(rd - MOON_DIR);
  sky += vec3(0.5, 0.55, 0.7) * 0.05 / (md * md * 30.0 + 0.05);
  sky = mix(sky, vec3(0.9, 0.9, 0.95) * (0.8 + 0.2 * fbm(rd.xy * 60.0)), rsmooth(0.05, 0.045, md));
  return sky;
}
#endif

// ------------------------------------------------------------------ shared interior renderer
float mapD(vec3 p) { float m; return map(p, m); }
vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  float e = 0.003;
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

vec2 planar(vec3 p, vec3 n) { vec3 a = abs(n); return a.x > a.y && a.x > a.z ? p.zy : a.z > a.y ? p.xy : p.xz; }
vec3 albedo(vec3 p, vec3 n, float m, out float spec) {
  spec = 0.05;
  vec2 pw = planar(p, n);
  vec3 alb = vec3(0.32, 0.28, 0.24);
  if (m == M_FLOOR) {
    vec2 g = p.xz * 0.9;
    vec2 cell = fract(g) - 0.5;
    float grout = smoothstep(0.46, 0.5, max(abs(cell.x), abs(cell.y)));
    alb = mix(vec3(0.26, 0.23, 0.2), vec3(0.34, 0.3, 0.26), hash(floor(g))) * (0.7 + 0.5 * fbm(p.xz * 3.0));
    alb *= 1.0 - grout * 0.7;
    spec = 0.15 * (1.0 - grout);
#if KIND == 2
    alb = mix(alb, vec3(0.05, 0.02, 0.02), rsmooth(0.12, 0.05, abs(p.x)) * step(p.y, 0.001)); // the gutter
    alb = mix(alb, vec3(0.2, 0.03, 0.02), smoothstep(0.62, 0.75, fbm(p.xz * 1.5)) * 0.6);
#endif
  } else if (m == M_STONE || m == M_PILLAR || m == M_VAULT) {
    vec2 w = m == M_PILLAR ? vec2(atan(p.z, p.x) * 2.0, p.y * 2.2) : vec2(p.x * 1.1 + (m == M_VAULT ? p.z : p.z * step(0.7, abs(n.x))), p.y * 2.2);
    w.x += floor(w.y) * 0.5;
    vec2 c = fract(w) - 0.5;
    float mortar = smoothstep(0.44, 0.5, max(abs(c.x), abs(c.y)));
    alb = vec3(0.36, 0.32, 0.27) * (0.65 + 0.5 * fbm(pw * 2.5)) * (0.85 + 0.3 * hash(floor(w)));
    alb *= 1.0 - mortar * 0.6;
    alb = mix(alb, vec3(0.12, 0.14, 0.1), smoothstep(0.55, 0.8, fbm(pw * 0.6)) * 0.5);
#if KIND == 13
    alb = mix(alb, vec3(0.1, 0.16, 0.07), smoothstep(0.5, 0.75, fbm(pw * 1.2)) * smoothstep(1.5, 4.0, p.y)); // ivy
#endif
#if KIND == 0
    if (u_variant > 0.5) alb *= mix(1.0, 0.25, smoothstep(0.3, 0.7, fbm(p.xy * 0.5 + p.z * 0.3)) * smoothstep(0.5, 3.5, p.y)); // soot
#endif
  } else if (m == M_WOOD) {
    alb = vec3(0.2, 0.11, 0.06) * (0.7 + 0.45 * noise(vec2(pw.x * 3.0, pw.y * 40.0))) * (0.85 + 0.3 * noise(pw * 60.0));
    spec = 0.1;
  } else if (m == M_LINEN) {
    alb = vec3(0.78, 0.74, 0.66) * (0.85 + 0.15 * noise(p.xz * 40.0));
#if KIND == 9 || KIND == 2
    alb *= KIND == 2 ? 0.55 : 0.8;
    alb = mix(alb, vec3(0.4, 0.04, 0.03), smoothstep(0.55, 0.7, fbm(p.xz * 3.0 + 1.0)) * 0.85);
#endif
  } else if (m == M_GLASS) {
    float h = hash(floor(p.xy * 2.5) + floor(p.z));
#if KIND == 0
    alb = vec3(0.08, 0.14, 0.1);
    alb *= 1.0 - 0.7 * smoothstep(0.55, 0.6, noise(p.xy * vec2(22.0, 9.0) + u_time * 0.2)); // leeches drifting
#else
    alb = mix(vec3(0.1, 0.25, 0.12), mix(vec3(0.35, 0.12, 0.05), vec3(0.1, 0.12, 0.3), step(0.5, h)), step(0.33, h));
#endif
    spec = 1.0;
  } else if (m == M_WAX) {
    alb = vec3(0.85, 0.8, 0.65); spec = 0.2;
  } else if (m == M_BRASS || m == M_GILT) {
    alb = m == M_GILT ? vec3(0.9, 0.66, 0.25) : vec3(0.7, 0.5, 0.22);
    spec = 1.0;
  } else if (m == M_CANVAS) {
    alb = vec3(0.58, 0.52, 0.4) * (0.88 + 0.12 * noise(pw * 90.0)) * (1.0 - 0.35 * step(0.96, fract(p.z * 0.8)));
    alb = mix(alb, vec3(0.34, 0.28, 0.18), smoothstep(0.62, 0.8, fbm(pw * 1.5)) * 0.35);
  } else if (m == M_STRAW) {
    float s = noise(vec2(p.x * 40.0 + p.z * 13.0, p.z * 40.0 - p.x * 9.0));
    alb = mix(vec3(0.42, 0.34, 0.16), vec3(0.62, 0.5, 0.25), s) * (0.6 + 0.5 * fbm(p.xz * 2.0));
    alb = mix(alb, vec3(0.25, 0.03, 0.02), smoothstep(0.62, 0.72, fbm(p.xz * 1.3 + 4.0)) * 0.85);
  } else if (m == M_PLASTER) {
    alb = vec3(0.48, 0.42, 0.34) * (0.86 + 0.18 * fbm(pw * 3.0));
    alb = mix(alb, vec3(0.3, 0.26, 0.2), smoothstep(0.62, 0.85, fbm(pw * 0.8 + 3.0)) * 0.3);
#if KIND == 7
    // Half-timbering: posts, storey rails, braces; small leaded windows, a few lit.
    float zz = p.z * 0.62, yy = p.y;
    float post = rsmooth(0.06, 0.035, 0.5 - abs(fract(zz) - 0.5));
    float rail = rsmooth(0.05, 0.025, 0.5 - abs(fract(yy / 2.0 + 0.1) - 0.5));
    vec2 bq = vec2(fract(zz), fract(yy / 2.0 + 0.1));
    float brace = rsmooth(0.05, 0.02, abs(bq.x - bq.y)) * step(0.5, hash(floor(vec2(zz, yy / 2.0 + 0.1)) + sign(p.x)));
    float beam = clamp(post + rail + brace, 0.0, 1.0);
    alb = mix(alb * vec3(1.05, 0.95, 0.8), vec3(0.07, 0.045, 0.03), beam);
    vec2 wg = vec2(zz * 2.0, yy / 2.0 + 0.1);
    vec2 wf = vec2(fract(wg.x), fract(wg.y)) - vec2(0.5, 0.55);
    float win = step(abs(wf.x), 0.18) * step(abs(wf.y), 0.14) * step(1.5, yy) * step(0.4, hash(floor(wg) + sign(p.x) * 3.0));
    float lit = step(0.6, hash(floor(wg) + 7.0 + sign(p.x)));
    float lead = rsmooth(0.12, 0.05, 0.5 - max(abs(fract(wf.x * 22.0) - 0.5), abs(fract(wf.y * 22.0) - 0.5)));
    alb = mix(alb, mix(vec3(0.02), vec3(1.0, 0.6, 0.25) * 3.0 * flick(hash(floor(wg)) * 20.0), lit) * (1.0 - 0.6 * lead), win);
    if (p.z > 21.0) alb = vec3(0.2);
#endif
  } else if (m == M_HERB) {
    alb = mix(vec3(0.16, 0.22, 0.08), vec3(0.42, 0.36, 0.16), noise(vec2(atan(p.z - 2.2, mod(p.x + 0.25, 0.5) - 0.25) * 4.0, p.y * 60.0)));
  } else if (m == M_IRON) {
    alb = vec3(0.12, 0.11, 0.1); spec = 0.5;
  } else if (m == M_FRAME) {
    alb = vec3(0.55, 0.38, 0.14) * (0.8 + 0.3 * noise(p.xy * 30.0)); spec = 0.7;
  } else if (m == M_CLOTH + 10.0) {
    alb = vec3(0.45, 0.4, 0.36);
  } else if (m == M_CLOTH) {
#if KIND == 7
    alb = vec3(0.04, 0.04, 0.045); spec = 0.4; // the physician's waxed coat
#else
    alb = vec3(0.5, 0.06, 0.08) * (0.8 + 0.2 * noise(p.xz * 30.0));
    alb = mix(alb, vec3(0.8, 0.62, 0.2), step(0.92, fract(p.x * 3.0)));
#endif
  }
#if KIND == 8
  if (m == M_PAPER) alb = anatomyChart(vec2(p.x / 1.05, (p.y - 2.9) / 1.45));
  if (m == M_PAPER + 20.0) {
    vec2 u = abs(n.x) > 0.5 ? vec2((mod(p.z, 2.6) - 1.3) / 0.44, (p.y - 2.8) / 0.62) : vec2((abs(p.x) - 2.6) / 0.52, (p.y - 2.9) / 0.7);
    float seed = abs(n.x) > 0.5 ? floor(p.z / 2.6) + sign(p.x) * 5.0 : sign(p.x);
    alb = portraitPaint(u * vec2(0.6, 0.9), seed);
    spec = 0.3;
  }
#endif
  return alb;
}

vec3 flameAt(vec3 ro, vec3 rd, float t, bool hit, vec3 col) {
  for (int i = 0; i < NL; i++) {
    if (!isFlame(i)) continue;
    vec3 lp = lightPos(i) + vec3(0.0, 0.1, 0.0);
    vec3 w = lp - ro;
    float along = dot(w, rd);
    if (along < 0.0 || (hit && along > t + 0.15)) continue;
    vec3 perp = w - rd * along;
    float dd = length(perp);
    float fl = flick(float(i) * 3.1);
    vec3 lc = lightCol(i);
    col += lc * 0.006 * fl / (dd * dd + 0.004);
    // Teardrop flame: taller than wide, licking upward.
    vec2 fp = vec2(dot(perp, normalize(cross(rd, vec3(0.0, 1.0, 0.0)))), perp.y);
    float shape = length(fp * vec2(1.0, 0.55) - vec2(sin(u_time * 7.0 + float(i)) * 0.004, 0.012)) - 0.02;
    col += vec3(1.0, 0.8, 0.45) * rsmooth(0.012, 0.0, shape) * 2.2 * fl;
  }
  return col;
}

#ifndef FOG_K
#define FOG_K 0.028
#endif
#ifndef FOG_COL
#define FOG_COL vec3(0.05, 0.04, 0.045)
#endif
#ifndef EXPOSURE
#define EXPOSURE 1.25
#endif
#ifndef MOON_K
#define MOON_K 0.45
#endif
vec3 interior(vec2 uv) {
  vec3 ro = camPos() + vec3(u_parallax.x * 0.3, u_parallax.y * 0.15, 0.0);
  vec3 ta = camTarget();
  vec3 f = normalize(ta - ro), r = normalize(cross(vec3(0, 1, 0), f)), up = cross(f, r);
  vec3 rd = normalize(uv.x * r + uv.y * up + 1.35 * f);
  float t = 0.0, m = 0.0;
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t;
    float d = map(p, m);
    if (d < 0.002 * (1.0 + t * 0.05)) { hit = true; break; }
    t += d * 0.9;
    if (t > 40.0) break;
  }
  bool day = u_light > 1.5;
  bool dusk = u_light > 0.5 && !day;
  vec3 skyCol = day ? vec3(1.0, 0.92, 0.78) : dusk ? vec3(1.0, 0.55, 0.28) : vec3(0.35, 0.42, 0.7);
  vec3 col = beyond(rd);
  vec3 p = ro + rd * t;
  if (hit) {
    vec3 n = calcNormal(p);
    float spec;
    vec3 alb = albedo(p, n, m, spec);
    float ao = 0.0;
    for (int k = 1; k <= 4; k++) { float hk = 0.06 * float(k); ao += (hk - mapD(p + n * hk)) / hk; }
    ao = clamp(1.0 - ao * 0.18, 0.25, 1.0);
    vec3 amb = day ? vec3(0.24, 0.23, 0.21) : dusk ? vec3(0.12, 0.1, 0.1) : vec3(0.085, 0.09, 0.12);
    col = alb * amb * ao;
    for (int i = 0; i < NL; i++) {
      vec3 lp = lightPos(i);
      vec3 l = lp - p;
      float dist2 = dot(l, l);
      vec3 ld = l / sqrt(dist2);
      float diff = max(dot(n, ld), 0.0);
      float sh = 1.0;
      if (i < NSH && diff > 0.0) {
        float st = 0.04 + 0.06 * hash(p.xy * 91.7 + p.z * 13.1 + float(i));
        for (int k = 0; k < 20; k++) {
          float h = mapD(p + n * 0.01 + ld * st);
          sh = min(sh, 8.0 * h / st);
          st += clamp(h, 0.03, 0.35);
          if (st > sqrt(dist2) - 0.2 || sh < 0.02) break;
        }
        sh = clamp(sh, 0.0, 1.0);
      }
      vec3 lc = lightCol(i) * flick(float(i) * 3.1);
      col += alb * lc * diff * sh * 7.0 / (1.0 + dist2 * 0.35);
      vec3 hv = normalize(ld - rd);
      col += lc * pow(max(dot(n, hv), 0.0), 40.0) * spec * sh * 3.0 / (1.0 + dist2 * 0.35);
    }
    // Window light from outside: moon, low dusk sun, or bright day.
#ifdef MOON_DIR
    vec3 mdir = MOON_DIR;
#else
    vec3 mdir = normalize(vec3(-0.3, day ? 0.75 : dusk ? 0.3 : 0.55, -1.0));
#endif
    float md = max(dot(n, mdir), 0.0);
    float wsh = 1.0;
    if (day || dusk) {
      float st = 0.06 + 0.08 * hash(p.zy * 57.3 + p.x * 7.7);
      for (int k = 0; k < 18; k++) {
        float h = mapD(p + n * 0.02 + mdir * st);
        wsh = min(wsh, 6.0 * h / st);
        st += clamp(h, 0.05, 0.6);
        if (wsh < 0.02 || st > 12.0) break;
      }
      wsh = clamp(wsh, 0.0, 1.0);
    }
#if KIND == 3
    skyCol = vec3(0.3, 0.14, 0.45);
#endif
    col += alb * skyCol * md * wsh * (day ? 1.3 : dusk ? 0.8 : MOON_K);
#if KIND == 9
    // Canvas glows with the day behind it.
    if (m == M_CANVAS) col += alb * skyCol * (day ? 0.22 : dusk ? 0.1 : 0.02) * (0.8 + 0.2 * noise(p.xz * 4.0));
#endif
    col = mix(col, FOG_COL * (day ? 3.0 : 1.0), 1.0 - exp(-t * FOG_K));
  }
#if KIND == 3
  if (!hit || (hit && p.z > 12.0)) {
    vec3 wp = ro + rd * ((11.95 - ro.z) / rd.z);
    col = windowGlass(wp.xy) * (1.3 + 0.2 * sin(u_time * 0.5));
  }
#endif
  // Volumetric shafts through the arches / window and floating motes.
  float vol = 0.0;
  vec3 volCol = skyCol;
  for (int i = 0; i < 20; i++) {
    float s = (float(i) + hash(uv * 100.0 + u_time)) / 20.0 * min(t, 14.0);
    vec3 q = ro + rd * s;
    float shaft = 0.0;
#if KIND == 3
    vec2 sp = q.xy + vec2(q.z - 12.0) * vec2(0.0, -0.45);
    float rr = length(sp - vec2(0.0, 4.4));
    shaft = rsmooth(2.1, 1.6, rr);
    volCol = mix(volCol, windowGlass(sp) * 1.4, 0.8 * shaft);
#elif KIND == 0 || KIND == 13
    vec2 sp = q.xy + vec2(q.z - 9.0) * vec2(0.35, day ? -0.75 : -0.55);
    shaft = rsmooth(0.9, 0.3, abs(mod(sp.x + 2.0, 4.0) - 2.0)) * smoothstep(0.2, 2.0, sp.y) * step(sp.y, 5.0);
#elif KIND == 6 || KIND == 8
    vec2 sp = q.zy + vec2(q.x + 3.6) * vec2(0.3, -0.6);
    shaft = rsmooth(0.6, 0.2, abs(sp.x - 2.5)) * smoothstep(0.5, 1.5, sp.y) * step(sp.y, 3.0);
#elif KIND == 9
    shaft = rsmooth(0.5, 0.0, abs(q.x - 0.1)) * rsmooth(0.9, 0.1, abs(q.z - 2.7)) * step(q.y, 2.1) * 0.3;
#endif
    vol += shaft * (0.35 + 0.65 * fbm3(q.xz * 0.8 + vec2(u_time * 0.05, 0.0)));
  }
  float volK = day ? 0.3 : dusk ? 0.2 : 0.1;
#if KIND == 3
  volK = 0.3;
#endif
  col += volCol * vol / 20.0 * volK;
  col = flameAt(ro, rd, t, hit, col);
  return col * EXPOSURE;
}
#endif

// ================================================================== exteriors (layered paintings)
#ifndef INTERIOR
float PX;
// Sky for the lighting variant: night, dusk or day.
vec3 skyGrad(vec2 sp) {
  float y = sp.y;
  vec3 night = mix(vec3(0.11, 0.13, 0.22), vec3(0.015, 0.02, 0.05), smoothstep(0.3, 1.0, y));
  vec3 dusk = mix(vec3(0.85, 0.42, 0.18), mix(vec3(0.35, 0.18, 0.28), vec3(0.06, 0.06, 0.14), smoothstep(0.55, 1.0, y)), smoothstep(0.2, 0.6, y));
  vec3 day = mix(vec3(0.85, 0.84, 0.78), vec3(0.5, 0.62, 0.8), smoothstep(0.2, 1.0, y));
  return u_light > 1.5 ? day : u_light > 0.5 ? dusk : night;
}
vec3 clouds(vec2 sp, vec3 col, float amt) {
  float cl = fbm(vec2(sp.x * 3.0 + u_time * 0.01, sp.y * 8.0));
  vec3 cc = u_light > 1.5 ? vec3(0.85, 0.84, 0.8) : u_light > 0.5 ? vec3(0.55, 0.28, 0.25) : vec3(0.08, 0.08, 0.12);
  return mix(col, cc, smoothstep(0.55, 0.8, cl) * smoothstep(0.4, 0.9, sp.y) * 0.7 * amt);
}
// Atmospheric haze toward the sky colour with depth.
vec3 haze(vec3 c, vec2 sp, float depth) { return mix(c, skyGrad(vec2(sp.x, 0.3)) * 0.8, depth); }
float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }

// Dusk/night/day tint for lit surfaces.
vec3 sunTint() { return u_light > 1.5 ? vec3(1.0, 0.97, 0.9) : u_light > 0.5 ? vec3(0.95, 0.62, 0.42) : vec3(0.22, 0.26, 0.4); }

// A leaded casement: returns the colour; lit fills it with candlelight.
vec3 casement(vec2 w, vec3 col, float lit, float seed) {
  float frame = sd2Box(w, vec2(0.5, 0.5));
  if (frame > 0.06) return col;
  vec3 glass = mix(vec3(0.03, 0.03, 0.04) + skyGrad(vec2(0.5, 0.7)) * 0.15, vec3(1.0, 0.6, 0.25) * 1.5 * flick(seed * 20.0), lit);
  vec2 lg = fract(w * vec2(4.0, 5.0)) - 0.5;
  float lead = rsmooth(0.1, 0.04, 0.5 - max(abs(lg.x), abs(lg.y)));
  glass *= 1.0 - lead * 0.6;
  col = mix(col, vec3(0.06, 0.04, 0.03), step(frame, 0.06));
  return mix(col, glass, step(frame, 0.0));
}

// A timber-framed, gable-fronted house. q: x across 0..1, y up from the ground, in house widths.
// Returns colour and coverage (a = 0 outside the silhouette).
vec4 house(vec2 q, float id, float eaves) {
  float peak = eaves + 0.62 * (1.0 - abs(q.x - 0.5) * 2.0);
  if (q.y < 0.0 || q.y > peak + 0.03) return vec4(0.0);
  float h1 = hash1(id * 3.7);
  vec3 plaster = h1 < 0.25 ? vec3(0.8, 0.7, 0.5) : h1 < 0.5 ? vec3(0.84, 0.8, 0.7) : h1 < 0.75 ? vec3(0.74, 0.57, 0.5) : vec3(0.62, 0.64, 0.52);
  plaster *= 0.8 + 0.25 * fbm(q * vec2(20.0, 30.0) + id);
  vec3 timber = vec3(0.09, 0.055, 0.035);
  vec3 col = plaster;
  if (q.y < 0.45) {
    // Ground floor: stone, an arched door, a shuttered shop window.
    vec2 sg = q * vec2(10.0, 14.0);
    sg.x += floor(sg.y) * 0.5;
    col = vec3(0.42, 0.38, 0.34) * (0.7 + 0.35 * hash(floor(sg))) * (1.0 - 0.35 * rsmooth(0.1, 0.05, 0.5 - max(abs(fract(sg.x) - 0.5), abs(fract(sg.y) - 0.5))));
    float dx = 0.22 + 0.5 * step(0.5, hash1(id * 1.3));
    float door = min(sd2Box(q - vec2(dx, 0.14), vec2(0.08, 0.14)), length(q - vec2(dx, 0.28)) - 0.08);
    col = mix(col, vec3(0.1, 0.06, 0.035) * (0.8 + 0.3 * step(0.5, fract(q.x * 40.0))), step(door, 0.0));
    col = mix(col, vec3(0.05), rsmooth(0.012, 0.0, abs(door)));
    vec2 sw = (q - vec2(1.0 - dx, 0.22)) / vec2(0.12, 0.1);
    col = casement(sw, col, step(0.4, hash1(id * 5.1)), id);
    // Awning over the shop.
    float awn = sd2Tri(q, vec2(1.0 - dx - 0.17, 0.36), vec2(1.0 - dx + 0.17, 0.36), vec2(1.0 - dx, 0.4));
    col = mix(col, vec3(0.45, 0.12, 0.08) * (0.8 + 0.3 * step(0.5, fract(q.x * 16.0))), step(awn, 0.0));
  } else {
    // Timbered storeys: posts, rails at each floor, braces, windows between.
    float nPosts = 3.0 + floor(h1 * 2.0);
    float px = q.x * nPosts;
    float fy = (q.y - 0.45) / 0.42;
    float post = rsmooth(0.045, 0.025, 0.5 - abs(fract(px) - 0.5)) + rsmooth(0.03, 0.015, min(q.x, 1.0 - q.x));
    float rail = rsmooth(0.07, 0.04, 0.5 - abs(fract(fy) - 0.5));
    vec2 pq = vec2(fract(px), fract(fy));
    vec2 pid = floor(vec2(px, fy));
    float hp = hash(pid + id * 1.7);
    float brace = 0.0;
    if (hp > 0.55) brace = rsmooth(0.07, 0.03, abs(pq.x - pq.y)) + rsmooth(0.07, 0.03, abs(pq.x - (1.0 - pq.y)));
    else if (hp > 0.35) brace = rsmooth(0.07, 0.03, abs(pq.x * 0.5 - pq.y + 0.0)) * step(pq.x, 1.0);
    float beam = clamp(post + rail + brace, 0.0, 1.0);
    col = mix(col, timber * (0.8 + 0.4 * noise(q * 90.0)), beam);
    if (hp < 0.35 && q.y < eaves) col = casement((pq - vec2(0.5, 0.5)) / vec2(0.3, 0.28), col, step(0.55, hash(pid + id)), id + pid.x);
    // Jetty: each storey overhangs, throwing a shadow band beneath it.
    col *= 1.0 - 0.35 * rsmooth(0.08, 0.0, fract(fy)) * step(1.0, fy);
    // Gable: king post, collar beam, a small attic window.
    if (q.y > eaves) {
      vec2 gq = q - vec2(0.5, eaves);
      col = mix(plaster, timber, max(rsmooth(0.02, 0.01, abs(gq.x)), rsmooth(0.02, 0.01, abs(gq.y - 0.2))));
      col = casement((gq - vec2(0.0, 0.36)) / vec2(0.07, 0.06), col, step(0.7, h1), id + 9.0);
    }
    // Bargeboards along the gable slopes.
    col = mix(col, timber * 0.7, rsmooth(0.035, 0.02, peak - q.y));
  }
  float a = clamp((peak + 0.005 - q.y) / 0.006, 0.0, 1.0);
  return vec4(col, a);
}

vec3 exterior(vec2 uv, vec2 sp) {
  PX = 1.5 / u_view.y;
  vec2 par = u_parallax * 0.02;
  vec3 col = skyGrad(sp);
  float night = u_light < 0.5 ? 1.0 : 0.0;
  float y = sp.y;

#if KIND == 1
  // Kessendorf, Tanners' Rows at dusk: gable-fronted houses round a square, a gibbet on the hill
  // seen down the lane, guild signs swinging, a gutter across the cobbles.
  col += starfield(sp, night);
  col = clouds(sp, col, 1.0);
  vec2 sunp = vec2(0.2, 0.52);
  if (u_light > 0.5 && u_light < 1.5) col += vec3(1.0, 0.5, 0.2) * 0.35 * rsmooth(0.5, 0.0, length((sp - sunp) * vec2(1.0, 1.8)));
  if (night > 0.5) col = moon(sp, vec2(0.8, 0.84), col);
  // Far skyline, the cathedral spire and the gallows hill.
  vec2 fp = sp + par * 0.3;
  float far = gables(fp.x, 3.0, 0.56, 0.05, 0.04);
  float hill = 0.52 + 0.08 * exp(-pow((fp.x - 0.78) / 0.07, 2.0));
  float spire = min(sd2Tri(fp, vec2(0.36, 0.6), vec2(0.4, 0.6), vec2(0.38, 0.9)), sd2Box(fp - vec2(0.38, 0.56), vec2(0.03, 0.06)));
  vec3 farCol = haze(vec3(0.1, 0.07, 0.08), sp, 0.5);
  col = mix(col, farCol, max(max(fill(fp.y - far, PX), fill(spire, PX)), fill(fp.y - hill, PX)));
  vec2 gp = fp - vec2(0.78, 0.6);
  float gib = min(sd2Box(gp - vec2(0.0, 0.06), vec2(0.003, 0.06)), sd2Box(gp - vec2(-0.02, 0.118), vec2(0.024, 0.003)));
  float sw = sin(u_time * 0.7) * 0.006;
  gib = min(gib, sd2Seg(gp, vec2(-0.04, 0.118), vec2(-0.04 + sw, 0.095)) - 0.0012);
  gib = min(gib, sd2Box(gp - vec2(-0.04 + sw, 0.08), vec2(0.008, 0.016)));
  col = mix(col, vec3(0.03, 0.02, 0.02), fill(gib, PX));
  // The row of houses (a lane opens at the fourth plot).
  const float GROUND = 0.34;
  const float HW = 0.19;
  vec2 hp = sp + par * 0.6;
  float hx = hp.x / HW + 0.3;
  float id = floor(hx);
  float eaves = 1.05 + 0.4 * hash1(id * 1.7);
  vec4 hs = abs(id - 4.0) < 0.5 ? vec4(0.0) : house(vec2(fract(hx), (hp.y - GROUND) / HW), id, eaves);
  vec3 lit = sunTint() * (u_light > 0.5 ? 0.9 : 0.45);
  lit *= 0.75 + 0.35 * smoothstep(1.0, 0.0, fract(hx)); // raking light from the left
  hs.rgb *= lit;
  col = mix(col, haze(hs.rgb, sp, 0.1), hs.a);
  // Side walls of the lane, in shadow.
  if (abs(id - 4.0) < 0.5 && hp.y > GROUND && hp.y < GROUND + 0.28) col = mix(col, vec3(0.05, 0.04, 0.04), step(abs(fract(hx) - 0.5), 0.5) * step(0.38, abs(fract(hx) - 0.5)));
  // Pigeons on a ridge, bobbing.
  for (int k = 0; k < 3; k++) {
    float bx = 1.3 + float(k) * 0.08;
    float ridge = (0.3 + 0.62) ;
    float bob = step(0.75, fract(u_time * 0.35 + float(k) * 0.37)) * 0.02;
    vec2 q = (vec2(hx, (hp.y - GROUND) / HW) - vec2(bx, 1.05 + 0.4 * hash1(1.7) + 0.62 * (1.0 - abs(bx - 1.5) * 2.0) + 0.03 + bob)) * vec2(1.0, 1.3);
    col = mix(col, vec3(0.06, 0.05, 0.06), fill(length(q) - 0.025, PX / HW) + fill(length(q - vec2(0.025, 0.02)) - 0.014, PX / HW));
  }
  // Guild signs on iron brackets: a boot, shears, a pretzel.
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 anchor = vec2(k == 0 ? 0.13 : k == 1 ? 0.52 : 0.9, GROUND + HW * (0.62 + 0.05 * fk));
    float ang = sin(u_time * (0.9 + fk * 0.2) + fk) * 0.1;
    vec2 q = rot(ang) * (hp - anchor) / 0.05;
    float br = min(sd2Box((hp - anchor) / 0.05 - vec2(0.0, 0.08), vec2(0.8, 0.05)), sd2Seg((hp - anchor) / 0.05, vec2(-0.8, 0.08), vec2(-0.2, -0.3)) - 0.04);
    float board = sd2Box(q - vec2(0.0, -0.7), vec2(0.6, 0.45));
    float emblem;
    if (k == 0) emblem = min(sd2Box(q - vec2(-0.1, -0.6), vec2(0.13, 0.25)), sd2Box(q - vec2(0.08, -0.82), vec2(0.3, 0.1)));
    else if (k == 1) emblem = min(sd2Seg(q, vec2(-0.3, -1.0), vec2(0.3, -0.4)), sd2Seg(q, vec2(0.3, -1.0), vec2(-0.3, -0.4))) - 0.05;
    else emblem = min(abs(length(q - vec2(-0.14, -0.72)) - 0.18) - 0.05, abs(length(q - vec2(0.14, -0.72)) - 0.18) - 0.05);
    float chains = min(sd2Seg(q, vec2(-0.45, 0.08), vec2(-0.45, -0.26)), sd2Seg(q, vec2(0.45, 0.08), vec2(0.45, -0.26))) - 0.025;
    float px2 = PX / 0.05;
    col = mix(col, vec3(0.03), fill(min(br, chains), px2));
    col = mix(col, vec3(0.2, 0.12, 0.06) * lit * 1.4, fill(board, px2));
    col = mix(col, vec3(0.85, 0.66, 0.28) * lit * 1.3, fill(emblem, px2) * fill(board, px2));
    col = mix(col, vec3(0.04), fill(abs(board) - 0.04, px2));
  }
  // The square: cobbles in perspective, a gutter channel, puddles holding the sky.
  vec2 np = sp + par;
  if (np.y < GROUND) {
    float z = 1.0 / (GROUND + 0.02 - np.y);
    vec2 cg = vec2((np.x - 0.5) * z * 2.2, z * 0.9);
    cg.x += floor(cg.y) * 0.5;
    vec2 cf = fract(cg) - 0.5;
    float stone = 1.0 - smoothstep(0.28, 0.5, length(cf));
    col = vec3(0.16, 0.14, 0.13) * lit * (0.5 + 0.8 * stone * (0.7 + 0.4 * hash(floor(cg))));
    float gut = rsmooth(0.018 + (GROUND - np.y) * 0.12, 0.0, abs(np.x - 0.62 + (GROUND - np.y) * 0.5));
    float puddle = smoothstep(0.6, 0.7, fbm(vec2(cg.x * 0.3, cg.y * 0.3)));
    col = mix(col, skyGrad(vec2(np.x, 0.5 + (GROUND - np.y) * 2.0)) * 0.7, clamp(gut + puddle, 0.0, 1.0) * 0.8);
  }
  // Near frame: an eave overhang in the top-left corner.
  vec2 ep = sp + par * 1.4;
  float eave = ep.y - (1.02 - (0.24 - ep.x) * 0.35);
  if (ep.x < 0.24) {
    col = mix(col, vec3(0.04, 0.03, 0.025), fill(-eave, PX));
    col = mix(col, vec3(0.08, 0.05, 0.035), fill(abs(eave) - 0.006, PX));
  }
  col = mix(col, skyGrad(vec2(sp.x, 0.2)) * 0.7, fogBank(sp, GROUND + 0.02, 0.06, 0.01, 2.0) * 0.35);
  col += vec3(1.0, 0.7, 0.4) * motes(sp, 0.04) * 0.3;
#endif

#if KIND == 4 || KIND == 15
  // Kessendorf by night: moonlit, snow-dusted roofs, the clock and bell tower, the town wall
  // with a torchlit watch walking it. The title (15) re-frames the same city under the Malison's eye.
  col += starfield(sp, 1.0);
#if KIND == 15
  vec2 mpos = vec2(0.85, 0.84);
  vec2 e = (sp - mpos) * vec2(1.78, 1.0) * 1.35;
  float er = length(e);
  // A vortex of storm cloud lit violet from within.
  vec2 sw = rot(er * 5.0 - u_time * 0.08) * e;
  float swirl = fbm(sw * 5.0 + 3.0);
  col = mix(col, vec3(0.28, 0.1, 0.42) * (0.6 + 0.9 * swirl), smoothstep(0.3, 0.75, swirl) * rsmooth(0.75, 0.05, er));
  col += vec3(0.35, 0.12, 0.55) * 0.06 / (er * er * 4.0 + 0.05);
  float open = smoothstep(0.1, 0.6, 0.5 + 0.5 * sin(u_time * 0.628));
  float lidH = 0.07 * open;
  float almond = abs(e.y) - lidH * sqrt(max(0.0, 1.0 - pow(e.x / 0.2, 2.0)));
  almond = max(almond, abs(e.x) - 0.2);
  vec2 ip = e - vec2(sin(u_time * 0.25) * 0.03, 0.0);
  float iris = length(ip) - 0.055;
  vec3 sclera = mix(vec3(0.62, 0.5, 0.48), vec3(0.3, 0.08, 0.1), smoothstep(0.02, 0.2, length(e * vec2(1.0, 2.5))));
  sclera *= 1.0 - 0.5 * rsmooth(0.08, 0.0, abs(noise(e * 40.0) - 0.5));
  vec3 irisCol = mix(vec3(0.9, 0.55, 1.0), vec3(0.35, 0.08, 0.6), smoothstep(0.0, 0.055, length(ip))) * (0.7 + 0.5 * noise(vec2(atan(ip.y, ip.x) * 5.0, length(ip) * 60.0)));
  vec3 eyeCol = mix(sclera, irisCol * 1.4, step(iris, 0.0));
  eyeCol = mix(eyeCol, vec3(0.01), step(abs(ip.x) - 0.01 * (1.0 - abs(ip.y) / 0.055), 0.0) * step(iris, 0.0)); // slit pupil
  col = mix(col, eyeCol, fill(almond, PX));
  col = mix(col, vec3(0.02, 0.0, 0.03), fill(abs(almond) - 0.004, PX) * 0.8);
  col += vec3(0.6, 0.25, 1.0) * 0.05 / (abs(almond) * 25.0 + 0.2) * (0.3 + open);
#else
  col = moon(sp, vec2(0.8, 0.8), col);
#endif
  // Moonlit cloud edges.
  float cl = fbm(vec2(sp.x * 3.0 + u_time * 0.01, sp.y * 8.0));
  col = mix(col, vec3(0.14, 0.15, 0.22), smoothstep(0.55, 0.8, cl) * smoothstep(0.45, 0.95, sp.y) * 0.8);
  // Far skyline with a scatter of lit windows, the cathedral.
  vec2 fp = sp + par * 0.3;
  float far = gables(fp.x, 5.0, 0.47, 0.05, 0.035);
  float cath = min(sd2Box(fp - vec2(0.6, 0.5), vec2(0.07, 0.07)), sd2Tri(fp, vec2(0.52, 0.57), vec2(0.68, 0.57), vec2(0.6, 0.63)));
  cath = min(cath, min(sd2Box(fp - vec2(0.64, 0.6), vec2(0.012, 0.09)), sd2Tri(fp, vec2(0.625, 0.69), vec2(0.655, 0.69), vec2(0.64, 0.8))));
  float farM = max(fill(fp.y - far, PX), fill(cath, PX));
  vec3 farCol = vec3(0.045, 0.045, 0.07);
  vec2 wg = floor(fp * vec2(240.0, 160.0));
  farCol += vec3(1.0, 0.55, 0.2) * step(0.985, hash(wg)) * step(fp.y, far - 0.01) * flick(hash(wg) * 30.0);
  col = mix(col, farCol, farM);
  // The clock and bell tower: courses, a pale clock face, lit belfry, a spire.
  vec2 tp = fp - vec2(KIND == 15 ? 0.13 : 0.26, 0.0);
  float tower = sd2Box(tp - vec2(0.0, 0.55), vec2(0.04, 0.2));
  tower = min(tower, sd2Box(tp - vec2(0.0, 0.76), vec2(0.048, 0.008)));
  tower = min(tower, sd2Tri(tp, vec2(-0.045, 0.77), vec2(0.045, 0.77), vec2(0.0, 0.95)));
  vec3 tc = vec3(0.06, 0.06, 0.08) * (1.0 - 0.3 * step(0.9, fract(tp.y * 90.0)));
  tc += vec3(0.25, 0.28, 0.4) * 0.15 * smoothstep(0.0, 0.04, tp.x);
  col = mix(col, tc, fill(tower, PX));
  float clockD = length((tp - vec2(0.0, 0.62)) * vec2(1.78, 1.0)) - 0.035;
  col = mix(col, vec3(0.75, 0.68, 0.5) * 0.7, fill(clockD, PX));
  vec2 cq = (tp - vec2(0.0, 0.62)) * vec2(1.78, 1.0);
  float hands = min(sd2Seg(cq, vec2(0.0), vec2(0.0, 0.025)), sd2Seg(cq, vec2(0.0), rot(u_time * 0.02) * vec2(0.018, 0.0))) - 0.002;
  col = mix(col, vec3(0.05), fill(hands, PX) * fill(clockD, PX));
  float louvre = sd2Box(vec2(abs(tp.x) - 0.018, tp.y - 0.705), vec2(0.009, 0.03));
  col = mix(col, vec3(1.0, 0.6, 0.25) * flick(3.0) * 0.9, fill(louvre, PX));
  // Town wall with crenellations; the watch walks it with torches and halberds.
  vec2 wp = sp + par * 0.6;
  float wallTop = 0.43 - 0.012 * step(0.5, fract(wp.x * 55.0));
  if (wp.y < wallTop) {
    vec2 sg = wp * vec2(90.0, 120.0);
    sg.x += floor(sg.y) * 0.5;
    col = vec3(0.07, 0.07, 0.09) * (0.7 + 0.4 * hash(floor(sg))) + vec3(0.2, 0.22, 0.32) * 0.1 * smoothstep(wallTop - 0.03, wallTop, wp.y);
  }
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float x = fract(0.08 + fk * 0.07 + u_time * 0.01);
    vec2 q = (wp - vec2(x, 0.43)) / 0.045;
    float fig = figure(q, u_time * 5.0 + fk);
    fig = min(fig, sd2Seg(q, vec2(0.25, 0.1), vec2(0.32, 1.45)) - 0.03);
    fig = min(fig, sd2Tri(q, vec2(0.22, 1.35), vec2(0.45, 1.4), vec2(0.34, 1.6)));
    col = mix(col, vec3(0.01), fill(fig, PX / 0.045));
    vec2 tq2 = q - vec2(-0.3, 1.05);
    float fl = flick(fk * 7.0);
    col += vec3(1.0, 0.5, 0.18) * 0.03 * fl / (dot(tq2 * vec2(0.6, 1.0), tq2 * vec2(0.6, 1.0)) * 0.12 + 0.03);
    col += vec3(1.0, 0.8, 0.4) * rsmooth(0.15, 0.0, length(tq2 * vec2(1.0, 0.6))) * fl;
  }
  // Rooftops below: snow on the tiles, chimneys smoking, dormers lit.
  vec2 rp = sp + par;
  float ridgeX = fract(rp.x * 1.8);
  float roofH = 0.36 + 0.06 * (1.0 - abs(ridgeX - 0.5) * 2.0) + 0.02 * hash1(floor(rp.x * 1.8));
  if (rp.y < roofH) {
    vec2 tq = vec2(rp.x * 140.0 + floor(rp.y * 100.0) * 0.5, rp.y * 100.0);
    vec3 tile = vec3(0.06, 0.045, 0.045) * (0.7 + 0.4 * hash(floor(tq))) * (1.0 - 0.5 * step(0.85, fract(tq.y)));
    float snowy = smoothstep(0.5, 0.75, fbm(rp * vec2(40.0, 60.0))) * smoothstep(roofH - 0.06, roofH, rp.y) + smoothstep(roofH - 0.012, roofH, rp.y);
    tile = mix(tile, vec3(0.5, 0.55, 0.7) * (KIND == 15 ? 0.6 : 0.9), clamp(snowy, 0.0, 1.0) * 0.8);
    vec2 dg = vec2(fract(rp.x * 5.4) - 0.5, rp.y - roofH + 0.05);
    float dormer = sd2Box(dg, vec2(0.05, 0.02));
    tile = mix(tile, vec3(1.0, 0.58, 0.22) * flick(floor(rp.x * 5.4)) * 1.2, fill(dormer, PX) * step(0.55, hash1(floor(rp.x * 5.4) * 3.0)));
    col = tile;
  }
  vec2 chq = vec2(fract(rp.x * 1.8 + 0.3) - 0.5, rp.y - roofH);
  float chim = sd2Box(chq - vec2(0.0, 0.02), vec2(0.018, 0.04));
  col = mix(col, vec3(0.05, 0.04, 0.04), fill(chim, PX) * step(rp.y, roofH + 0.07));
  vec2 smk = vec2(chq.x - (chq.y - 0.06) * 0.5, chq.y - 0.06);
  float smoke = fbm(vec2(smk.x * 25.0, smk.y * 8.0 - u_time * 0.4)) * rsmooth(0.03 + smk.y * 0.35, 0.0, abs(smk.x)) * step(0.0, smk.y) * rsmooth(0.35, 0.0, smk.y);
  col = mix(col, vec3(0.22, 0.22, 0.28), smoke * 0.5);
  if (u_variant > 0.5) col = rain(sp, col, 1.0); else col = snow(sp, col, 1.0);
#if KIND == 15
  col += vec3(1.0, 0.55, 0.3) * motes(sp + vec2(0.0, u_time * 0.01), 0.1) * 0.7;
  // Slow key-art drift of the whole city (10 s breathing loop).
  col *= 0.92 + 0.08 * sin(u_time * 0.628);
#endif
  col = mix(col, vec3(0.14, 0.14, 0.2), fogBank(sp, 0.38, 0.06, 0.012, 1.0) * 0.35);
#endif

#if KIND == 5
  // The war camp: a Bruegel panorama of tents, pike stands, cook fires and camp followers.
  if (night > 0.5) { col += starfield(sp, 1.0); col = moon(sp, vec2(0.2, 0.84), col); }
  col = clouds(sp, col, 0.9);
  if (u_light > 0.5 && u_light < 1.5) col += vec3(1.0, 0.45, 0.2) * 0.3 * rsmooth(0.6, 0.0, length((sp - vec2(0.75, 0.48)) * vec2(1.0, 2.2)));
  vec3 lit = sunTint();
  for (int l = 0; l < 3; l++) {
    float fl2 = float(l);
    vec2 hp = sp + par * (0.2 + fl2 * 0.25);
    float h = 0.56 - fl2 * 0.06 + 0.05 * fbm(vec2(hp.x * (3.0 + fl2 * 2.0) + fl2 * 3.0, fl2));
    vec3 hc = vec3(0.2, 0.2, 0.14) * lit * (0.5 + fl2 * 0.25);
    col = mix(col, haze(hc, sp, 0.5 - fl2 * 0.2), fill(hp.y - h, PX));
  }
  // Rows of tents (ridge tents and striped bell tents with pennants), far to near.
  for (int r = 0; r < 3; r++) {
    float fr = float(r);
    float scale = 0.035 + fr * 0.025;
    float base = 0.49 - fr * 0.055;
    vec2 tp = sp + par * (0.5 + fr * 0.25);
    float cellW = scale * 2.7;
    float id = floor(tp.x / cellW + fr * 3.3);
    float cx = (id - fr * 3.3 + 0.5) * cellW + (hash1(id + fr) - 0.5) * cellW * 0.35;
    vec2 q = (tp - vec2(cx, base)) / scale;
    float kind = hash1(id * 3.7 + fr);
    float tent = kind < 0.5 ? sd2Tri(q, vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.1)) : min(sd2Box(q - vec2(0.0, 0.35), vec2(0.7, 0.35)), sd2Tri(q, vec2(-0.85, 0.68), vec2(0.85, 0.68), vec2(0.0, 1.35)));
    vec3 cloth = mix(vec3(0.75, 0.68, 0.52), vec3(0.62, 0.14, 0.1), step(0.5, fract(q.x * 2.0)) * step(0.5, kind));
    if (kind > 0.8) cloth = mix(vec3(0.75, 0.68, 0.52), vec3(0.2, 0.25, 0.45), step(0.5, fract(q.x * 2.0)));
    cloth *= lit * (0.65 + 0.45 * smoothstep(-0.6, 0.6, -q.x));
    if (night > 0.5) cloth += vec3(1.0, 0.5, 0.2) * 0.15 * step(0.6, hash1(id));
    float door = sd2Tri(q, vec2(-0.18, 0.0), vec2(0.18, 0.0), vec2(0.0, 0.5));
    cloth = mix(cloth, vec3(0.04, 0.03, 0.02), step(door, 0.0));
    col = mix(col, haze(cloth, sp, 0.35 - fr * 0.12), fill(tent * scale, PX));
    col = mix(col, vec3(0.05), fill(abs(tent * scale) - 0.0008, PX) * 0.6);
    vec2 pq = q - vec2(0.0, kind < 0.5 ? 1.1 : 1.35);
    float pole = sd2Box(pq - vec2(0.0, 0.2), vec2(0.03, 0.2));
    vec2 fq = pq - vec2(0.0, 0.35);
    fq.y -= sin(fq.x * 8.0 - u_time * 6.0 + id) * 0.05 * fq.x;
    float flag = sd2Tri(fq, vec2(0.0, -0.09), vec2(0.0, 0.09), vec2(0.5, 0.0));
    col = mix(col, vec3(0.05), fill(pole * scale, PX));
    col = mix(col, (hash1(id * 9.0) > 0.5 ? vec3(0.7, 0.12, 0.08) : vec3(0.85, 0.7, 0.2)) * lit, fill(flag * scale, PX) * step(0.4, kind));
    vec2 kq = q - vec2(1.4, 0.0);
    float pikes = 1e5;
    for (int k = 0; k < 5; k++) pikes = min(pikes, sd2Seg(kq, vec2(-0.35 + float(k) * 0.17, 0.0), vec2(-0.08 + float(k) * 0.05, 2.6)) - 0.028);
    pikes = min(pikes, sd2Seg(kq, vec2(-0.45, 0.9), vec2(0.45, 0.9)) - 0.03);
    col = mix(col, vec3(0.05, 0.035, 0.025), fill(pikes * scale, PX) * step(0.6, hash1(id * 1.3)));
  }
  // Cook fires with smoke, and camp followers going between them.
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    vec2 fpos = vec2(0.14 + fk * 0.24 + 0.04 * sin(fk * 3.0), 0.345 + 0.015 * sin(fk * 5.0));
    vec2 q = (sp + par - fpos) * vec2(1.78, 1.0);
    float fl = flick(fk * 5.0);
    col += vec3(1.0, 0.45, 0.15) * 0.02 * fl / (dot(q, q) * 6.0 + 0.012) * (1.0 - 0.6 * step(1.5, u_light));
    float flame = rsmooth(0.02, 0.0, length(q * vec2(1.3, 0.65) - vec2(0.0, 0.014)) - 0.014 * fbm(vec2(q.x * 80.0, q.y * 40.0 - u_time * 4.0)));
    col += vec3(1.0, 0.6, 0.2) * flame * 2.0 * fl;
    float smoke = fbm(vec2(q.x * 10.0 + sin(q.y * 6.0 + u_time * 0.3) * 0.5, q.y * 4.0 - u_time * 0.35)) * smoothstep(0.01, 0.3, q.y) * rsmooth(0.05 + q.y * 0.35, 0.0, abs(q.x - q.y * 0.3));
    col = mix(col, u_light > 1.5 ? vec3(0.65, 0.65, 0.65) : vec3(0.22, 0.18, 0.18), smoothstep(0.45, 0.85, smoke) * 0.55);
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float x = fpos.x + (fract(u_time * 0.008 * (fj + 1.0) + fk * 0.3 + fj * 0.33) - 0.5) * 0.2;
      vec2 fq = (sp + par - vec2(x, fpos.y - 0.012 - fj * 0.01)) / 0.042;
      col = mix(col, vec3(0.04, 0.03, 0.025), fill(figure(fq, u_time * 4.0 + fk + fj), PX / 0.042));
    }
  }
  if (sp.y < 0.34) col = mix(col, vec3(0.1, 0.075, 0.05) * lit * (0.6 + 0.6 * fbm(sp * vec2(40.0, 10.0))), smoothstep(0.34, 0.31, sp.y));
  col = mix(col, skyGrad(vec2(sp.x, 0.3)), fogBank(sp, 0.45, 0.05, 0.008, 3.0) * 0.25);
#endif

#if KIND == 10
  // Graveyard at the camp's edge: tilted stones, a lychgate, a dead tree, fog.
  col += starfield(sp, night);
  col = moon(sp, vec2(0.72, 0.8), col);
  float cl = fbm(vec2(sp.x * 3.0 + u_time * 0.01, sp.y * 8.0));
  col = mix(col, vec3(0.14, 0.15, 0.22), smoothstep(0.55, 0.8, cl) * smoothstep(0.45, 0.95, sp.y) * 0.8);
  vec2 tp = sp + par * 0.4 - vec2(0.16, 0.42);
  float tree = sd2Seg(tp, vec2(0.0, 0.0), vec2(0.012, 0.36)) - 0.01 * (1.0 - tp.y * 2.0);
  tree = min(tree, sd2Seg(tp, vec2(0.006, 0.2), vec2(0.1, 0.34)) - 0.004);
  tree = min(tree, sd2Seg(tp, vec2(0.009, 0.27), vec2(-0.07, 0.4)) - 0.003);
  tree = min(tree, sd2Seg(tp, vec2(0.06, 0.28), vec2(0.08, 0.4)) - 0.002);
  tree = min(tree, sd2Seg(tp, vec2(-0.04, 0.34), vec2(-0.05, 0.42)) - 0.0015);
  col = mix(col, vec3(0.02, 0.02, 0.03), fill(tree, PX));
  for (int l = 2; l >= 0; l--) {
    float fl2 = float(l);
    vec2 gp = sp + par * (0.3 + fl2 * 0.35);
    float g = 0.46 - fl2 * 0.06 + 0.02 * sin(gp.x * 7.0 + fl2);
    vec3 gc = vec3(0.07, 0.085, 0.085) * (1.0 + fl2 * 0.5) * (0.8 + 0.3 * fbm(gp * 30.0));
    col = mix(col, gc, fill(gp.y - g, PX));
    float w = 0.1 + fl2 * 0.05;
    float id = floor(gp.x / w + fl2 * 7.0);
    float cx = (id - fl2 * 7.0 + 0.5) * w;
    float sc = 0.05 + fl2 * 0.03;
    vec2 q = (gp - vec2(cx, g - 0.005)) / sc;
    q = rot((hash1(id) - 0.5) * 0.5) * q;
    float stone = min(sd2Box(q - vec2(0.0, 0.5), vec2(0.35, 0.5)), length(q - vec2(0.0, 1.0)) - 0.35);
    float cross2 = min(sd2Box(q - vec2(0.0, 0.7), vec2(0.07, 0.7)), sd2Box(q - vec2(0.0, 1.05), vec2(0.3, 0.07)));
    float s = hash1(id * 2.1) > 0.7 ? cross2 : stone;
    vec3 stc = vec3(0.26, 0.26, 0.28) * (0.8 + 0.4 * fbm(q * 5.0)) * (1.0 - fl2 * 0.25);
    stc += vec3(0.3, 0.33, 0.45) * 0.2 * smoothstep(-0.3, 0.4, q.x);
    stc = mix(stc, vec3(0.08, 0.12, 0.06), smoothstep(0.6, 0.8, fbm(q * 3.0 + id)) * 0.6); // lichen
    col = mix(col, stc, fill(s * sc, PX) * step(0.3, hash1(id * 5.3)));
  }
  vec2 lp = sp + par * 0.9 - vec2(0.8, 0.34);
  float gate = min(sd2Box(vec2(abs(lp.x) - 0.08, lp.y - 0.09), vec2(0.009, 0.09)), sd2Tri(lp, vec2(-0.13, 0.18), vec2(0.13, 0.18), vec2(0.0, 0.27)));
  gate = min(gate, min(sd2Box(lp - vec2(0.0, 0.23), vec2(0.004, 0.05)), sd2Box(lp - vec2(0.0, 0.3), vec2(0.03, 0.004))));
  col = mix(col, vec3(0.03, 0.025, 0.02), fill(gate, PX));
  col = mix(col, vec3(0.06, 0.07, 0.09) * (0.8 + 0.3 * step(0.5, fract(lp.x * 60.0))), fill(sd2Tri(lp, vec2(-0.12, 0.185), vec2(0.12, 0.185), vec2(0.0, 0.26)), PX) * 0.6);
  col = mix(col, vec3(0.34, 0.36, 0.42), fogBank(sp, 0.36, 0.1, 0.02, 1.0) * 0.55);
  col = mix(col, vec3(0.28, 0.3, 0.36), fogBank(sp + vec2(0.3, 0.0), 0.44, 0.08, -0.012, 4.0) * 0.35);
  if (u_variant > 0.5) col = rain(sp, col, 0.8);
#endif

#if KIND == 11
  // Dwarf prospectors' camp: a cliff and a timbered adit, rails, an ore cart glinting black-violet.
  col = clouds(sp, col, 0.7);
  col += starfield(sp, night);
  if (u_light > 0.5 && u_light < 1.5) col += vec3(1.0, 0.45, 0.2) * 0.3 * rsmooth(0.6, 0.0, length((sp - vec2(0.15, 0.5)) * vec2(1.0, 2.2)));
  vec3 lit = sunTint();
  vec2 cp = sp + par * 0.5;
  float ridge = 1.0 - abs(noise(vec2(cp.x * 14.0, 2.0)) * 2.0 - 1.0);
  float cliff = 0.6 + 0.26 * smoothstep(0.2, 0.55, cp.x) - 0.3 * smoothstep(0.8, 1.0, cp.x) + 0.05 * fbm(vec2(cp.x * 6.0, 1.0)) + 0.035 * ridge;
  float crack = rsmooth(0.012, 0.0, abs(noise(vec2(cp.x * 22.0, cp.y * 3.0)) - 0.5)) * step(0.5, noise(vec2(cp.x * 5.0, cp.y * 5.0)));
  vec3 rock = vec3(0.34, 0.27, 0.21) * (0.65 + 0.5 * fbm(cp * vec2(10.0, 16.0)));
  rock *= 1.0 - 0.3 * crack;
  rock *= 0.6 + 0.6 * smoothstep(0.0, 0.2, cliff - cp.y) * (0.5 + 0.5 * noise(vec2(cp.x * 9.0, cp.y * 2.0)));
  rock *= lit;
  col = mix(col, rock, fill(cp.y - cliff, PX));
  col = mix(col, rock * 1.6 + 0.04, fill(abs(cp.y - cliff) - 0.003, PX) * 0.6);
  vec2 ad = cp - vec2(0.55, 0.38);
  float mouth = min(sd2Box(ad - vec2(0.0, 0.07), vec2(0.07, 0.07)), length((ad - vec2(0.0, 0.14)) * vec2(1.0, 1.4)) - 0.07);
  col = mix(col, vec3(0.005), fill(mouth, PX));
  float timber = min(sd2Box(vec2(abs(ad.x) - 0.075, ad.y - 0.09), vec2(0.01, 0.09)), sd2Box(ad - vec2(0.0, 0.185), vec2(0.1, 0.012)));
  col = mix(col, vec3(0.3, 0.2, 0.1) * lit, fill(timber, PX));
  float frame = min(sd2Seg(ad, vec2(-0.12, 0.19), vec2(0.0, 0.34)), sd2Seg(ad, vec2(0.12, 0.19), vec2(0.0, 0.34))) - 0.006;
  float wheel = abs(length((ad - vec2(0.0, 0.33)) * vec2(1.78, 1.0) / 1.78) - 0.025) - 0.004;
  float rope = sd2Seg(ad, vec2(0.024, 0.33), vec2(0.024, 0.16)) - 0.0015;
  col = mix(col, vec3(0.24, 0.15, 0.08) * lit, fill(min(min(frame, wheel), rope), PX));
  vec2 rp = sp + par;
  if (rp.y < 0.39) {
    float z = 1.0 / max(0.42 - rp.y, 0.01);
    col = vec3(0.1, 0.08, 0.06) * lit * (0.6 + 0.5 * fbm(vec2(rp.x * z, z) * 0.5));
    float rx = (rp.x - 0.55) * z * 0.18;
    float rails = rsmooth(0.03, 0.0, abs(abs(rx) - 0.12));
    float sleeper = step(0.7, fract(z * 0.5)) * step(abs(rx), 0.2);
    col = mix(col, vec3(0.2, 0.13, 0.07) * lit, sleeper * 0.8);
    col = mix(col, vec3(0.6, 0.6, 0.62) * lit, rails);
  }
  vec2 oq = (rp - vec2(0.64, 0.3)) / 0.08;
  float cart = max(sd2Tri(oq, vec2(-0.8, 0.9), vec2(0.8, 0.9), vec2(0.0, -2.0)), 0.25 - oq.y);
  cart = min(cart, min(abs(length(oq - vec2(-0.45, 0.2)) - 0.18) - 0.06, abs(length(oq - vec2(0.45, 0.2)) - 0.18) - 0.06));
  col = mix(col, vec3(0.18, 0.13, 0.09) * lit, fill(cart, PX / 0.08));
  for (int k = 0; k < 5; k++) {
    vec2 lq = oq - vec2(-0.5 + float(k) * 0.25, 0.95 + 0.06 * sin(float(k) * 2.0));
    float glint = 0.5 + 0.5 * sin(u_time * 2.0 + float(k));
    col = mix(col, vec3(0.06, 0.03, 0.08), fill(length(lq) - 0.16, PX / 0.08));
    col += vec3(0.55, 0.2, 0.9) * rsmooth(0.3, 0.0, length(lq)) * 0.3 * glint;
  }
  for (int k = 0; k < 2; k++) {
    vec2 tq = (rp - vec2(k == 0 ? 0.13 : 0.9, 0.36)) / 0.1;
    float tent = sd2Tri(tq, vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 0.9));
    col = mix(col, vec3(0.45, 0.33, 0.2) * lit, fill(tent, PX / 0.1));
    col = mix(col, vec3(0.03), fill(sd2Tri(tq, vec2(-0.2, 0.0), vec2(0.2, 0.0), vec2(0.0, 0.5)), PX / 0.1));
    vec2 lq = (rp - vec2(k == 0 ? 0.3 : 0.76, 0.45)) / 0.02;
    float fl = flick(float(k) * 4.0);
    col += vec3(1.0, 0.6, 0.25) * 0.05 * fl / (dot(lq, lq) * 0.01 + 0.05);
    col = mix(col, vec3(1.0, 0.8, 0.45), fill(length(lq) - 0.5, PX / 0.02) * fl);
  }
  // Picks leaning on a barrel by the adit.
  vec2 bq = (rp - vec2(0.43, 0.36)) / 0.04;
  float barrel = sd2Box(bq - vec2(0.0, 0.5), vec2(0.4 + 0.05 * sin(bq.y * 3.0), 0.5));
  float pick = min(sd2Seg(bq, vec2(0.4, 0.0), vec2(0.9, 1.6)) - 0.05, sd2Seg(bq, vec2(0.6, 1.7), vec2(1.2, 1.4)) - 0.06);
  col = mix(col, vec3(0.2, 0.12, 0.06) * lit, fill(barrel, PX / 0.04));
  col = mix(col, vec3(0.08), fill(pick, PX / 0.04));
  col = mix(col, skyGrad(vec2(sp.x, 0.3)) * 0.7, fogBank(sp, 0.36, 0.05, 0.01, 7.0) * 0.3);
#endif

#if KIND == 12
  // Forest edge: trunks in the mist, brood webs strung between them, egg sacs pulsing.
  col = mix(col, vec3(0.06, 0.09, 0.08), 0.5);
  col = moon(sp, vec2(0.62, 0.86), col);
  for (int l = 3; l >= 0; l--) {
    float fl2 = float(l);
    vec2 fp = sp + par * (0.2 + (3.0 - fl2) * 0.3);
    float w = 0.13 - fl2 * 0.02;
    float id = floor(fp.x / w + fl2 * 4.0);
    float cx = (id - fl2 * 4.0 + 0.5) * w + (hash1(id) - 0.5) * w * 0.6;
    float tw = (0.012 + 0.02 * hash1(id * 1.7)) * (1.7 - fl2 * 0.32) * (1.0 + 0.4 * smoothstep(0.45, 0.25, fp.y));
    float trunk = abs(fp.x - cx + 0.004 * sin(fp.y * 20.0 + id)) - tw;
    trunk = max(trunk, 0.28 + fl2 * 0.05 - fp.y);
    vec3 bark = vec3(0.11, 0.11, 0.09) * (0.7 + 0.5 * noise(vec2((fp.x - cx) * 300.0, fp.y * 20.0))) * (1.0 + fl2 * 0.5);
    bark += vec3(0.2, 0.25, 0.3) * 0.15 * smoothstep(-tw, tw, fp.x - cx);
    col = mix(col, mix(bark, vec3(0.12, 0.16, 0.15), fl2 * 0.22), fill(trunk, PX));
    col = mix(col, vec3(0.14, 0.18, 0.17), fogBank(sp, 0.42 - fl2 * 0.04, 0.15, 0.01 * (fl2 + 1.0), fl2) * 0.18);
  }
  for (int k = 0; k < 2; k++) {
    vec2 c = k == 0 ? vec2(0.6, 0.66) : vec2(0.86, 0.52);
    vec2 wq = (sp + par * 0.8 - c) * vec2(1.78, 1.0);
    float r = length(wq), a = atan(wq.y, wq.x);
    float R = k == 0 ? 0.22 : 0.15;
    float spokes = abs(fract(a / 6.2832 * 14.0) - 0.5) * r * 0.45;
    float spiral = abs(fract(r * 40.0 - a / 6.2832) - 0.5) / 40.0;
    float web = min(spokes, spiral) - 0.0009;
    col += vec3(0.75, 0.8, 0.85) * fill(web, PX) * rsmooth(R, R * 0.6, r) * 0.5;
  }
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    vec2 c = vec2(0.5 + fk * 0.065 + 0.02 * sin(fk * 3.0), 0.6 - 0.05 * mod(fk, 3.0));
    float pulse = 1.0 + 0.06 * sin(u_time * 2.5 + fk * 1.7);
    vec2 eq = (sp + par * 0.8 - c) * vec2(1.78, 1.0) / (0.026 * pulse);
    float sac = length(eq * vec2(1.0, 0.8)) - 1.0;
    vec3 sc = vec3(0.78, 0.75, 0.58) * (0.45 + 0.55 * smoothstep(1.0, -1.0, eq.x + eq.y));
    sc = mix(sc, vec3(0.22, 0.16, 0.08), rsmooth(0.45, 0.2, length(eq - vec2(0.1, -0.1) + 0.05 * sin(u_time + fk))));
    col = mix(col, sc, fill(sac * 0.026, PX) * 0.9);
    col += vec3(1.0) * rsmooth(0.2, 0.0, length(eq - vec2(-0.4, 0.4))) * 0.35 * fill(sac * 0.026, PX);
    col = mix(col, vec3(0.6, 0.62, 0.6), fill(sd2Seg(sp + par * 0.8, c + vec2(0.0, 0.02), c + vec2(0.0, 0.14)) - 0.0006, PX) * 0.4);
  }
  float shaft = rsmooth(0.035, 0.0, abs(fract((sp.x + sp.y * 0.45) * 4.0 + 0.3) - 0.5) * 0.25) * smoothstep(0.3, 0.9, sp.y) * (0.5 + 0.5 * fbm(sp * 6.0 + u_time * 0.02));
  col += vec3(0.35, 0.45, 0.5) * shaft * 0.12;
  float fern = sp.y - 0.3 - 0.05 * fbm(vec2(sp.x * 30.0, 1.0)) - 0.03 * abs(sin(sp.x * 90.0));
  col = mix(col, vec3(0.04, 0.07, 0.04), fill(fern, PX));
  col = mix(col, vec3(0.17, 0.22, 0.2), fogBank(sp, 0.32, 0.08, 0.015, 9.0) * 0.4);
#endif

#if KIND == 14
  // Dawn over the battlefield: the sun at the horizon with a flare, broken pikes, smoke.
  col = mix(vec3(0.98, 0.66, 0.32), mix(vec3(0.46, 0.32, 0.42), vec3(0.1, 0.12, 0.26), smoothstep(0.6, 1.0, y)), smoothstep(0.42, 0.72, y));
  vec2 sun = vec2(0.6, 0.47);
  vec2 sq = (sp - sun) * vec2(1.78, 1.0);
  float sd = length(sq);
  col = clouds(sp, col, 0.6);
  col += vec3(1.0, 0.75, 0.4) * 0.35 / (sd * sd * 60.0 + 0.4);
  col = mix(col, vec3(1.0, 0.94, 0.75), rsmooth(0.06, 0.055, sd) * step(0.44, sp.y + 0.0));
  for (int l = 0; l < 3; l++) {
    float fl2 = float(l);
    vec2 hp = sp + par * (0.2 + fl2 * 0.3);
    float h = 0.47 - fl2 * 0.05 + 0.04 * fbm(vec2(hp.x * (2.5 + fl2 * 2.0) + fl2 * 4.0, fl2));
    vec3 hc = mix(vec3(0.42, 0.27, 0.24), vec3(0.08, 0.05, 0.06), fl2 / 2.0);
    col = mix(col, hc, fill(hp.y - h, PX));
  }
  vec2 bp = sp + par;
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    vec2 a = vec2(0.06 + fk * 0.12 + 0.03 * sin(fk * 4.0), 0.36 + 0.02 * sin(fk * 2.0));
    float ang = (hash1(fk) - 0.5) * 1.1;
    vec2 b = a + vec2(sin(ang), cos(ang)) * (0.1 + 0.12 * hash1(fk * 3.0));
    col = mix(col, vec3(0.03, 0.02, 0.02), fill(sd2Seg(bp, a, b) - 0.0022, PX));
  }
  vec2 fq = bp - vec2(0.8, 0.45);
  float pole = sd2Seg(bp, vec2(0.79, 0.36), vec2(0.8, 0.5)) - 0.002;
  fq.y -= sin(fq.x * 30.0 - u_time * 3.0) * 0.006 * fq.x * 10.0;
  col = mix(col, vec3(0.03), fill(pole, PX));
  col = mix(col, vec3(0.45, 0.06, 0.05), fill(sd2Box(fq - vec2(0.045, 0.02), vec2(0.045, 0.028)), PX));
  // Crows wheeling.
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    vec2 cc = vec2(0.3 + 0.1 * sin(u_time * 0.2 + fk * 1.7), 0.72 + 0.05 * cos(u_time * 0.25 + fk));
    vec2 q = (sp - cc) / 0.01;
    float wing = abs(q.y - 0.4 * abs(q.x) * sin(u_time * 6.0 + fk)) - 0.15;
    col = mix(col, vec3(0.05), fill(max(wing, abs(q.x) - 1.2) * 0.01, PX));
  }
  col = mix(col, vec3(0.65, 0.48, 0.42), fogBank(sp, 0.38, 0.1, 0.012, 2.0) * 0.45);
  float ang = atan(sq.y, sq.x);
  float rays = pow(0.5 + 0.5 * sin(ang * 18.0 + sin(ang * 5.0) * 2.0), 8.0) * rsmooth(0.7, 0.0, sd);
  col += vec3(1.0, 0.8, 0.5) * rays * 0.18 * smoothstep(0.42, 0.5, sp.y);
  col += vec3(1.0, 0.7, 0.4) * rsmooth(0.012, 0.0, abs(sq.y)) * rsmooth(0.9, 0.0, abs(sq.x)) * 0.35;
  vec2 axis = vec2(0.5, 0.5) - sun;
  for (int k = 1; k <= 3; k++) {
    vec2 gpos = sun + axis * (0.7 * float(k));
    float gd = length((sp - gpos) * vec2(1.78, 1.0));
    col += vec3(0.8, 0.6, 0.9) * rsmooth(0.03 + float(k) * 0.02, 0.0, gd) * 0.06;
  }
#endif
  return col * 1.4;
}
#endif

void main() {
  vec2 sp = v_uv; // 0..1, y up
  vec2 uv = (v_uv - 0.5) * vec2(u_view.x / u_view.y, 1.0);
#ifdef INTERIOR
  vec3 col = interior(uv);
#else
  vec3 col = exterior(uv, sp);
#endif
  // Painterly grain and a soft vignette; filmic roll-off so flames and suns keep their cores.
  col *= 0.95 + 0.1 * noise(v_uv * u_view * 0.5);
  col *= 1.0 - 0.35 * pow(length((v_uv - 0.5) * vec2(1.1, 1.3)), 2.5);
  col = col / (1.0 + col * 0.35);
  o = vec4(col, 1.0);
}`;
