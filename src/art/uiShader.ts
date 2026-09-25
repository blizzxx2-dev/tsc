/**
 * UI_ART_FS: the procedural UI art kit, drawn per rect by `Gfx.ornament()`.
 * Every piece is a 2D signed-distance shape with a height field lit by the candle
 * (top-left), so brass bevels, wax relief, glass and vellum read as materials rather
 * than flat fills. Output is premultiplied alpha.
 *
 * Modes (see src/art/kit.ts for the typed wrappers):
 *  0 parchment (a.x variant 0 fresh / 1 foxed / 2 burnt-edge, a.y torn-edge amount)
 *  1 oak panel with iron straps          2 tooled leather
 *  3 wax seal (a.x press 0..1, a.y cracked, a.z gold leaf, a.w skull impression)
 *  4 ink stamp frame (a.x hit 0..1, a.y round)
 *  5 brass-and-glass tincture gauge (a.x level, a.y crack, a.z pulse)
 *  6 sand-glass (a.x sand remaining)      7 star reliquary (a.x gilt fill, a.y spent, a.z glint, a.w active)
 *  8 tincture vial (a.x fill, a.y corked-empty)    9 brass medallion bezel (col = inset colour)
 * 10 vellum strip with rolled ends       11 instrument-tray pocket (a.x selected, a.y cooldown)
 * 12 torn ribbon scroll (a.x unfurl)     13 engraved brass plaque
 * 14 tally ribbon (a.x count 2..10+)     15 instrument icon (a.x tool 0..7, a.y state, a.z cooldown)
 * 16 brass crosshair (col = context tint)  17 hanging ledger page
 */
export const UI_ART_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform int u_mode;
uniform vec2 u_size;
uniform float u_time;
uniform float u_seed;
uniform float u_rot;
uniform float u_alpha;
uniform vec3 u_col;
uniform vec3 u_col2;
uniform vec4 u_a;
out vec4 o;

const float PI = 3.14159265;
const vec3 LIGHT = normalize(vec3(-0.55, -0.7, 0.62)); // screen y points down
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdRBox(vec2 p, vec2 b, float r) { return sdBox(p, b - r) - r; }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
// Voronoi edge distance, for cracks and hammered metal.
float voroEdge(vec2 p) {
  vec2 g = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 b = vec2(i, j);
    vec2 r = b + vec2(hash(g + b), hash(g + b + 17.0)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}

// Shading helpers.
vec3 envMetal(vec3 base, vec3 n, float rough) {
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float sky = 0.5 + 0.5 * (-r.y);
  vec3 env = mix(vec3(0.08, 0.05, 0.03), vec3(1.0, 0.86, 0.6), smoothstep(0.1, 0.95, sky));
  float dif = max(dot(n, LIGHT), 0.0);
  float sp = pow(max(dot(reflect(-LIGHT, n), vec3(0.0, 0.0, 1.0)), 0.0), mix(60.0, 8.0, rough));
  return base * (0.25 + 0.75 * dif) * mix(vec3(1.0), env * 1.3, 0.55) + base * sp * 1.4 + vec3(1.0, 0.95, 0.8) * sp * 0.25;
}
vec3 diffuse(vec3 alb, vec3 n) { return alb * (0.35 + 0.8 * max(dot(n, LIGHT), 0.0)); }
vec3 glossy(vec3 alb, vec3 n, float power, float k) {
  float sp = pow(max(dot(reflect(-LIGHT, n), vec3(0.0, 0.0, 1.0)), 0.0), power);
  return diffuse(alb, n) + vec3(1.0, 0.92, 0.8) * sp * k;
}
float cover(float d, float aa) { return clamp(0.5 - d / aa, 0.0, 1.0); } // d < 0 inside
const vec3 BRASS = vec3(0.78, 0.58, 0.26);
const vec3 BRASS_LO = vec3(0.36, 0.24, 0.08);
const vec3 GILT = vec3(0.98, 0.8, 0.36);

// ------------------------------------------------------------ 0 parchment
float parchH(vec2 px) { return fbm(px * vec2(0.05, 0.9) + u_seed) * 0.5 + fbm(px * 0.03) * 0.5; }
vec4 parchment(vec2 px, vec2 sz, float aa) {
  float variant = u_a.x, torn = u_a.y;
  float e = min(min(px.x, sz.x - px.x), min(px.y, sz.y - px.y));
  float per = (px.y < 6.0 || px.y > sz.y - 6.0) ? px.x : px.y + 1000.0;
  float rag = ((fbm(vec2(per * 0.045, u_seed)) - 0.5) * 9.0 + (noise(vec2(per * 0.6, u_seed)) - 0.5) * 2.5) * torn;
  float d = e - 3.0 * torn - rag;
  float a = smoothstep(0.0, aa * 1.5, d);
  vec3 base = mix(vec3(0.94, 0.87, 0.71), vec3(0.82, 0.71, 0.52), smoothstep(0.25, 0.8, fbm(px * 0.006 + u_seed)));
  // Fibres and laid lines.
  base *= 0.94 + 0.08 * noise(vec2(px.x * 0.06, px.y * 1.1) + u_seed);
  base *= 1.0 - 0.025 * step(0.85, fract(px.y * 0.09));
  // Tide-mark stains.
  float st = fbm(px * 0.012 + 7.0 + u_seed);
  base = mix(base, base * vec3(0.86, 0.76, 0.6), smoothstep(0.55, 0.62, st) * 0.5);
  base *= 1.0 - 0.12 * rsmooth(0.01, 0.0, abs(st - 0.6));
  // Foxing: rust-brown spots.
  if (variant >= 1.0) {
    vec2 g = floor(px / 38.0);
    vec2 f = fract(px / 38.0) - 0.5 - (vec2(hash(g + u_seed), hash(g + 3.1)) - 0.5) * 0.6;
    float spot = rsmooth(0.12 + 0.2 * hash(g + 9.0), 0.0, length(f)) * step(0.62, hash(g + 5.0));
    base = mix(base, vec3(0.62, 0.4, 0.2), spot * (0.35 + 0.3 * noise(px * 0.3)));
  }
  // Edge darkening; burnt edges char to black through an umber band.
  float burn = variant >= 2.0 ? 1.0 : 0.0;
  base *= mix(0.62, 1.0, smoothstep(0.0, 26.0 + burn * 10.0, d + (fbm(px * 0.05) - 0.5) * 18.0));
  if (burn > 0.0) {
    float c = d + (fbm(px * 0.08 + u_seed) - 0.5) * 14.0;
    base = mix(base, vec3(0.42, 0.22, 0.08), rsmooth(12.0, 4.0, c));
    base = mix(base, vec3(0.06, 0.03, 0.02), rsmooth(5.0, 1.0, c));
  }
  float h0 = parchH(px);
  vec3 n = normalize(vec3(-(parchH(px + vec2(1, 0)) - h0) * 3.0, -(parchH(px + vec2(0, 1)) - h0) * 3.0, 1.0));
  vec3 col = base * (0.9 + 0.18 * max(dot(n, LIGHT), 0.0));
  return vec4(col, a);
}

// ------------------------------------------------------------ 1 oak and iron
float oakH(vec2 px, vec2 sz) {
  float strapY1 = 14.0, strapY2 = sz.y - 14.0;
  float strap = max(rsmooth(8.0, 6.5, abs(px.y - strapY1)), rsmooth(8.0, 6.5, abs(px.y - strapY2)));
  float h = strap * (0.6 + 0.05 * noise(px * 0.4));
  // Rivets along the straps.
  vec2 rp = vec2(mod(px.x - 20.0, 44.0) - 22.0, min(abs(px.y - strapY1), abs(px.y - strapY2)));
  h += 0.5 * rsmooth(3.2, 0.0, length(rp)) * sqrt(max(0.0, 1.0 - dot(rp, rp) / 10.0));
  float plank = fract(px.x / 52.0 + 0.3 * step(0.5, hash(vec2(floor(px.y / 400.0), 1.0))));
  h -= 0.25 * rsmooth(0.03, 0.0, min(plank, 1.0 - plank));
  return h;
}
vec4 oak(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float d = sdRBox(c, sz * 0.5, 5.0);
  float a = cover(d, aa);
  float id = floor(px.x / 52.0);
  float warp = fbm(vec2(px.x * 0.05, px.y * 0.006) + id * 3.0) * 14.0;
  float grain = 0.5 + 0.5 * sin((px.x + warp) * 0.9 + id * 5.0);
  grain = pow(grain, 3.0);
  vec3 wood = mix(vec3(0.2, 0.12, 0.07), vec3(0.3, 0.19, 0.1), 0.5 * grain + 0.4 * noise(vec2(px.x * 0.4, px.y * 0.03) + id));
  wood *= 0.8 + 0.3 * hash(vec2(id, 4.0));
  // Soot: rising from below, worst at the edges.
  float soot = fbm(px * 0.012 + u_seed) * 0.7 + smoothstep(0.4 * sz.y, sz.y, px.y) * 0.3 + rsmooth(40.0, 0.0, -d) * 0.4;
  wood *= 1.0 - 0.55 * smoothstep(0.35, 0.95, soot);
  float h0 = oakH(px, sz);
  vec3 n = normalize(vec3(-(oakH(px + vec2(1, 0), sz) - h0) * 4.0, -(oakH(px + vec2(0, 1), sz) - h0) * 4.0, 1.0));
  vec3 col = diffuse(wood, n);
  float strap = max(rsmooth(8.0, 6.5, abs(px.y - 14.0)), rsmooth(8.0, 6.5, abs(px.y - sz.y + 14.0)));
  if (strap > 0.01) {
    vec3 iron = vec3(0.2, 0.19, 0.19) * (0.8 + 0.4 * noise(px * 0.5)) * (0.9 + 0.2 * smoothstep(0.0, 0.1, voroEdge(px * 0.12)));
    iron = mix(iron, vec3(0.3, 0.15, 0.07), smoothstep(0.6, 0.8, fbm(px * 0.08)) * 0.6); // rust
    col = mix(col, envMetal(iron, n, 0.7), strap);
  }
  // Bevelled edge.
  col *= 1.0 + 0.25 * rsmooth(3.0, 0.0, -d) * (-(c.x + c.y) / length(sz));
  col *= mix(0.6, 1.0, smoothstep(0.0, 6.0, -d));
  return vec4(col, a);
}

// ------------------------------------------------------------ 2 tooled leather
vec4 leather(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float d = sdRBox(c, sz * 0.5, 3.0);
  float a = cover(d, aa);
  float pebble = voroEdge(px * 0.35 + u_seed);
  vec3 alb = mix(vec3(0.26, 0.1, 0.07), vec3(0.14, 0.05, 0.035), smoothstep(0.0, 1.0, px.y / sz.y));
  alb *= 0.85 + 0.25 * smoothstep(0.0, 0.25, pebble);
  alb *= 0.8 + 0.3 * fbm(px * 0.02 + u_seed);
  // Blind-tooled double fillet.
  float f1 = abs(-d - 9.0), f2 = abs(-d - 13.0);
  float tool = rsmooth(0.9, 0.2, min(f1, f2));
  alb *= 1.0 - 0.35 * tool;
  // Saddle stitching.
  float along = abs(c.y) > abs(c.x) - (sz.x - sz.y) * 0.5 ? px.x : px.y;
  float st = rsmooth(1.1, 0.4, abs(-d - 17.0)) * step(0.45, fract(along / 9.0));
  alb = mix(alb, vec3(0.78, 0.66, 0.46), st * 0.55);
  // Worn highlights along the top edge.
  alb += vec3(0.08, 0.04, 0.02) * rsmooth(10.0, 0.0, px.y) * (0.5 + noise(px * 0.1));
  vec3 n = normalize(vec3((noise(px * 0.9) - 0.5) * 0.25, (noise(px * 0.9 + 3.0) - 0.5) * 0.25, 1.0));
  vec3 col = glossy(alb, n, 18.0, 0.08);
  col *= mix(0.55, 1.0, smoothstep(0.0, 22.0, -d));
  return vec4(col, a);
}

// ------------------------------------------------------------ 3 wax seal
float sealR(vec2 c, float r) {
  float ang = atan(c.y, c.x);
  vec2 dir = c / max(length(c), 1e-4);
  return r * (1.0 + 0.06 * sin(ang * 5.0 + u_seed) + 0.04 * sin(ang * 9.0 + u_seed * 2.0) + 0.06 * (noise(dir * 2.5 + u_seed) - 0.5));
}
float skull(vec2 p) { // Holbein death's-head impression, p in -1..1
  float d = length((p - vec2(0.0, -0.12)) * vec2(1.0, 1.1)) - 0.5;
  d = min(d, sdRBox(p - vec2(0.0, 0.35), vec2(0.28, 0.2), 0.08));
  float eyes = min(length(p - vec2(-0.19, -0.1)) - 0.14, length(p - vec2(0.19, -0.1)) - 0.14);
  float nose = sdSeg(p, vec2(0.0, 0.08), vec2(0.0, 0.18)) - 0.05;
  float teeth = abs(fract(p.x * 6.0 + 0.5) - 0.5) - 0.05;
  teeth = max(teeth, abs(p.y - 0.42) - 0.09);
  return max(d, -min(min(eyes, nose), max(teeth, abs(p.x) - 0.24)));
}
float sealH(vec2 c, float r) {
  float rr = sealR(c, r);
  float dist = length(c) / rr;
  float h = smoothstep(1.02, 0.78, dist) * 0.8;
  h += 0.35 * exp(-pow((dist - 0.74) / 0.045, 2.0));            // raised ring
  h -= 0.18 * smoothstep(0.7, 0.6, dist);                         // recessed field
  h += 0.04 * noise(c * 0.3);
  if (u_a.w > 0.5) h -= 0.4 * smoothstep(0.05, -0.05, skull(c / (r * 0.52)));
  if (u_a.y > 0.5) h -= 0.25 * rsmooth(0.06, 0.0, voroEdge(c / r * 2.2 + u_seed)) * smoothstep(0.95, 0.5, dist);
  return h;
}
vec4 waxSeal(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float press = u_a.x;
  // Pressing: a tall blob spreads out, overshoots and settles.
  float spread = mix(0.55, 1.0, smoothstep(0.0, 0.75, press)) * (1.0 + 0.06 * sin(clamp(press, 0.0, 1.0) * PI));
  float r = min(sz.x, sz.y) * 0.4 * spread;
  float rr = sealR(c, r);
  float dist = length(c) / rr;
  // Soft shadow under the seal.
  float shadowD = length(c - vec2(2.0, 4.0)) / (rr * 1.04);
  float sh = rsmooth(1.15, 0.85, shadowD) * 0.5;
  float a = cover((dist - 1.0) * rr, aa);
  float e = 0.8;
  float h0 = sealH(c, r);
  float hs = mix(1.8, 1.0, press) * 5.0;
  vec3 n = normalize(vec3(-(sealH(c + vec2(e, 0.0), r) - h0) * hs / e, -(sealH(c + vec2(0.0, e), r) - h0) * hs / e, 1.0));
  vec3 wax = u_col * (0.85 + 0.2 * noise(c * 0.15));
  // Thin wax at the rim glows with transmitted light.
  wax = mix(wax * 1.35 + vec3(0.08, 0.02, 0.0), wax, smoothstep(0.9, 0.75, dist) * 0.0 + smoothstep(1.0, 0.8, dist));
  vec3 col = glossy(wax, n, 40.0, 0.55);
  if (u_a.z > 0.5) { // gold leaf flakes pressed into the wax
    float leaf = smoothstep(0.52, 0.6, fbm(c * 0.09 + u_seed));
    col = mix(col, envMetal(GILT, n, 0.3), leaf * smoothstep(0.95, 0.7, dist));
  }
  if (u_a.w > 0.5) col = mix(col, col * 0.45 + vec3(0.02), smoothstep(0.05, -0.05, skull(c / (r * 0.52))));
  if (u_a.y > 0.5) col = mix(col, col * 0.35, rsmooth(0.05, 0.0, voroEdge(c / r * 2.2 + u_seed)) * smoothstep(0.95, 0.5, dist));
  vec4 seal = vec4(col * a, a);
  return seal + vec4(0.0, 0.0, 0.0, sh) * (1.0 - a);
}

// ------------------------------------------------------------ 4 ink stamp
vec4 inkStamp(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float hit = u_a.x;
  float jitter = (noise(px * 0.35 + u_seed) - 0.5) * 1.6;
  float d;
  if (u_a.y > 0.5) {
    float r = min(sz.x, sz.y) * 0.46;
    d = min(abs(length(c) - r) - 2.6, abs(length(c) - r * 0.84) - 1.2);
  } else {
    vec2 b = sz * 0.5 - 4.0;
    d = min(abs(sdRBox(c, b, 5.0)) - 2.8, abs(sdRBox(c, b - 6.0, 3.0)) - 1.1);
  }
  d += jitter;
  float ink = cover(d, aa * 1.2);
  // Uneven inking: gaps where the block met the page lightly.
  float gaps = smoothstep(0.22, 0.42, fbm(px * 0.12 + u_seed * 3.0));
  ink *= mix(0.35, 1.0, gaps);
  // Splatter as the block strikes.
  if (hit > 0.2 && hit < 0.95) {
    vec2 g = floor(px / 7.0);
    vec2 f = fract(px / 7.0) - 0.5;
    float drop = rsmooth(0.2 * hash(g + 2.0), 0.0, length(f)) * step(0.93, hash(g + u_seed));
    float ring = smoothstep(0.3, 0.55, length(c) / max(sz.x, sz.y)) * rsmooth(0.8, 0.6, length(c) / max(sz.x, sz.y));
    ink = max(ink, drop * ring);
  }
  float a = ink * 0.92;
  return vec4(u_col * a, a);
}

// ------------------------------------------------------------ 5 tincture gauge
vec4 gauge(vec2 px, vec2 sz, float aa) {
  float capW = min(10.0, sz.x * 0.12);
  float R = sz.y * 0.38;
  vec2 c = px - vec2(0.0, sz.y * 0.5);
  float x0 = capW, x1 = sz.x - capW;
  float inTube = step(x0, px.x) * step(px.x, x1) * step(abs(c.y), R);
  float ny = clamp(c.y / R, -1.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - ny * ny));
  vec3 n = normalize(vec3(0.0, ny, nz));
  float level = clamp(u_a.x, 0.0, 1.0);
  float fillX = mix(x0, x1, level) + 1.5 * ny * ny;
  vec3 col = vec3(0.03, 0.02, 0.02) + vec3(0.06, 0.05, 0.05) * nz;
  float a = 0.0;
  if (inTube > 0.5) {
    a = 1.0;
    float liquid = step(px.x, fillX);
    vec3 tinct = mix(vec3(0.55, 0.03, 0.05), vec3(0.95, 0.15, 0.12), 0.35 + 0.65 * nz) * (1.0 + u_a.z * 0.5);
    // Rising bubbles.
    vec2 bq = vec2(px.x * 0.5, c.y * 0.5 + u_time * 6.0);
    vec2 bg = floor(bq);
    float bub = rsmooth(0.28, 0.12, length(fract(bq) - 0.5)) * step(0.9, hash(bg + 3.0));
    tinct += vec3(0.4, 0.15, 0.1) * bub;
    col = mix(col, tinct, liquid);
    col += vec3(1.0, 0.5, 0.4) * rsmooth(1.2, 0.0, abs(px.x - fillX)) * liquid * 0.6; // meniscus
    // Graduations painted on the glass.
    float tick = rsmooth(0.6, 0.2, abs(fract((px.x - x0) / ((x1 - x0) / 10.0) + 0.5) - 0.5) * ((x1 - x0) / 10.0)) * step(ny, -0.35);
    col = mix(col, vec3(0.85, 0.75, 0.5), tick * 0.6);
    // Glass: highlight streak, dark edges.
    col += vec3(1.0, 0.95, 0.85) * rsmooth(0.12, 0.0, abs(ny + 0.55)) * 0.55;
    col *= mix(0.45, 1.0, nz);
    // Cracked glass when vitals are low.
    if (u_a.y > 0.0) {
      vec2 cc = px - vec2(x1 - (x1 - x0) * 0.3, sz.y * 0.45);
      float ang = atan(cc.y, cc.x);
      float spoke = rsmooth(0.07, 0.0, abs(fract(ang / (2.0 * PI) * 7.0 + noise(vec2(length(cc) * 0.3, 1.0)) * 0.3) - 0.5)) * rsmooth(R * 3.0, 0.0, length(cc));
      float ringc = rsmooth(0.5, 0.0, abs(length(cc) - R * 0.9 - noise(vec2(ang * 4.0, 2.0)) * 2.0));
      col = mix(col, vec3(0.95, 0.9, 0.85), clamp(spoke + ringc * 0.6, 0.0, 1.0) * u_a.y * 0.8);
    }
  }
  // Brass end caps and a centre clamp.
  vec2 lc = vec2(min(px.x, sz.x - px.x), abs(c.y));
  float cap = step(lc.x, capW + 0.5) * step(lc.y, R + 2.5);
  float clamp1 = step(abs(px.x - sz.x * 0.5), 2.0) * step(abs(c.y), R + 1.5);
  if (cap + clamp1 > 0.5) {
    float ridge = 0.5 + 0.5 * sin(lc.x * 2.2);
    vec3 cn = normalize(vec3(0.0, clamp(c.y / (R + 2.5), -1.0, 1.0) * 0.9, 0.6 + ridge * 0.2));
    col = envMetal(BRASS, cn, 0.35) * (0.8 + 0.2 * ridge);
    a = 1.0;
  }
  float edge = min(min(px.x, sz.x - px.x), R + 2.5 - abs(c.y));
  a *= cover(-edge, aa);
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 6 sand-glass
vec4 sandGlass(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float plate = sz.y * 0.1;
  float H = sz.y * 0.5 - plate;
  float W = sz.x * 0.36;
  float neck = max(0.8, sz.x * 0.035);
  float yn = c.y / H;           // -1 top … 1 bottom
  float s = abs(yn);
  float halfW = neck + (W - neck) * sqrt(max(0.0, sin(min(s, 1.0) * PI * 0.9)));
  vec4 res = vec4(0.0);
  float glass = step(abs(c.x), halfW) * step(s, 1.0);
  float f = clamp(u_a.x, 0.0, 1.0);
  if (glass > 0.5) {
    float xn = c.x / max(halfW, 0.001);
    vec3 col = vec3(0.1, 0.1, 0.12) * 0.6;
    float a = 0.35;
    // Sand in the top bulb sits on the neck, dished in the middle.
    float topLevel = f * 0.9 - 0.12 * f * (1.0 - abs(xn));
    float sand = yn < 0.0 && s < topLevel ? 1.0 : 0.0;
    // The pile below grows from the base as a cone.
    float pile = (1.0 - f) * 0.85;
    float pileTop = 1.0 - pile * (1.0 - 0.55 * abs(xn));
    if (yn > 0.0 && yn > pileTop) sand = 1.0;
    // Falling stream.
    if (f > 0.001 && yn > 0.0 && yn < pileTop && abs(c.x) < max(0.6, neck * 0.5)) {
      float grains = step(0.35, noise(vec2(c.x * 2.0, c.y * 0.9 - u_time * 30.0)));
      sand = max(sand, grains);
    }
    vec3 sandCol = vec3(0.92, 0.74, 0.42) * (0.75 + 0.35 * hash(floor(px * 1.5)));
    col = mix(col, sandCol * (0.8 + 0.2 * (1.0 - abs(xn))), sand);
    a = mix(a, 1.0, sand);
    // Glass highlights on the curved walls.
    col += vec3(1.0, 0.95, 0.9) * rsmooth(0.12, 0.0, abs(xn + 0.62)) * 0.5 * step(0.15, s);
    col += vec3(0.9) * rsmooth(0.08, 0.0, abs(abs(xn) - 0.97)) * 0.35;
    a = max(a, rsmooth(0.12, 0.0, abs(abs(xn) - 0.95)) * 0.8);
    res = vec4(col * a, a);
  }
  // Brass plates and turned posts.
  float pl = step(H, abs(c.y)) * step(abs(c.y), sz.y * 0.5) * step(abs(c.x), sz.x * 0.47);
  float post = step(abs(abs(c.x) - sz.x * 0.4), max(1.0, sz.x * 0.045)) * step(abs(c.y), H);
  if (pl + post > 0.5) {
    float bev = pl > 0.5 ? (abs(c.y) - H) / plate : (abs(c.x) - sz.x * 0.4) / (sz.x * 0.045);
    vec3 nn = normalize(vec3(post > 0.5 ? bev * 0.8 : 0.0, pl > 0.5 ? (c.y > 0.0 ? 1.0 : -1.0) * (bev - 0.5) * 0.8 : 0.0, 0.7));
    vec3 m = envMetal(pl > 0.5 ? BRASS : vec3(0.35, 0.22, 0.12), nn, 0.4);
    res = vec4(m, 1.0);
  }
  float outer = max(abs(c.x) - sz.x * 0.47, abs(c.y) - sz.y * 0.5);
  return res * cover(outer, aa);
}

// ------------------------------------------------------------ 7 star reliquary
float reliqH(vec2 c, float R) {
  float r = length(c);
  float bez = smoothstep(R, R * 0.9, r) * (0.6 + 0.4 * smoothstep(R * 0.8, R * 0.95, r));
  float knurl = 0.08 * sin(atan(c.y, c.x) * 48.0) * smoothstep(R * 0.86, R * 0.95, r) * smoothstep(R * 1.01, R * 0.97, r);
  float star = sdStar5(c * vec2(1.0, -1.0), R * 0.66, 0.45);
  float cav = smoothstep(1.5, -1.5, star) * 0.35;
  return bez + knurl - cav;
}
vec4 reliquary(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float R = min(sz.x, sz.y) * 0.46;
  float r = length(c);
  float a = cover(r - R, aa);
  float h0 = reliqH(c, R);
  vec3 n = normalize(vec3(-(reliqH(c + vec2(1, 0), R) - h0) * 3.0, -(reliqH(c + vec2(0, 1), R) - h0) * 3.0, 1.0));
  float spent = u_a.y;
  vec3 brass = mix(BRASS, vec3(0.3, 0.32, 0.24), spent * 0.7);
  vec3 col;
  if (r > R * 0.84) col = envMetal(brass, n, 0.35 + spent * 0.4);
  else {
    // Velvet field with a tooled halo of rays.
    col = mix(vec3(0.12, 0.03, 0.03), vec3(0.04, 0.01, 0.01), r / R);
    col *= 0.8 + 0.3 * noise(c * 0.8);
    col += GILT * 0.12 * rsmooth(0.06, 0.0, abs(fract(atan(c.y, c.x) / (2.0 * PI) * 20.0) - 0.5)) * smoothstep(R * 0.5, R * 0.8, r) * (1.0 - spent);
  }
  float star = sdStar5(c * vec2(1.0, -1.0), R * 0.66, 0.45);
  if (star < 1.0) {
    float yb = (c.y + R * 0.6) / (R * 1.25);          // 0 top … 1 bottom
    float filled = step(1.0 - clamp(u_a.x, 0.0, 1.0), yb) * (1.0 - spent);
    vec3 empty = vec3(0.1, 0.07, 0.04);
    if (spent > 0.5) empty = mix(vec3(0.22, 0.24, 0.18), vec3(0.14, 0.2, 0.16), noise(c * 0.5)); // tarnish and verdigris
    vec3 gilt = envMetal(GILT, n, 0.2);
    // Beaten-gold texture and a travelling glint.
    gilt *= 0.9 + 0.2 * smoothstep(0.0, 0.2, voroEdge(c * 0.25));
    float band = rsmooth(0.12, 0.0, abs(fract((c.x - c.y) / (R * 3.0) - u_time * 0.35) - 0.5)) * u_a.z;
    gilt += vec3(1.0, 0.95, 0.8) * band * 0.9;
    vec3 sc = mix(empty * (0.6 + 0.6 * max(dot(n, LIGHT), 0.0)), gilt, filled);
    col = mix(col, sc, cover(star, aa));
    col = mix(col, col * 0.4, rsmooth(1.5, 0.0, abs(star)) * 0.6); // engraved outline
  }
  col += GILT * u_a.w * 0.4 * rsmooth(R * 0.3, 0.0, abs(star)) * (0.7 + 0.3 * sin(u_time * 6.0));
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 8 tincture vial
vec4 vial(vec2 px, vec2 sz, float aa) {
  vec2 c = px - vec2(sz.x * 0.5, sz.y * 0.5);
  float bw = sz.x * 0.36, bh = sz.y * 0.3;
  float body = sdRBox(c - vec2(0.0, sz.y * 0.13), vec2(bw, bh), bw * 0.7);
  float neckD = sdBox(c - vec2(0.0, -sz.y * 0.2), vec2(bw * 0.38, sz.y * 0.1));
  float lip = sdRBox(c - vec2(0.0, -sz.y * 0.3), vec2(bw * 0.5, sz.y * 0.035), 1.0);
  float glass = min(min(body, neckD), lip);
  float cork = sdRBox(c - vec2(0.0, -sz.y * 0.39), vec2(bw * 0.34, sz.y * 0.07), 1.5);
  float a = max(cover(glass, aa) * 0.5, cover(cork, aa));
  float xn = c.x / bw;
  vec3 col = vec3(0.12, 0.14, 0.14) * 0.6;
  float level = mix(sz.y * 0.43, -sz.y * 0.15, clamp(u_a.x, 0.0, 1.0));
  if (glass < 0.0 && c.y > level && body < 0.0) {
    vec3 liq = mix(vec3(0.1, 0.45, 0.2), vec3(0.4, 0.95, 0.5), 0.5 + 0.5 * (1.0 - abs(xn)));
    col = liq; a = cover(glass, aa);
    col += vec3(0.8, 1.0, 0.8) * rsmooth(1.2, 0.0, abs(c.y - level)) * 0.5;
  }
  if (glass < 0.0) {
    col += vec3(1.0) * rsmooth(0.14, 0.0, abs(xn + 0.55)) * 0.5;
    a = max(a, rsmooth(1.2, 0.0, abs(glass)) * 0.9);
    col += vec3(0.7) * rsmooth(1.2, 0.0, abs(glass)) * 0.4;
  }
  if (cork < 0.0) {
    vec3 ck = vec3(0.55, 0.38, 0.22) * (0.8 + 0.3 * noise(px * 0.8));
    col = diffuse(ck, normalize(vec3(-c.x / (bw * 0.34) * 0.5, 0.0, 1.0)));
    a = cover(cork, aa);
  }
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 9 brass medallion
vec4 medallion(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float R = min(sz.x, sz.y) * 0.5 - 1.0;
  float r = length(c);
  float inner = R * 0.82;
  float a = cover(r - R, aa);
  vec3 col;
  if (r > inner) {
    float t = (r - inner) / (R - inner);
    vec2 dir = c / max(r, 0.001);
    float bulge = cos((t - 0.45) * PI * 0.9);
    vec3 n = normalize(vec3(dir * (0.5 - t) * 1.6, 0.6 + 0.4 * bulge));
    float bead = 0.8 + 0.2 * step(0.5, fract(atan(c.y, c.x) / (2.0 * PI) * 36.0)) * rsmooth(0.2, 0.0, abs(t - 0.55));
    col = envMetal(BRASS, n, 0.3) * bead;
    col *= mix(0.5, 1.0, smoothstep(0.0, 0.15, t));
  } else {
    col = mix(u_col * 1.4, u_col * 0.5, r / inner);
    // Glass dome reflection.
    col += vec3(1.0, 0.92, 0.8) * rsmooth(0.2, 0.0, length((c / inner) - vec2(-0.35, -0.4)) - 0.25) * 0.25;
    col *= mix(0.4, 1.0, smoothstep(inner, inner - 4.0, r));
  }
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 10 vellum strip
vec4 vellumStrip(vec2 px, vec2 sz, float aa) {
  float rollW = 7.0;
  vec2 inner = vec2(px.x - rollW, px.y);
  vec2 isz = vec2(sz.x - rollW * 2.0, sz.y);
  vec4 p = parchment(inner, isz, aa);
  vec3 col = p.rgb;
  // Ruled sepia grid.
  float gx = rsmooth(0.5, 0.0, abs(fract(inner.x / 16.0) - 0.5) * 16.0 - 7.5);
  float gy = rsmooth(0.5, 0.0, abs(fract(inner.y / 11.0) - 0.5) * 11.0 - 5.0);
  col = mix(col, vec3(0.55, 0.3, 0.2), max(gx, gy) * 0.18);
  float a = step(rollW, px.x) * step(px.x, sz.x - rollW);
  // Rolled ends: wooden rods wrapped in vellum.
  float end = min(px.x, sz.x - px.x);
  if (end < rollW) {
    float t = end / rollW;
    float nz = sin(t * PI);
    vec3 n = normalize(vec3((px.x < sz.x * 0.5 ? -1.0 : 1.0) * cos(t * PI) * 0.8, 0.0, nz + 0.2));
    col = diffuse(vec3(0.8, 0.68, 0.48), n) * (0.85 + 0.15 * sin(px.y * 1.2));
    a = 1.0;
  }
  a *= cover(-min(px.y, sz.y - px.y), aa);
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 11 tray pocket
vec4 trayPocket(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float d = sdRBox(c, sz * 0.5 - 1.0, 6.0);
  float a = cover(d, aa);
  float sel = u_a.x;
  // Deep leather pocket, shadowed at the top lip.
  vec3 alb = vec3(0.1, 0.04, 0.03) * (0.8 + 0.3 * voroEdge(px * 0.3));
  vec3 col = alb * (0.6 + 0.6 * smoothstep(0.0, sz.y, px.y));
  col *= mix(0.3, 1.0, smoothstep(0.0, 10.0, px.y));
  // Warm glow in the selected slot.
  col += vec3(1.0, 0.6, 0.25) * sel * 0.35 * rsmooth(sz.x * 0.6, 0.0, length(c)) * (0.85 + 0.15 * sin(u_time * 3.0));
  // Brass lining: a thin bevelled rim, gilt when selected.
  float rim = rsmooth(2.6, 1.0, -d);
  vec3 n = normalize(vec3(-c.x / sz.x, -c.y / sz.y, 0.5));
  vec3 metal = envMetal(mix(BRASS * 0.8, GILT, sel), n, 0.3);
  col = mix(col, metal, rim);
  // Cooldown: a dark shutter drawn down over the slot.
  float cd = u_a.y;
  col = mix(col, col * 0.25, step(px.y, sz.y * cd) * step(0.001, cd));
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 12 torn ribbon scroll
vec4 ribbon(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float unfurl = clamp(u_a.x, 0.0, 1.0);
  float tail = min(30.0, sz.x * 0.14);
  float hh = sz.y * 0.34;
  float halfW = mix(tail * 1.3, sz.x * 0.5 - 1.0, unfurl);
  float wave = sin(c.x * 0.035 + u_time * 1.2) * 1.2;
  float ax = abs(c.x);
  // The tails hang a little lower and sit behind the band, folded back.
  float inTail = step(halfW - tail, ax);
  float y = c.y - wave - inTail * hh * 0.28;
  float band = max(abs(y) - hh * mix(1.0, 0.86, inTail), ax - halfW);
  // Swallow-tail notch at each end.
  float notch = (halfW - tail * 0.55 * (1.0 - abs(y) / hh)) - ax;
  band = max(band, -notch);
  band += (noise(vec2(c.y * 0.8, c.x * 0.1)) - 0.5) * 1.6 * step(halfW - tail * 0.5, ax);
  float a = cover(band, aa);
  vec3 n = normalize(vec3(0.0, sin(y / hh * 1.3) * 0.45, 1.0));
  vec3 cloth = u_col * 1.35 * (0.85 + 0.25 * noise(vec2(px.x * 0.8, px.y * 0.15)));
  cloth *= 1.0 - 0.06 * step(0.5, fract(px.y * 0.5));
  vec3 col = glossy(cloth, n, 12.0, 0.15) * mix(1.0, 0.55, inTail);
  // Gilt edging along the band; a shadowed fold where the tail tucks behind.
  col = mix(col, GILT * 0.85, rsmooth(1.0, 0.3, abs(abs(y) - hh + 3.5)) * (1.0 - inTail) * 0.85);
  col *= 1.0 - 0.6 * rsmooth(3.0, 0.0, abs(ax - (halfW - tail))) ;
  col *= mix(0.6, 1.0, smoothstep(0.0, 3.0, -band));
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 13 engraved plaque
vec4 plaque(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float d = sdRBox(c, sz * 0.5, 4.0);
  float a = cover(d, aa);
  float bev = 4.0;
  vec3 col;
  if (-d < bev) {
    vec2 g = vec2(abs(c.x) - sz.x * 0.5, abs(c.y) - sz.y * 0.5);
    vec3 n = normalize(vec3(g.x > g.y ? -sign(c.x) : 0.0, g.y >= g.x ? -sign(c.y) : 0.0, 1.2));
    col = envMetal(BRASS, n, 0.35);
  } else {
    float brushed = 0.9 + 0.1 * noise(vec2(px.x * 0.05, px.y * 2.0));
    col = vec3(0.1, 0.06, 0.02) * brushed;
    col *= mix(0.4, 1.0, smoothstep(bev, bev + 4.0, -d));
  }
  return vec4(col * a, a);
}

// ------------------------------------------------------------ 14 tally ribbon
vec4 tally(vec2 px, vec2 sz, float aa) {
  vec4 rb = ribbon(px, sz, aa);
  float n = u_a.x;
  vec2 c = px - sz * 0.5;
  bool gilt = n >= 10.0;
  float marks = min(n, 9.0);
  float span = sz.x * 0.52;
  float ink = 0.0;
  for (int i = 0; i < 9; i++) {
    if (float(i) >= marks) break;
    float group = floor(float(i) / 5.0);
    float k = mod(float(i), 5.0);
    float x0 = -span * 0.5 + group * span * 0.55 + k * span * 0.1;
    if (k < 4.0) ink = max(ink, rsmooth(1.3, 0.4, sdSeg(c, vec2(x0, -sz.y * 0.2), vec2(x0 + 1.5, sz.y * 0.2))));
    else ink = max(ink, rsmooth(1.3, 0.4, sdSeg(c, vec2(x0 - span * 0.42, sz.y * 0.16), vec2(x0 + span * 0.02, -sz.y * 0.16))));
  }
  vec3 inkCol = gilt ? GILT : vec3(0.95, 0.88, 0.7);
  rb.rgb = mix(rb.rgb, inkCol * rb.a, ink * rb.a);
  return rb;
}

// ------------------------------------------------------------ 15 instrument icons
// Each returns a signed distance; height comes from the distance (a bevelled inlay).
float toolD(vec2 p, int tool, out float mat) {
  mat = 0.0; // 0 steel, 1 wood, 2 brass, 3 leech/flesh, 4 glass, 5 salve, 6 ember
  float d = 1e5;
  if (tool == 0) { // lancet: leaf blade on a turned wooden handle
    vec2 q = rot(-0.8) * p;
    float blade = max(length(q * vec2(2.3, 1.0) - vec2(0.0, -0.35)) - 0.5, q.y - 0.02);
    blade = max(blade, -q.y - 0.85);
    float handle = sdRBox(q - vec2(0.0, 0.45), vec2(0.085, 0.42), 0.08);
    float ferrule = sdBox(q - vec2(0.0, 0.06), vec2(0.11, 0.05));
    d = blade; mat = 0.0;
    if (handle < d) { d = handle; mat = 1.0; }
    if (ferrule < d) { d = ferrule; mat = 2.0; }
  } else if (tool == 1) { // tongs: two jaws hinged at a ring
    vec2 q = rot(-0.5) * p;
    float j1 = sdSeg(q, vec2(-0.08, 0.75), vec2(-0.2, -0.8)) - 0.07;
    float j2 = sdSeg(q, vec2(0.08, 0.75), vec2(0.2, -0.8)) - 0.07;
    float ring = abs(length(q - vec2(0.0, 0.78)) - 0.13) - 0.05;
    d = min(min(j1, j2), ring); mat = 0.0;
  } else if (tool == 2) { // leech-pipe: a brass pipe with a leech at the mouth
    float pipe = sdSeg(p, vec2(-0.75, 0.75), vec2(0.15, -0.15)) - 0.1;
    float bowl = length(p - vec2(-0.72, 0.72)) - 0.17;
    float leech = length((p - vec2(0.42, -0.42)) * vec2(1.0, 1.0) + vec2(sin(u_time * 5.0) * 0.03, 0.0)) - 0.3;
    leech = min(leech, length(p - vec2(0.2, -0.2)) - 0.18);
    d = min(pipe, bowl); mat = 2.0;
    if (leech < d) { d = leech; mat = 3.0; }
  } else if (tool == 3) { // gut thread: curved needle trailing thread
    float needle = abs(length(p - vec2(0.0, 0.2)) - 0.55) - 0.06;
    needle = max(needle, p.y - 0.25);
    float thread = abs(p.y + 0.55 * sin(p.x * 3.0 + 1.0) - 0.45) - 0.035;
    thread = max(thread, max(-p.x - 0.1, p.x - 0.85));
    d = needle; mat = 0.0;
    if (thread < d) { d = thread; mat = 5.0; }
  } else if (tool == 4) { // saint's salve: a lidded apothecary pot
    float pot = sdRBox(p - vec2(0.0, 0.2), vec2(0.55, 0.5), 0.18);
    float lid = sdRBox(p - vec2(0.0, -0.42), vec2(0.64, 0.14), 0.06);
    float knob = length(p - vec2(0.0, -0.62)) - 0.13;
    d = pot; mat = 4.0;
    if (lid < d) { d = lid; mat = 2.0; }
    if (knob < d) { d = knob; mat = 2.0; }
  } else if (tool == 5) { // tincture: glass syringe with brass plunger
    vec2 q = rot(0.75) * p;
    float barrel = sdRBox(q - vec2(0.0, -0.05), vec2(0.17, 0.5), 0.05);
    float plunger = sdBox(q - vec2(0.0, -0.72), vec2(0.28, 0.06));
    plunger = min(plunger, sdBox(q - vec2(0.0, -0.6), vec2(0.04, 0.15)));
    float nd = sdSeg(q, vec2(0.0, 0.45), vec2(0.0, 0.95)) - 0.025;
    d = barrel; mat = 4.0;
    if (plunger < d) { d = plunger; mat = 2.0; }
    if (nd < d) { d = nd; mat = 0.0; }
  } else if (tool == 6) { // cautery brand: iron rod with a glowing head
    vec2 q = rot(-0.8) * p;
    float rod = sdSeg(q, vec2(0.0, -0.45), vec2(0.0, 0.2)) - 0.06;
    float grip = sdRBox(q - vec2(0.0, 0.55), vec2(0.1, 0.34), 0.08);
    float head = sdRBox(q - vec2(0.0, -0.6), vec2(0.16, 0.14), 0.05);
    d = rod; mat = 0.0;
    if (grip < d) { d = grip; mat = 1.0; }
    if (head < d) { d = head; mat = 6.0; }
  } else { // scrying lens: brass-rimmed lens on a handle
    float rim = abs(length(p - vec2(-0.15, -0.15)) - 0.5) - 0.08;
    float lens = length(p - vec2(-0.15, -0.15)) - 0.44;
    float handle = sdSeg(p, vec2(0.25, 0.25), vec2(0.8, 0.8)) - 0.09;
    d = rim; mat = 2.0;
    if (lens < d) { d = lens; mat = 4.0; }
    if (handle < d) { d = handle; mat = 1.0; }
  }
  return d;
}
vec4 toolIcon(vec2 px, vec2 sz, float aa) {
  vec2 p = (px - sz * 0.5) / (min(sz.x, sz.y) * 0.46);
  float pa = aa / (min(sz.x, sz.y) * 0.46);
  int tool = int(u_a.x + 0.5);
  float state = u_a.y; // 0 idle, 1 selected, 2 disabled, 3 cooldown
  float mat;
  float d = toolD(p, tool, mat);
  float e = 0.012;
  float m2;
  float dx = toolD(p + vec2(e, 0.0), tool, m2) - d;
  float dy = toolD(p + vec2(0.0, e), tool, m2) - d;
  float bevel = smoothstep(0.0, 0.08, -d);
  vec3 n = normalize(vec3(-dx / e * (1.0 - bevel), -dy / e * (1.0 - bevel), 0.6));
  vec3 alb = vec3(0.78, 0.8, 0.84);
  float rough = 0.25;
  if (mat == 1.0) { alb = vec3(0.42, 0.26, 0.14) * (0.8 + 0.3 * noise(p * vec2(4.0, 30.0))); rough = 0.8; }
  if (mat == 2.0) { alb = BRASS; rough = 0.35; }
  if (mat == 3.0) { alb = vec3(0.3, 0.08, 0.1) * (0.8 + 0.3 * sin(p.x * 40.0)); rough = 0.3; }
  if (mat == 4.0) { alb = vec3(0.5, 0.7, 0.75); rough = 0.1; }
  if (mat == 5.0) { alb = vec3(0.88, 0.8, 0.6); rough = 0.8; }
  vec3 col = mat == 1.0 || mat == 3.0 || mat == 5.0 ? glossy(alb, n, 20.0, 0.25) : envMetal(alb, n, rough);
  if (mat == 4.0) {
    col = mix(col, tool == 5 ? vec3(0.3, 0.9, 0.5) : (tool == 4 ? vec3(0.95, 0.85, 0.5) : vec3(0.55, 0.75, 1.0)), 0.45);
    col += vec3(1.0) * rsmooth(0.08, 0.0, abs(p.x + p.y + 0.3)) * 0.3;
  }
  if (mat == 6.0) {
    float heat = 0.75 + 0.25 * sin(u_time * 7.0);
    col = mix(vec3(0.3, 0.05, 0.0), vec3(1.0, 0.65, 0.2), heat * (0.6 + 0.4 * noise(p * 12.0 + u_time)));
  }
  // Engraved outline: the woodcut edge of the inlay.
  col *= mix(0.25, 1.0, smoothstep(0.0, 0.05, -d));
  float a = cover(d, pa);
  // Outer halo (the gilt rim when selected; ember glow for the brand).
  float glow = 0.0;
  vec3 gcol = GILT;
  if (state > 0.5 && state < 1.5) glow = rsmooth(0.22, 0.0, d) * (1.0 - a) * 0.9;
  if (tool == 6) { glow = max(glow, rsmooth(0.4, 0.0, length(rot(-0.8) * p - vec2(0.0, -0.6)) - 0.1) * 0.5 * (1.0 - a)); gcol = vec3(1.0, 0.5, 0.15); }
  if (state > 1.5 && state < 2.5) { col = vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.55, 0.55, 0.48); } // tarnished
  if (state > 2.5) { float cd = clamp(u_a.z, 0.0, 1.0); col = mix(col, col * 0.3, step((px.y / sz.y), cd)); }
  vec4 res = vec4(col * a, a);
  res += vec4(gcol * glow, glow * 0.8) * (1.0 - res.a);
  return res;
}

// ------------------------------------------------------------ 16 brass crosshair
vec4 crosshair(vec2 px, vec2 sz, float aa) {
  vec2 c = px - sz * 0.5;
  float R = min(sz.x, sz.y) * 0.3;
  float r = length(c);
  float ring = abs(r - R) - 1.3;
  vec2 ac = abs(c);
  float ticks = min(max(ac.x - 0.9, abs(ac.y - R * 1.35) - R * 0.35), max(ac.y - 0.9, abs(ac.x - R * 1.35) - R * 0.35));
  float dot0 = r - 1.4;
  float d = min(min(ring, ticks), dot0);
  float shadow = cover(min(ring, ticks) - 1.0, aa * 2.0) * 0.5;
  float a = cover(d, aa);
  vec3 n = normalize(vec3(-c / max(r, 0.001) * clamp((r - R) / 1.3, -1.0, 1.0) * 0.8, 0.6));
  vec3 col = envMetal(mix(BRASS, u_col, 0.45), n, 0.3);
  vec4 res = vec4(col * a, a);
  return res + vec4(0.0, 0.0, 0.0, shadow) * (1.0 - a);
}

// ------------------------------------------------------------ 17 hanging ledger page
vec4 ledger(vec2 px, vec2 sz, float aa) {
  vec4 p = parchment(px, sz, aa);
  // Red-ruled margins and faint ledger lines.
  float margin = rsmooth(0.8, 0.2, abs(px.x - 34.0)) + rsmooth(0.8, 0.2, abs(px.x - sz.x + 34.0));
  float lines = rsmooth(0.6, 0.1, abs(fract(px.y / 30.0) - 0.5) * 30.0 - 14.4) * step(40.0, px.y);
  vec3 col = mix(p.rgb, vec3(0.6, 0.12, 0.1), margin * 0.5);
  col = mix(col, vec3(0.35, 0.3, 0.4), lines * 0.2);
  // A punched hanging-hole with its cord at the top.
  vec2 hc = px - vec2(sz.x * 0.5, 12.0);
  float hole = length(hc) - 4.0;
  col = mix(col, vec3(0.05), cover(hole, aa));
  return vec4(col * p.a, p.a);
}

void main() {
  vec2 px = v_uv * u_size;
  if (u_rot != 0.0) px = rot(u_rot) * (px - u_size * 0.5) + u_size * 0.5;
  float aa = max(fwidth(px.x), 0.5);
  vec4 r;
  if (u_mode == 0) r = parchment(px, u_size, aa);
  else if (u_mode == 1) r = oak(px, u_size, aa);
  else if (u_mode == 2) r = leather(px, u_size, aa);
  else if (u_mode == 3) r = waxSeal(px, u_size, aa);
  else if (u_mode == 4) r = inkStamp(px, u_size, aa);
  else if (u_mode == 5) r = gauge(px, u_size, aa);
  else if (u_mode == 6) r = sandGlass(px, u_size, aa);
  else if (u_mode == 7) r = reliquary(px, u_size, aa);
  else if (u_mode == 8) r = vial(px, u_size, aa);
  else if (u_mode == 9) r = medallion(px, u_size, aa);
  else if (u_mode == 10) r = vellumStrip(px, u_size, aa);
  else if (u_mode == 11) r = trayPocket(px, u_size, aa);
  else if (u_mode == 12) r = ribbon(px, u_size, aa);
  else if (u_mode == 13) r = plaque(px, u_size, aa);
  else if (u_mode == 14) r = tally(px, u_size, aa);
  else if (u_mode == 15) r = toolIcon(px, u_size, aa);
  else if (u_mode == 16) r = crosshair(px, u_size, aa);
  else r = ledger(px, u_size, aa);
  // Modes 0/1/2/10/17 return straight colour × alpha from their own paths; normalise.
  if (u_mode == 0 || u_mode == 1 || u_mode == 2) r.rgb *= r.a;
  o = r * u_alpha;
}`;
