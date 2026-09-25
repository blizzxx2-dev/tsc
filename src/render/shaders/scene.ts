/** GLSL ES 3.00 sources: scene. */

/**
 * Story environments. Kinds: 0 hospice, 1 street, 2 theatre, 3 chapel, 4 night, 5 camp.
 * Interiors are raymarched (arcades, vaults, candles, light shafts); exteriors are
 * layered 2.5D paintings (parallax gables, fog, moon, snow, bonfire).
 */
export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_view;
uniform float u_time;
uniform int u_kind;
out vec4 o;
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
float flick(float s) { return 0.82 + 0.1 * sin(u_time * 9.0 + s) * sin(u_time * 4.3 + s * 2.1) + 0.08 * noise(vec2(u_time * 6.0, s)); }

// ------------------------------------------------------------------ interiors (raymarched)
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }

// Arcade: floor, back wall pierced by arches, pillars, barrel vault. Returns distance; id in m.
float map(vec3 p, out float m) {
  float floorD = p.y;
  float ceilD = 7.2 - p.y - 0.25 * cos(p.x * 0.52);
  // Back wall with arched openings every 4 units.
  float cell = mod(p.x + 2.0, 4.0) - 2.0;
  float wall = sdBox(p - vec3(0.0, 3.5, 9.0), vec3(40.0, 4.0, 0.6));
  float archHole = min(sdBox(vec3(cell, p.y - 1.8, p.z - 9.0), vec3(1.3, 1.8, 1.0)), length(vec2(cell, p.y - 3.6)) - 1.3);
  if (u_kind == 3) archHole = max(archHole, -(abs(p.x) - 2.2)); // chapel: solid wall except the great window
  wall = max(wall, -archHole);
  // Pillars in two rows.
  vec3 q = p; q.x = mod(p.x + 2.0, 4.0) - 2.0;
  float pil = min(sdCyl(q - vec3(0.0, 3.0, 6.5), 0.42, 3.0), sdCyl(q - vec3(0.0, 3.0, 1.5), 0.42, 3.0));
  pil = min(pil, sdBox(q - vec3(0.0, 0.15, 6.5), vec3(0.6, 0.15, 0.6)));
  pil = min(pil, sdBox(q - vec3(0.0, 0.15, 1.5), vec3(0.6, 0.15, 0.6)));
  float d = floorD; m = 0.0;
  if (wall < d) { d = wall; m = 1.0; }
  if (pil < d) { d = pil; m = 2.0; }
  if (ceilD < d) { d = ceilD; m = 3.0; }
  // Theatre: tiered wooden galleries.
  if (u_kind == 2) {
    float tiers = sdBox(vec3(p.x, p.y - 0.6, p.z - 7.0), vec3(40.0, 0.6, 1.2));
    tiers = min(tiers, sdBox(vec3(p.x, p.y - 1.6, p.z - 8.0), vec3(40.0, 0.5, 1.0)));
    if (tiers < d) { d = tiers; m = 4.0; }
  }
  return d;
}
float mapD(vec3 p) { float m; return map(p, m); }
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx)));
}

vec3 candlePos(int i) {
  if (i == 4) return vec3(1.2, 1.0, 0.2);
  float fi = float(i);
  return vec3(-7.5 + fi * 5.0, 1.1 + 0.25 * mod(fi, 2.0), 5.2 - mod(fi, 2.0) * 2.4);
}

vec3 interior(vec2 uv) {
  float sway = sin(u_time * 0.15) * 0.25;
  vec3 ro = vec3(sway, 1.7, -4.5);
  vec3 ta = vec3(sway * 0.4, 2.1, 6.0);
  vec3 f = normalize(ta - ro), r = normalize(cross(vec3(0, 1, 0), f)), up = cross(f, r);
  vec3 rd = normalize(uv.x * r + uv.y * up + 1.35 * f);
  float t = 0.0, m = 0.0;
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = map(p, m);
    if (d < 0.002) { hit = true; break; }
    t += d * 0.9;
    if (t > 40.0) break;
  }
  vec3 col = vec3(0.0);
  vec3 p = ro + rd * t;
  // Sky/window beyond the arches.
  vec3 beyond = u_kind == 3 ? vec3(0.0) : mix(vec3(0.02, 0.025, 0.05), vec3(0.08, 0.09, 0.14), smoothstep(-0.2, 0.6, rd.y));
  if (hit) {
    vec3 n = calcNormal(p);
    // Materials.
    vec3 alb = vec3(0.32, 0.28, 0.24);
    float bump = 0.0;
    if (m == 0.0) { // flagstones
      vec2 g = p.xz * vec2(0.9, 0.9);
      vec2 cell = fract(g) - 0.5;
      float grout = smoothstep(0.46, 0.5, max(abs(cell.x), abs(cell.y)));
      alb = mix(vec3(0.26, 0.23, 0.2), vec3(0.34, 0.3, 0.26), hash(floor(g))) * (0.7 + 0.5 * fbm(p.xz * 3.0));
      alb *= 1.0 - grout * 0.7;
    } else if (m == 1.0 || m == 2.0 || m == 3.0) { // ashlar masonry
      vec2 w = m == 2.0 ? vec2(atan(p.z - 6.5, p.x) * 2.0, p.y * 2.2) : vec2(p.x * 1.1 + (m == 3.0 ? p.z : 0.0), p.y * 2.2);
      w.x += floor(w.y) * 0.5;
      vec2 c = fract(w) - 0.5;
      float mortar = smoothstep(0.44, 0.5, max(abs(c.x), abs(c.y)));
      alb = vec3(0.36, 0.32, 0.27) * (0.65 + 0.5 * fbm(p.xy * 2.5 + p.z)) * (0.85 + 0.3 * hash(floor(w)));
      alb *= 1.0 - mortar * 0.6;
      alb = mix(alb, vec3(0.12, 0.14, 0.1), smoothstep(0.55, 0.8, fbm(p.xy * 0.6)) * 0.5); // damp and moss
    } else if (m == 4.0) { // dark oak galleries
      alb = vec3(0.18, 0.1, 0.06) * (0.7 + 0.4 * noise(vec2(p.x * 8.0, p.y * 60.0)));
    }
    col = alb * vec3(0.07, 0.075, 0.1); // cold ambient
    // Candle lights with soft shadows via a short march.
    for (int i = 0; i < 5; i++) {
      vec3 lp = candlePos(i);
      vec3 l = lp - p;
      float dist2 = dot(l, l);
      vec3 ld = l / sqrt(dist2);
      float diff = max(dot(n, ld), 0.0);
      float sh = 1.0, st = 0.05;
      for (int k = 0; k < 16; k++) {
        float h = mapD(p + n * 0.01 + ld * st);
        sh = min(sh, 10.0 * h / st);
        st += clamp(h, 0.05, 0.6);
        if (st > sqrt(dist2) - 0.2) break;
      }
      sh = clamp(sh, 0.0, 1.0);
      col += alb * vec3(1.0, 0.62, 0.3) * diff * sh * 7.0 * flick(float(i) * 3.1) / (1.0 + dist2 * 0.35);
    }
    // Moonlight through the arches / coloured window light in the chapel.
    vec3 mdir = normalize(vec3(-0.3, 0.55, -1.0));
    float md = max(dot(n, mdir), 0.0);
    col += alb * (u_kind == 3 ? vec3(0.25, 0.12, 0.4) : vec3(0.12, 0.15, 0.25)) * md * 0.5;
    // Fog with distance.
    col = mix(col, vec3(0.05, 0.04, 0.045), 1.0 - exp(-t * 0.03));
  } else col = beyond;

  // Volumetric: light shafts through the arches (or window) and candle halos.
  float vol = 0.0;
  vec3 volCol = u_kind == 3 ? vec3(0.9, 0.55, 1.0) : vec3(0.55, 0.6, 0.85);
  for (int i = 0; i < 24; i++) {
    float s = (float(i) + hash(uv * 100.0 + u_time)) / 24.0 * min(t, 14.0);
    vec3 q = ro + rd * s;
    // Shafts slanting in from the back openings.
    vec2 sp = q.xy + vec2(q.z - 9.0) * vec2(0.35, -0.55);
    float shaft = u_kind == 3 ? rsmooth(2.2, 1.2, abs(sp.x)) * step(sp.y, 6.5) : rsmooth(0.9, 0.3, abs(mod(sp.x + 2.0, 4.0) - 2.0)) * smoothstep(0.2, 2.0, sp.y) * step(sp.y, 5.0);
    vol += shaft * (0.35 + 0.65 * fbm(q.xz * 0.8 + vec2(u_time * 0.05, 0.0)));
  }
  col += volCol * vol / 24.0 * (u_kind == 3 ? 0.28 : 0.12);
  // Candle flames and bloom-feeding halos.
  for (int i = 0; i < 4; i++) {
    vec3 lp = candlePos(i) + vec3(0.0, 0.12, 0.0);
    vec3 w = lp - ro;
    float along = dot(w, rd);
    if (along < 0.0 || (hit && along > t + 0.1)) continue;
    float dd = length(w - rd * along);
    float fl = flick(float(i) * 3.1);
    col += vec3(1.0, 0.55, 0.2) * 0.022 * fl / (dd * dd + 0.002);
    col += vec3(1.0, 0.8, 0.5) * rsmooth(0.05, 0.0, dd) * 2.0;
    // Candle body.
  }
  // Stained glass: the chapel's great window, glowing through.
  if (u_kind == 3 && !hit) {
    vec2 wuv = vec2(atan(rd.x, rd.z), rd.y);
    vec2 cellId = floor(wuv * vec2(18.0, 14.0));
    vec3 glass = vec3(hash(cellId), hash(cellId + 3.0), hash(cellId + 7.0));
    glass = mix(vec3(0.7, 0.1, 0.12), mix(vec3(0.15, 0.25, 0.8), vec3(0.9, 0.7, 0.2), glass.y), glass.x);
    vec2 cf = fract(wuv * vec2(18.0, 14.0)) - 0.5;
    float lead = smoothstep(0.38, 0.5, max(abs(cf.x), abs(cf.y)));
    col = glass * (1.0 - lead) * 1.4 * (0.8 + 0.2 * sin(u_time * 0.5));
  }
  return col;
}

// ------------------------------------------------------------------ exteriors (layered)
float gables(float x, float seed, float base, float amp) {
  float w = 1.0 / 7.0;
  float i = floor(x / w + seed);
  float f = fract(x / w + seed);
  float h = base + amp * hash1(i * 13.1 + seed);
  float roof = h + 0.09 * (1.0 - abs(f - 0.5) * 2.0);
  return roof;
}

vec3 exterior(vec2 uv, vec2 sp) {
  bool night = u_kind != 5;
  float y = sp.y;
  vec3 sky = mix(vec3(0.05, 0.06, 0.11), vec3(0.01, 0.012, 0.03), y);
  if (u_kind == 5) sky = mix(vec3(0.16, 0.07, 0.04), vec3(0.015, 0.012, 0.03), smoothstep(0.1, 0.9, y));
  vec3 col = sky;
  // Stars.
  vec2 sg = floor(sp * vec2(220.0, 124.0));
  float star = step(0.996, hash(sg)) * (0.5 + 0.5 * sin(u_time * 2.0 + hash(sg) * 40.0));
  col += vec3(0.8, 0.85, 1.0) * star * smoothstep(0.35, 0.8, y);
  // Moon and halo.
  vec2 mp = vec2(0.78, 0.8);
  float md = length((sp - mp) * vec2(1.78, 1.0));
  if (night) {
    col += vec3(0.5, 0.55, 0.7) * 0.12 / (md * md * 40.0 + 0.3);
    float disc = rsmooth(0.052, 0.048, md);
    vec3 moon = vec3(0.86, 0.87, 0.92) * (0.8 + 0.25 * fbm(sp * 40.0));
    col = mix(col, moon, disc);
  }
  // Drifting cloud bands.
  float cl = fbm(vec2(sp.x * 3.0 + u_time * 0.01, sp.y * 8.0));
  col = mix(col, vec3(0.08, 0.08, 0.12) * (night ? 1.0 : 1.6), smoothstep(0.55, 0.8, cl) * smoothstep(0.4, 0.9, y) * 0.7);

  if (u_kind == 5) {
    // Treeline layers.
    for (int l = 0; l < 3; l++) {
      float fl = float(l);
      float h = 0.35 + 0.08 * fl + 0.06 * fbm(vec2(sp.x * (6.0 - fl) + fl * 3.0, fl));
      h += 0.04 * abs(sin(sp.x * (60.0 + fl * 20.0)));
      col = mix(col, vec3(0.02, 0.018, 0.02) * (1.5 - fl * 0.4), step(y, h - fl * 0.08));
    }
    // Tents.
    for (int k = 0; k < 4; k++) {
      float cx = 0.14 + float(k) * 0.26;
      float tw = 0.09, th = 0.17;
      float inside = step(abs(sp.x - cx), tw * (1.0 - (y - 0.18) / th)) * step(0.18, y) * step(y, 0.18 + th);
      col = mix(col, vec3(0.07, 0.05, 0.035) * (0.8 + 0.4 * fbm(sp * 30.0)), inside);
    }
    // Ground lit by the bonfire.
    vec2 fire = vec2(0.5, 0.2);
    float fd = length((sp - fire) * vec2(1.78, 1.0));
    float fl = flick(1.0);
    if (y < 0.2) col = vec3(0.05, 0.035, 0.025) * (0.6 + 0.4 * fbm(sp * 50.0));
    col += vec3(1.0, 0.45, 0.15) * 0.08 * fl / (fd * fd * 6.0 + 0.05);
    // Flames and smoke.
    vec2 fp = (sp - fire) * vec2(1.78, 1.0);
    float flame = rsmooth(0.08, 0.0, length(fp * vec2(1.6, 0.7) - vec2(0.0, 0.04)) - 0.06 * fbm(vec2(fp.x * 20.0, fp.y * 10.0 - u_time * 3.0)));
    col += vec3(1.0, 0.55, 0.15) * flame * 2.5 * fl;
    float smoke = fbm(vec2(fp.x * 6.0 + sin(fp.y * 4.0 + u_time * 0.3), fp.y * 3.0 - u_time * 0.4)) * smoothstep(0.02, 0.5, fp.y) * rsmooth(0.35, 0.0, abs(fp.x - fp.y * 0.2));
    col = mix(col, vec3(0.12, 0.11, 0.1), smoothstep(0.45, 0.8, smoke) * 0.6);
    return col;
  }

  // City: three parallax rows of timber-framed gables with lit windows.
  for (int l = 2; l >= 0; l--) {
    float fl = float(l);
    float px = sp.x + u_time * 0.004 * (3.0 - fl) + fl * 0.37;
    float roof = gables(px, fl * 1.7, 0.42 - fl * 0.08 + (u_kind == 4 ? 0.02 : 0.0), 0.18 - fl * 0.03);
    if (y < roof) {
      vec3 wall = vec3(0.045, 0.038, 0.034) * (1.0 + fl * 0.35);
      // Half-timber beams on the nearest row.
      if (l == 0) {
        // Half-timbering: posts per house, one rail, a brace.
        float house = fract(px * 7.0);
        float beam = step(0.94, fract(house * 4.0)) + step(0.965, fract((y - roof) * 9.0 + 0.5)) * step(y, roof - 0.03);
        wall = mix(wall, vec3(0.018, 0.013, 0.01), clamp(beam, 0.0, 1.0) * 0.8);
      }
      // Windows.
      vec2 wg = vec2(px * (42.0 - fl * 8.0), y * (34.0 - fl * 6.0));
      vec2 wi = floor(wg), wf = fract(wg);
      float win = step(0.36, wf.x) * step(wf.x, 0.64) * step(0.3, wf.y) * step(wf.y, 0.7);
      float lit = step(0.8, hash(wi + fl * 11.0)) * step(y, roof - 0.05) * step(0.13, y);
      float wl = flick(hash(wi) * 50.0);
      vec3 winCol = vec3(1.0, 0.58, 0.22) * wl * (1.3 - fl * 0.35);
      wall = mix(wall, winCol, win * lit);
      col = wall;
      // Window glow spills onto the fog.
      col += vec3(1.0, 0.5, 0.2) * lit * 0.04 * (1.0 - win);
      // Atmospheric perspective.
      col = mix(col, vec3(0.06, 0.07, 0.11), fl * 0.25);
    }
    // Fog bank between rows.
    float fogH = 0.22 + fl * 0.06;
    col = mix(col, vec3(0.1, 0.11, 0.15), rsmooth(fogH + 0.1, fogH - 0.05, y) * 0.3 * fbm(vec2(sp.x * 4.0 + u_time * 0.02 * (fl + 1.0), fl)));
  }
  // Cobbles, wet with moonlight.
  if (y < 0.12) {
    vec2 cg = sp * vec2(60.0, 40.0);
    cg.x += floor(cg.y) * 0.5;
    vec2 cf = fract(cg) - 0.5;
    float stone = 1.0 - smoothstep(0.3, 0.5, length(cf));
    col = vec3(0.04, 0.04, 0.05) * (0.6 + 0.8 * stone * hash(floor(cg)));
    col += vec3(0.25, 0.28, 0.4) * stone * pow(max(0.0, 1.0 - abs(sp.x - mp.x) * 3.0), 3.0) * 0.15;
  }
  // Snowfall in two depths.
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 q = sp * vec2(1.78, 1.0) * (18.0 + fk * 14.0) + vec2(sin(u_time * 0.3 + fk) * 2.0, u_time * (1.5 + fk));
    vec2 qi = floor(q), qf = fract(q) - 0.5;
    vec2 off = vec2(hash(qi) - 0.5, hash(qi + 1.7) - 0.5) * 0.6;
    float flake = rsmooth(0.08 - fk * 0.03, 0.0, length(qf - off)) * step(0.55, hash(qi + 9.0));
    col += vec3(0.85, 0.87, 0.95) * flake * (0.6 - fk * 0.25);
  }
  return col;
}

void main() {
  vec2 sp = v_uv; // 0..1, y up
  vec2 uv = (v_uv - 0.5) * vec2(u_view.x / u_view.y, 1.0);
  vec3 col = (u_kind == 0 || u_kind == 2 || u_kind == 3) ? interior(uv) : exterior(uv, sp);
  // Filmic-ish tone curve so candle cores roll off gracefully.
  col = col / (1.0 + col * 0.35);
  o = vec4(col, 1.0);
}`;
