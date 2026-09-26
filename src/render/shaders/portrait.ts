/** GLSL ES 3.00 sources: portrait. */

/**
 * Character portraits: a raymarched bust (head, neck, shoulders, headwear) lit like a
 * candle-lit oil painting — warm key, coloured rim, cloth folds, painterly grain.
 * u_style: 0 hood, 1 coif (nun), 2 cap, 3 tall hat, 4 helm, 5 bare.
 *
 * The bust is built in three layers (UIX-0129 / ART-0044):
 *  - base: skull, jaw, shoulders, hair, beard and headwear — the character;
 *  - expression: brows, lids and mouth are shaped by one of eight faces (neutral, worried,
 *    stern, wry, afraid, grim, kind, pained), morphed between two faces by a blend value;
 *  - effects: pallor, flush and sweat beads on the skin, and the dark of an open mouth.
 * Blink and lip-flap ride on the expression layer (ART-0301).
 *
 * `Gfx.portrait()` exposes two scalar uniforms beyond the material set, so the rig packs its pose
 * into them (see src/art/portraitRig.ts `packPose`):
 *   u_talk   = mouth (0..1, fractional part) + blink×1 (0..15) + previous face×16 + next face×128
 *   u_active = lit (0..1) + 2 × round(blend × 99)
 * A legacy call with talk in 0..1 and active 1 therefore still reads as a lit, neutral bust.
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
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }

// ---- expression layer -------------------------------------------------------------------
// Per face: A = (brow raise, brow tilt [inner ends up > 0], eye openness, mouth curve [smile > 0]),
//           B = (mouth open, head tilt, pallor [< 0 flush], asymmetry [one brow / one corner]).
void faceParams(int e, out vec4 A, out vec4 B) {
  A = vec4(0.0, 0.0, 1.0, 0.0); B = vec4(0.0);
  if (e == 1) { A = vec4(0.55, 0.55, 1.0, -0.3); B = vec4(0.08, 0.05, 0.12, 0.0); }        // worried
  else if (e == 2) { A = vec4(-0.55, -0.6, 0.72, -0.4); B = vec4(0.0, 0.0, 0.0, 0.0); }    // stern
  else if (e == 3) { A = vec4(0.25, 0.0, 0.85, 0.5); B = vec4(0.0, -0.07, 0.0, 1.0); }     // wry
  else if (e == 4) { A = vec4(0.9, 0.7, 1.25, -0.5); B = vec4(0.45, 0.0, 0.6, 0.0); }     // afraid
  else if (e == 5) { A = vec4(-0.3, -0.3, 0.7, -0.6); B = vec4(0.0, 0.0, 0.25, 0.0); }    // grim
  else if (e == 6) { A = vec4(0.3, 0.2, 0.8, 0.6); B = vec4(0.05, 0.06, 0.0, 0.0); }      // kind
  else if (e == 7) { A = vec4(0.5, 0.8, 0.35, -0.7); B = vec4(0.35, 0.1, -0.4, 0.3); }    // pained
}
vec4 EA, EB;      // blended expression parameters
float g_mouthOpen; // expression + lip flap
float g_blink;     // 0 open .. 1 shut
float g_lit;       // 0..1 value multiplier (listener darken, fades)
float g_mouthD;    // distance to the mouth cavity at the hit point (for the dark of an open mouth)

void decodePose() {
  float pk = u_talk;
  float nx = floor(pk / 128.0); pk -= nx * 128.0;
  float pv = floor(pk / 16.0); pk -= pv * 16.0;
  float bl = floor(pk); pk -= bl;
  float mouth = clamp(pk, 0.0, 1.0);
  g_blink = bl / 15.0;
  float bq = floor(u_active / 2.0);
  g_lit = clamp(u_active - bq * 2.0, 0.0, 1.0);
  float blend = clamp(bq / 99.0, 0.0, 1.0);
  vec4 A0, B0, A1, B1;
  faceParams(int(pv), A0, B0);
  faceParams(int(nx), A1, B1);
  EA = mix(A0, A1, blend);
  EB = mix(B0, B1, blend);
  g_mouthOpen = max(EB.x, mouth);
}

// Material ids: 1 skin, 2 cloth, 3 headwear, 4 metal, 5 eyes, 6 hair
float map(vec3 p, out float m) {
  float breathe = sin(u_time * 1.3 + u_seed) * 0.01;
  float turn = sin(u_time * 0.35 + u_seed) * 0.12;
  vec3 hp = p - vec3(0.0, 0.56, 0.0);
  float c = cos(turn), s = sin(turn);
  hp.xz = mat2(c, -s, s, c) * hp.xz;
  // Head tilt (expression layer): a small roll about the neck.
  float tilt = EB.y;
  float ct = cos(tilt), st = sin(tilt);
  hp.xy = mat2(ct, -st, st, ct) * hp.xy;
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
  // Lids (expression layer): the upper lid slides down as the eye closes or the face blinks;
  // the lower lid rises for a squint.
  float open = clamp(EA.z, 0.0, 1.25) * (1.0 - g_blink);
  vec3 ep = vec3(abs(hp.x), hp.yz) - vec3(0.075, 0.02, 0.175);
  float upper = sdEll(ep - vec3(0.0, 0.004 + 0.03 * open, 0.006), vec3(0.034, 0.02, 0.028));
  float lower = sdEll(ep - vec3(0.0, -0.036 + 0.014 * (1.0 - min(open, 1.0)), 0.006), vec3(0.034, 0.018, 0.028));
  head = smin(head, min(upper, lower), 0.008);
  // Mouth (expression layer): a crease that curves with the mood, opens with speech.
  vec3 mp = hp - vec3(0.0, -0.14, 0.2);
  float side = mp.x > 0.0 ? 1.0 : 0.0;
  float curve = EA.w * mix(1.0, side, EB.w * 0.8);
  float mw = 0.05 * (1.0 + 0.15 * max(curve, 0.0));
  mp.y -= curve * 0.014 * (mp.x * mp.x) / (mw * mw);
  float mouth = sdEll(mp, vec3(mw, 0.006 + g_mouthOpen * 0.02, 0.03));
  g_mouthD = mouth;
  head = max(head, -mouth);
  float neck = sdCyl(p - vec3(0.0, 0.28, -0.02), 0.09, 0.1);
  // Shoulders and chest, rising with breath.
  vec3 bp = p - vec3(0.0, -0.05 + breathe, -0.05);
  float body = sdEll(bp, vec3(0.5, 0.22, 0.24));
  body = smin(body, sdEll(p - vec3(0.0, -0.45, -0.05), vec3(0.54, 0.42, 0.28)), 0.14);
  // Collar.
  body = smin(body, sdEll(p - vec3(0.0, 0.17, 0.0), vec3(0.2, 0.06, 0.16)), 0.05);
  float skin = smin(head, neck, 0.06);
  float d = skin; m = 1.0;
  if (body < d) { d = body; m = 2.0; }
  if (eyes < d) { d = eyes; m = 5.0; }
  // Hair and beards (material 6).
  float hair = 1e5;
  if (u_style == 5 || u_style == 2) hair = max(sdEll(hp - vec3(0.0, 0.05, -0.03), vec3(0.215, 0.27, 0.23)), -(hp.z - 0.06 + hp.y * 0.4)) - 0.008 * noise(hp.xy * 22.0);
  if (u_beard == 1) hair = min(hair, sdEll(hp - vec3(0.0, -0.17, 0.1), vec3(0.15, 0.14, 0.12)) - 0.01 * noise(hp.xy * 20.0));
  if (u_beard == 2) hair = min(hair, sdEll(hp - vec3(0.0, -0.21, 0.17), vec3(0.045, 0.07, 0.04)));
  if (u_beard == 2) hair = min(hair, sdCap(hp, vec3(-0.06, -0.1, 0.215), vec3(0.06, -0.1, 0.215), 0.012));
  if (u_beard == 3) hair = min(hair, sdEll(hp - vec3(0.0, -0.14, 0.09), vec3(0.155, 0.12, 0.13)) + 0.004);
  // Brows (expression layer): raised, knitted or one cocked, per side.
  for (int k = 0; k < 2; k++) {
    float sgn = k == 0 ? 1.0 : -1.0;
    vec3 bp2 = vec3(hp.x * sgn, hp.yz);
    float raise = EA.x + (k == 0 ? EB.w * 0.5 : -EB.w * 0.35);
    float inner = 0.075 + raise * 0.022 + EA.y * 0.018;
    float outer = 0.085 + raise * 0.02 - EA.y * 0.012;
    float knit = max(-EA.y, 0.0) * 0.012;
    hair = min(hair, sdCap(bp2, vec3(0.04 - knit, inner, 0.2), vec3(0.12, outer, 0.18), 0.012 + max(-EA.x, 0.0) * 0.003));
  }
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
  decodePose();
  vec2 uv = vec2(v_uv.x - 0.5, 0.62 - v_uv.y) * vec2(1.25, 1.55);
  vec3 ro = vec3(0.0, 0.45, 2.4);
  vec3 rd = normalize(vec3(uv.x, uv.y - 0.1, -1.9));
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
  float mouthD = g_mouthD; // from the hit sample, before the normal probes overwrite it
  vec3 n = nrm(p);
  // Albedo.
  vec3 alb = u_cloth;
  float rough = 0.8;
  if (m == 1.0) {
    alb = u_skin * (0.9 + 0.2 * fbm(p.xy * 30.0));
    // Effects layer: pallor drains the warmth, flush floods the cheeks.
    float pallor = EB.z;
    alb = mix(alb, mix(alb, vec3(0.62, 0.66, 0.68) * (0.6 + 0.6 * alb), 0.55), clamp(pallor, 0.0, 1.0));
    alb = mix(alb, alb * vec3(1.18, 0.78, 0.72), clamp(-pallor, 0.0, 1.0) * (0.5 + 0.5 * rsmooth(0.16, 0.0, abs(p.y - 0.5))));
    // The dark of an open mouth.
    alb = mix(vec3(0.16, 0.05, 0.05), alb, smoothstep(0.0, 0.012, mouthD + 0.004));
    rough = 0.5;
  }
  else if (m == 2.0) { alb = u_cloth * (0.75 + 0.35 * fbm(vec2(p.x * 8.0 + p.y * 3.0, p.y * 20.0))); }
  else if (m == 3.0) { alb = u_style == 1 ? vec3(0.64, 0.61, 0.55) * (0.9 + 0.15 * fbm(vec2(p.x * 14.0, p.y * 30.0))) : u_cloth * 0.8; rough = 0.95; }
  else if (m == 4.0) { alb = vec3(0.5, 0.5, 0.52); rough = 0.25; }
  else if (m == 5.0) {
    // A dark iris looking out, and whites that sit in the socket's shadow (never bright goggles).
    vec3 fwd = normalize(vec3(0.0, 0.0, 1.0));
    float iris = smoothstep(0.86, 0.93, dot(n, fwd));
    alb = mix(vec3(0.62, 0.58, 0.54), u_hair * 0.55 + vec3(0.06, 0.04, 0.03), iris);
    alb = mix(alb, vec3(0.03, 0.02, 0.02), smoothstep(0.975, 0.99, dot(n, fwd)));
    rough = 0.15;
  }
  else if (m == 6.0) { alb = u_hair * (0.55 + 0.6 * fbm(vec2(p.x * 48.0 + p.y * 6.0, p.y * 9.0)) + 0.18 * noise(vec2(p.x * 90.0, p.y * 12.0))); rough = 0.97; }
  // Candle key (warm, left-front), coloured rim (behind), faint fill.
  vec3 kl = normalize(vec3(-0.7, 0.45, 0.8));
  vec3 rl = normalize(vec3(0.8, 0.3, -0.7));
  float flick = 0.9 + 0.1 * sin(u_time * 8.3) * sin(u_time * 3.1);
  float key = max(dot(n, kl), 0.0);
  float wrap = max((dot(n, kl) + 0.4) / 1.4, 0.0);
  float ao = 0.0;
  for (int k = 1; k <= 5; k++) { float hk = 0.012 * float(k); ao += (hk - mapD(p + n * hk)) / hk; }
  ao = clamp(1.0 - ao * 0.22, 0.25, 1.0);
  // Chiaroscuro: a hard candle key that turns the far cheek into shadow (a little wrap on skin only).
  float lamb = m == 1.0 ? mix(key, wrap, 0.35) : key;
  lamb = smoothstep(0.0, 0.9, lamb);
  vec3 col = alb * vec3(1.0, 0.74, 0.48) * lamb * 1.3 * flick * ao;
  // The shadow side is cool and dim, as in candlelit oils.
  col += alb * vec3(0.05, 0.065, 0.1) * (1.0 - lamb) * ao;
  // Subsurface warmth on skin.
  if (m == 1.0) col += alb * vec3(0.45, 0.12, 0.07) * pow(1.0 - key, 2.0) * 0.18 * smoothstep(-0.2, 0.3, dot(n, kl));
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * max(dot(n, rl) + 0.3, 0.0);
  col += u_rim * rim * 1.6;
  col += alb * vec3(0.05, 0.06, 0.09) * ao;
  vec3 h = normalize(kl - rd);
  col += vec3(1.0, 0.85, 0.7) * pow(max(dot(n, h), 0.0), mix(12.0, 90.0, 1.0 - rough)) * (1.0 - rough) * 0.8;
  // Forms turn away into shadow at their edges, as a painter models volume.
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.55, dot(n, -rd)));
  // A catchlight in each eye: the candle, one bright point.
  if (m == 5.0) col += vec3(1.0, 0.9, 0.75) * pow(max(dot(n, h), 0.0), 220.0) * 1.6;
  // The body sinks into the dark below the collar, like a painted half-length.
  if (m == 2.0) col *= mix(0.25, 1.0, smoothstep(-0.55, 0.12, p.y));
  // Effects layer: sweat beads on a pale or pained brow catch the candle.
  float sweat = clamp(abs(EB.z) * 1.6 - 0.3, 0.0, 1.0);
  if (m == 1.0 && sweat > 0.0 && p.y > 0.6) {
    float bead = pow(noise(p.xy * 140.0 + u_seed), 9.0);
    col += vec3(1.0, 0.92, 0.8) * bead * 5.0 * sweat * pow(max(dot(n, h), 0.0), 8.0);
  }
  // Painterly grain and a soft falloff at the bottom of the bust.
  col *= 0.92 + 0.16 * fbm(v_uv * vec2(90.0, 120.0));
  float fade = rsmooth(0.98, 0.78, v_uv.y);
  // Listener darken (ART-0089: −35 % value) and entry/exit fades arrive as the lit value.
  col *= g_lit;
  o = vec4(col, fade);
}`;
