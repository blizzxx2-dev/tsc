/** GLSL ES 3.00 sources: portrait. */

/**
 * Character portraits: a raymarched bust (head, neck, shoulders, headwear) lit like a
 * candle-lit oil painting — warm key, coloured rim, cloth folds, painterly grain.
 * u_style: 0 hood, 1 coif (nun), 2 cap, 3 tall hat, 4 helm, 5 bare.
 */
export const PORTRAIT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform int u_style;
uniform vec3 u_rim;
uniform vec3 u_cloth;
uniform vec3 u_skin;
uniform float u_active;
uniform float u_seed;
uniform float u_talk;
uniform int u_beard;
uniform vec3 u_hair;
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 3.7; a *= 0.5; } return v; }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }

// Material ids: 1 skin, 2 cloth, 3 headwear, 4 metal, 5 eyes
float map(vec3 p, out float m) {
  float breathe = sin(u_time * 1.3 + u_seed) * 0.01;
  float turn = sin(u_time * 0.35 + u_seed) * 0.12;
  vec3 hp = p - vec3(0.0, 0.56, 0.0);
  float c = cos(turn), s = sin(turn);
  hp.xz = mat2(c, -s, s, c) * hp.xz;
  // Head: skull + jaw + nose + brow.
  float head = sdEll(hp, vec3(0.2, 0.25, 0.22));
  head = smin(head, sdEll(hp - vec3(0.0, -0.12, 0.05), vec3(0.15, 0.13, 0.16)), 0.08);
  head = smin(head, sdCap(hp, vec3(0.0, 0.0, 0.2), vec3(0.0, -0.08, 0.25), 0.025), 0.03);
  head = smin(head, sdEll(hp - vec3(0.0, 0.07, 0.15), vec3(0.16, 0.04, 0.07)), 0.03);
  // Cheekbones and ears.
  head = smin(head, sdEll(vec3(abs(hp.x), hp.yz) - vec3(0.1, -0.03, 0.14), vec3(0.06, 0.04, 0.05)), 0.04);
  head = smin(head, sdEll(vec3(abs(hp.x), hp.yz) - vec3(0.2, 0.0, 0.0), vec3(0.025, 0.06, 0.04)), 0.02);
  // Eye sockets.
  float sockets = min(length(hp - vec3(0.075, 0.02, 0.19)), length(hp - vec3(-0.075, 0.02, 0.19))) - 0.035;
  head = max(head, -sockets * 1.0 + 0.004);
  float eyes = min(length(hp - vec3(0.075, 0.02, 0.175)), length(hp - vec3(-0.075, 0.02, 0.175))) - 0.022;
  // Mouth crease (opens slightly when talking).
  float mouth = sdEll(hp - vec3(0.0, -0.14, 0.2), vec3(0.05, 0.006 + u_talk * 0.012, 0.03));
  head = max(head, -mouth);
  float neck = sdCyl(p - vec3(0.0, 0.28, -0.02), 0.09, 0.1);
  // Shoulders and chest, rising with breath.
  vec3 bp = p - vec3(0.0, -0.05 + breathe, -0.05);
  float body = sdEll(bp, vec3(0.62, 0.26, 0.26));
  body = smin(body, sdEll(p - vec3(0.0, -0.45, -0.05), vec3(0.64, 0.42, 0.3)), 0.12);
  // Collar.
  body = smin(body, sdEll(p - vec3(0.0, 0.17, 0.0), vec3(0.2, 0.06, 0.16)), 0.05);
  float skin = smin(head, neck, 0.06);
  float d = skin; m = 1.0;
  if (body < d) { d = body; m = 2.0; }
  if (eyes < d) { d = eyes; m = 5.0; }
  // Hair and beards (material 6).
  float hair = 1e5;
  if (u_style == 5 || u_style == 2) hair = max(sdEll(hp - vec3(0.0, 0.05, -0.03), vec3(0.215, 0.27, 0.23)), -(hp.z - 0.06 + hp.y * 0.4)) - 0.012 * noise(hp.xy * 60.0);
  if (u_beard == 1) hair = min(hair, sdEll(hp - vec3(0.0, -0.17, 0.1), vec3(0.15, 0.14, 0.12)) - 0.015 * noise(hp.xy * 50.0));
  if (u_beard == 2) hair = min(hair, sdEll(hp - vec3(0.0, -0.21, 0.17), vec3(0.045, 0.07, 0.04)));
  if (u_beard == 2) hair = min(hair, sdCap(hp, vec3(-0.06, -0.1, 0.215), vec3(0.06, -0.1, 0.215), 0.012));
  if (u_beard == 3) hair = min(hair, sdEll(hp - vec3(0.0, -0.14, 0.09), vec3(0.155, 0.12, 0.13)) + 0.004);
  // Brows.
  hair = min(hair, sdCap(vec3(abs(hp.x), hp.yz), vec3(0.04, 0.075, 0.2), vec3(0.12, 0.085, 0.18), 0.012));
  if (hair < d) { d = hair; m = 6.0; }
  // Headwear.
  float hw = 1e5;
  if (u_style == 0) { // deep hood
    float outer = sdEll(hp - vec3(0.0, 0.03, -0.03), vec3(0.3, 0.34, 0.31));
    float inner = sdEll(hp - vec3(0.0, 0.0, 0.1), vec3(0.23, 0.28, 0.3));
    hw = max(outer, -inner);
    hw = smin(hw, sdEll(p - vec3(0.0, 0.25, -0.08), vec3(0.34, 0.22, 0.26)), 0.08);
  } else if (u_style == 1) { // nun's coif and veil
    float outer = sdEll(hp - vec3(0.0, 0.02, -0.02), vec3(0.26, 0.3, 0.27));
    float face = sdEll(hp - vec3(0.0, -0.02, 0.14), vec3(0.16, 0.22, 0.2));
    hw = max(outer, -face);
    hw = smin(hw, sdEll(p - vec3(0.0, 0.3, -0.1), vec3(0.34, 0.3, 0.2)), 0.1);
    float band = sdEll(hp - vec3(0.0, 0.14, 0.03), vec3(0.23, 0.05, 0.22));
    hw = min(hw, band);
  } else if (u_style == 2) { // physician's soft cap
    hw = sdEll(hp - vec3(0.0, 0.2, -0.02), vec3(0.24, 0.1, 0.24));
  } else if (u_style == 3) { // tall witch-hunter hat with brim
    hw = sdCyl(hp - vec3(0.0, 0.33, -0.01), 0.18, 0.16);
    hw = min(hw, sdCyl(hp - vec3(0.0, 0.18, -0.01), 0.42, 0.012));
  } else if (u_style == 4) { // kettle helm
    hw = sdEll(hp - vec3(0.0, 0.14, 0.0), vec3(0.25, 0.17, 0.25));
    hw = min(hw, sdCyl(hp - vec3(0.0, 0.07, 0.0), 0.36, 0.01));
  }
  if (hw < d) { d = hw; m = u_style == 4 ? 4.0 : 3.0; }
  return d;
}
float mapD(vec3 p) { float m; return map(p, m); }
vec3 nrm(vec3 p) { vec2 e = vec2(0.002, 0.0); return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx))); }

void main() {
  vec2 uv = vec2(v_uv.x - 0.5, 0.62 - v_uv.y) * vec2(1.25, 1.55);
  vec3 ro = vec3(0.0, 0.45, 2.4);
  vec3 rd = normalize(vec3(uv, 0.0) - vec3(0.0, 0.0, 1.95) + vec3(0.0, 0.0, 0.0));
  rd = normalize(vec3(uv.x, uv.y - 0.1, -1.9));
  float t = 0.0, m = 0.0;
  bool hit = false;
  for (int i = 0; i < 80; i++) {
    float d = map(ro + rd * t, m);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 5.0) break;
  }
  if (!hit) { o = vec4(0.0); return; }
  vec3 p = ro + rd * t;
  vec3 n = nrm(p);
  // Albedo.
  vec3 alb = u_cloth;
  float rough = 0.8;
  if (m == 1.0) { alb = u_skin * (0.9 + 0.2 * fbm(p.xy * 30.0)); rough = 0.5; }
  else if (m == 2.0) { alb = u_cloth * (0.75 + 0.35 * fbm(vec2(p.x * 8.0 + p.y * 3.0, p.y * 20.0))); }
  else if (m == 3.0) { alb = u_style == 1 ? vec3(0.8, 0.78, 0.72) : u_cloth * 0.8; }
  else if (m == 4.0) { alb = vec3(0.5, 0.5, 0.52); rough = 0.25; }
  else if (m == 5.0) { alb = vec3(0.9, 0.88, 0.85); rough = 0.1; }
  else if (m == 6.0) { alb = u_hair * (0.7 + 0.5 * noise(vec2(p.x * 200.0, p.y * 40.0))); rough = 0.6; }
  // Candle key (warm, left-front), coloured rim (behind), faint fill.
  vec3 kl = normalize(vec3(-0.7, 0.45, 0.8));
  vec3 rl = normalize(vec3(0.8, 0.3, -0.7));
  float flick = 0.9 + 0.1 * sin(u_time * 8.3) * sin(u_time * 3.1);
  float key = max(dot(n, kl), 0.0);
  float wrap = max((dot(n, kl) + 0.4) / 1.4, 0.0);
  float ao = 0.0;
  for (int k = 1; k <= 5; k++) { float hk = 0.012 * float(k); ao += (hk - mapD(p + n * hk)) / hk; }
  ao = clamp(1.0 - ao * 0.22, 0.25, 1.0);
  vec3 col = alb * vec3(1.0, 0.72, 0.45) * (m == 1.0 ? wrap : key) * 1.25 * flick * ao;
  // Subsurface warmth on skin.
  if (m == 1.0) col += alb * vec3(0.6, 0.15, 0.08) * pow(1.0 - key, 2.0) * 0.35;
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * max(dot(n, rl) + 0.3, 0.0);
  col += u_rim * rim * 1.6;
  col += alb * vec3(0.05, 0.06, 0.09) * ao;
  vec3 h = normalize(kl - rd);
  col += vec3(1.0, 0.85, 0.7) * pow(max(dot(n, h), 0.0), mix(12.0, 90.0, 1.0 - rough)) * (1.0 - rough) * 0.8;
  // Painterly grain and a soft falloff at the bottom of the bust.
  col *= 0.92 + 0.16 * fbm(v_uv * vec2(90.0, 120.0));
  float fade = 1.0 - smoothstep(0.78, 0.98, v_uv.y);
  col *= mix(0.45, 1.0, u_active);
  o = vec4(col, fade);
}`;
