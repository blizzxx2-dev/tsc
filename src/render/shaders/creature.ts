/** GLSL ES 3.00 sources: creature. */

/**
 * Creature/effect shader drawn into a rect around an entity. v_uv 0..1 over the rect.
 * u_mode: 0 Malison of Matins (living ink + eye), 1 Malison of Lauds (singing core),
 * 2 hexfire flames, 3 hexstone crystal glow.
 */
export const CREATURE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform int u_mode;
uniform float u_time;
uniform float u_seed;
uniform float u_open;     // eye openness / exposure 0..1
uniform float u_health;   // 0..1
uniform float u_flash;    // hit flash 0..1
uniform float u_dissolve; // 0 alive .. 1 ash
uniform float u_intensity;
out vec4 o;
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = OCT * p + 17.1; a *= 0.5; } return v; }

// Matins (ART-0230–0232): a shrouded vigil-mass of candle-wax cloth with one great lidded eye.
// Flipbooks: idle breathing 12 frames (2.4 s), eye open/close 10 frames (u_open quantised).
// Phase degradation by u_health: intact > 0.66 > torn (holes onto the ink within) > 0.33 > shredded.
// VFX: the cloth distorts in a slow wobble (stronger as it degrades), the iris glow ramps with the
// eye's opening, and the lamp's surround darkens on the watching rhythm (Malison.watching → post spot.k).
vec4 matins(vec2 p) {
  float t = u_time + u_seed;
  float stage = u_health > 0.66 ? 0.0 : u_health > 0.33 ? 1.0 : 2.0;
  // Breathing: 12 held frames per 2.4 s cycle.
  float fb = floor(fract(t / 2.4) * 12.0) / 12.0;
  float breath = sin(fb * 6.2831853);
  // Cloth distortion: a travelling wobble of the whole shroud.
  float wob = 0.012 * (1.0 + stage * 0.6);
  vec2 q = p + wob * vec2(sin(p.y * 13.0 + t * 1.9), cos(p.x * 11.0 + t * 1.6));
  q.y -= 0.02 * breath;
  q *= 1.0 - 0.025 * breath;
  float ang = atan(q.y, q.x);
  float rad = length(q * vec2(1.0, 0.92));
  // Silhouette: a hooded mass, broader at the hem, whose hem hangs in scalloped folds.
  float low = rsmooth(0.1, -0.35, q.y);
  float body = 0.33 + 0.06 * low + 0.025 * sin(ang * 9.0 + fbm(q * 3.0) * 2.0) * low - 0.02 * (1.0 - u_health);
  // Shredded hem: strips of cloth hang lower between the tears.
  float strips = stage > 1.5 ? max(0.0, sin(q.x * 38.0 + fbm(q * 5.0) * 4.0)) * 0.1 * low : 0.0;
  float d = rad - body - strips;
  float mask = rsmooth(0.012, -0.012, d);
  // Trailing threads of the woven body below the hem.
  float thr = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x0 = (fi - 2.0) * 0.07 + 0.02 * sin(t * 0.7 + fi);
    float yy = q.y + 0.3;
    float line = abs(q.x - x0 - 0.03 * sin(yy * 14.0 + t * 1.3 + fi)) - 0.0035;
    thr = max(thr, rsmooth(0.004, 0.0, line) * smoothstep(-0.46, -0.3, q.y) * rsmooth(-0.2, -0.3, q.y));
  }
  // Candle-wax cloth: tallow ivory, folds falling from the hood, soot in the creases.
  // Folds fan out from the hood and loosen toward the hem; creases are narrow, the cloth between broad.
  float fw = fbm(q * vec2(2.5, 1.0) + 3.0);
  float folds = 0.5 + 0.5 * sin(q.x * (14.0 + 8.0 * low) + fw * 5.0 + q.y * 3.0);
  float crease = pow(1.0 - folds, 3.0);
  vec3 wax = mix(vec3(0.66, 0.6, 0.48), vec3(0.84, 0.78, 0.64), fbm(q * 7.0));
  wax = mix(wax, vec3(0.42, 0.36, 0.3), smoothstep(0.55, 0.8, fbm(q * 3.0 + 11.0)) * 0.5); // grime and soot
  vec3 cloth = wax * (0.78 + 0.22 * folds);
  cloth = mix(cloth, vec3(0.14, 0.1, 0.1), crease * 0.45);
  // Lit from the surgeon's lamp (top-left), dark at the hem.
  cloth *= 0.55 + 0.6 * clamp(0.5 + dot(normalize(q + 0.0001), vec2(-0.5, 0.7)) * 0.5, 0.0, 1.0) * rsmooth(0.4, 0.0, -q.y + 0.1);
  // Wax drips run down from the hood: each column has its own length and a bulbous head.
  float col = floor((q.x + 0.5) * 36.0);
  float dl = 0.08 + 0.2 * hash(vec2(col, 3.0)) + 0.08 * stage;
  float cx = (col + 0.5) / 36.0 - 0.5;
  float dx = abs(q.x - cx);
  float top = body * 0.8;
  float dOn = step(0.72, hash(vec2(col, 7.0)));
  float drip = dOn * rsmooth(0.01, 0.005, dx) * smoothstep(top - dl, top - dl + 0.02, q.y) * step(q.y, top);
  float dhead = dOn * rsmooth(0.016, 0.011, length(vec2(q.x - cx, (q.y - (top - dl)) * 0.8)));
  float dripA = max(drip, dhead);
  // Drips are raised wax: a lit left edge and a soft shadow on the right.
  cloth = mix(cloth, vec3(0.92, 0.88, 0.74) * (0.85 + 0.3 * clamp((cx - q.x) / 0.01, -1.0, 1.0)), dripA * 0.55);
  // Curse-violet seams: the woven threads show through where the cloth is thin.
  float seam = rsmooth(0.02, 0.0, abs(fract(q.x * 9.0 + fbm(q * 4.0) * 1.5) - 0.5) - 0.46);
  cloth += vec3(0.5, 0.18, 0.75) * seam * 0.35 * (0.6 + 0.4 * sin(t * 2.0));
  // Torn state: holes in the shroud onto the living ink within.
  float holes = stage > 0.5 ? smoothstep(0.66 - 0.1 * stage, 0.7 - 0.1 * stage, fbm(q * 6.0 + 17.0)) : 0.0;
  vec2 iq = vec2(fbm(q * 3.0 + t * 0.3), fbm(q * 3.0 - t * 0.25 + 4.0));
  vec3 ink = mix(vec3(0.03, 0.01, 0.05), vec3(0.3, 0.08, 0.42), fbm(q * 4.0 + iq * 2.0));
  ink += vec3(1.0, 0.78, 0.3) * smoothstep(0.9, 0.98, noise(q * 16.0 + iq * 3.0 + t * 0.5)) * 0.7;
  float holeRim = holes * (1.0 - smoothstep(0.7 - 0.1 * stage, 0.74 - 0.1 * stage, fbm(q * 6.0 + 17.0)));
  cloth = mix(cloth, ink, holes);
  cloth = mix(cloth, vec3(0.25, 0.1, 0.05), holeRim * 0.8);

  // The great eye: almond aperture under two waxen lids; 10-frame open/close.
  float open = floor(clamp(u_open, 0.0, 1.0) * 9.0 + 0.5) / 9.0;
  vec2 ep = q - vec2(0.0, 0.05);
  float lidH = 0.1 * open;
  float almond = abs(ep.y) - lidH * (1.0 - pow(clamp(abs(ep.x) / 0.19, 0.0, 1.0), 2.0));
  float eyeIn = rsmooth(0.004, -0.004, almond) * step(abs(ep.x), 0.19);
  // Closed: the lid seam, stitched shut with gut thread.
  float seamLine = rsmooth(0.005, 0.001, abs(ep.y) ) * step(abs(ep.x), 0.19) * (1.0 - eyeIn);
  // Cross-stitches: short slanted gut threads across the seam.
  float sx = fract(ep.x * 16.0 + ep.y * 6.0) - 0.5;
  float stitches = rsmooth(0.07, 0.03, abs(sx)) * rsmooth(0.028, 0.02, abs(ep.y)) * step(abs(ep.x), 0.16) * (1.0 - open);
  cloth = mix(cloth, vec3(0.12, 0.06, 0.05), seamLine * 0.8);
  cloth = mix(cloth, vec3(0.55, 0.42, 0.26), stitches * 0.85);
  // Lids: swollen wax folds around the aperture.
  float lid = rsmooth(0.035, 0.0, almond) * (1.0 - eyeIn) * step(abs(ep.x), 0.21);
  cloth *= 1.0 - lid * 0.25;
  vec3 eyeCol = vec3(0.0);
  if (eyeIn > 0.0) {
    vec2 look = vec2(sin(t * 0.8) * 0.04, cos(t * 0.6) * 0.012) * open;
    float ir = length(ep - look);
    // Sclera: yellowed wax; bloodshot once shredded.
    vec3 sclera = vec3(0.86, 0.8, 0.62) * (0.7 + 0.3 * rsmooth(lidH, 0.0, abs(ep.y)));
    float vein = pow(1.0 - abs(fbm(ep * 30.0) * 2.0 - 1.0), 10.0) * (0.25 + 0.4 * stage);
    sclera = mix(sclera, vec3(0.6, 0.05, 0.05), vein);
    // Iris glow ramp: a dull ember when barely open, a blazing red-gold when fully open.
    vec3 irisLo = vec3(0.35, 0.05, 0.06);
    vec3 irisHi = vec3(1.0, 0.55, 0.15);
    float ramp = smoothstep(0.2, 1.0, open);
    vec3 iris = mix(irisLo, irisHi, ramp) * (0.7 + 0.5 * fbm(vec2(atan(ep.y - look.y, ep.x - look.x) * 3.0, ir * 40.0)));
    iris += irisHi * ramp * 0.6 * rsmooth(0.07, 0.02, ir);
    float irisM = rsmooth(0.085, 0.078, ir);
    // Pupil: a vertical slit that narrows as the eye opens.
    float pw = mix(0.03, 0.009, ramp);
    float pupil = rsmooth(1.0, 0.8, length((ep - look) / vec2(pw, 0.06)));
    eyeCol = mix(sclera, iris, irisM);
    eyeCol = mix(eyeCol, vec3(0.0), pupil);
    eyeCol += vec3(1.0) * rsmooth(0.014, 0.0, length(ep - look - vec2(-0.025, 0.025))) * 0.8;
    cloth = mix(cloth, eyeCol, eyeIn);
  }
  cloth = mix(cloth, vec3(1.0, 0.7, 0.4), u_flash * 0.6);
  // Dissolve to ash from the edge inward.
  float ash = fbm(p * 6.0 + 3.0);
  mask *= step(u_dissolve * 1.3, ash + (1.0 - rad) * 0.4);
  float ember = u_dissolve > 0.0 ? rsmooth(0.08, 0.0, abs(ash + (1.0 - rad) * 0.4 - u_dissolve * 1.3)) : 0.0;
  vec3 colr = cloth + vec3(1.0, 0.5, 0.15) * ember * 3.0;
  float a = max(mask, ember);
  vec4 res = vec4(colr * a, a);
  // Threads beneath, then the shadow halo cast on the flesh.
  res = res + vec4(vec3(0.45, 0.2, 0.6) * thr, thr) * (1.0 - res.a) * (1.0 - u_dissolve);
  float halo = rsmooth(body + 0.16, body - 0.05, rad) * 0.45;
  return vec4(res.rgb, max(res.a, halo * (1.0 - u_dissolve)));
}

vec4 lauds(vec2 p) {
  float t = u_time + u_seed;
  float rad = length(p), ang = atan(p.y, p.x);
  float body = 0.3 * (0.75 + 0.25 * u_health) + 0.02 * sin(ang * 5.0 + t * 3.0);
  float mask = rsmooth(body + 0.02, body - 0.03, rad);
  // Pale, pearly flesh with organ-pipe ribs singing outward.
  float ribs = pow(abs(sin(ang * 12.0 + fbm(p * 4.0) * 2.0)), 8.0);
  vec3 c = mix(vec3(0.55, 0.45, 0.6), vec3(0.9, 0.8, 0.95), fbm(p * 5.0 + t * 0.2)) * (0.6 + 0.4 * ribs);
  // The singing mouth: a dark rhythmic aperture.
  float sing = 0.5 + 0.5 * sin(t * 5.0);
  float mouth = rsmooth(0.1 + 0.05 * sing, 0.06, length(p * vec2(1.0, 2.2 - sing)));
  c = mix(c, vec3(0.05, 0.0, 0.03), mouth);
  c = mix(c, vec3(1.0, 0.6, 0.3), u_open * 0.35 * (0.5 + 0.5 * sin(t * 12.0)));
  c = mix(c, vec3(1.0, 0.8, 0.5), u_flash * 0.6);
  // Halo rings of sound.
  float rings = 0.0;
  for (int i = 0; i < 3; i++) {
    float rr = fract(t * 0.35 + float(i) / 3.0) * 0.5 + body;
    rings += rsmooth(0.012, 0.0, abs(rad - rr)) * (1.0 - fract(t * 0.35 + float(i) / 3.0));
  }
  vec3 col = c * mask + vec3(0.85, 0.7, 1.0) * rings * 0.8;
  return vec4(col, max(mask, rings * 0.8));
}

vec4 hexfire(vec2 p) {
  float t = u_time * 1.4 + u_seed;
  float rad = length(p * vec2(1.0, 0.8));
  // Flame tongues rise (screen up = +y in p).
  vec2 fq = vec2(p.x * 3.0, p.y * 2.0 - t);
  float n = fbm(fq + fbm(fq * 1.5 + t * 0.5));
  float flame = smoothstep(0.5, 0.9, n + (0.3 - rad) * 2.2) * 0.75;
  vec3 c = mix(vec3(0.3, 0.04, 0.5), vec3(0.8, 0.45, 0.95), smoothstep(0.6, 1.1, n + (0.3 - rad)));
  c = mix(c, vec3(0.4, 1.0, 0.7), smoothstep(0.85, 1.0, n) * 0.25);
  float a = flame * u_intensity;
  return vec4(c * a, a * 0.8);
}

vec4 crystal(vec2 p) {
  float t = u_time + u_seed;
  float rad = length(p);
  float pulse = 0.6 + 0.4 * sin(t * 4.0);
  float glow = exp(-rad * 6.0) * pulse * u_intensity;
  vec3 c = mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.85, 0.4), exp(-rad * 12.0));
  return vec4(c * glow, glow * 0.8);
}

void main() {
  vec2 p = (v_uv - 0.5) * vec2(1.0, -1.0);
  vec4 r;
  if (u_mode == 0) r = matins(p);
  else if (u_mode == 1) r = lauds(p);
  else if (u_mode == 2) r = hexfire(p);
  else r = crystal(p);
  // Everything fades out before the quad's border so no rectangle edge ever shows.
  float edge = rsmooth(0.5, 0.36, max(abs(p.x), abs(p.y)));
  o = r * edge;
}`;
