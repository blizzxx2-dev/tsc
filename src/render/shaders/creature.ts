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

vec4 matins(vec2 p) {
  float t = u_time * 0.6 + u_seed;
  // Domain-warped ink.
  vec2 q = vec2(fbm(p * 2.0 + t * 0.3), fbm(p * 2.0 - t * 0.25 + 4.0));
  vec2 r = vec2(fbm(p * 2.5 + q * 2.0 + t * 0.2), fbm(p * 2.5 + q * 2.0 + 9.0));
  float ang = atan(p.y, p.x);
  float rad = length(p);
  // Tendrils reach out and curl.
  float tend = pow(max(0.0, sin(ang * 7.0 + fbm(p * 3.0 + t) * 4.0 + t * 0.7)), 6.0) * (0.25 + 0.2 * fbm(vec2(ang * 3.0, t)));
  float body = 0.42 * (0.7 + 0.3 * u_health) + tend * (1.0 - rad * 0.6) + (r.x - 0.5) * 0.18;
  float mask = rsmooth(body + 0.02, body - 0.04, rad);
  // Dissolve to ash from the edge inward.
  float ash = fbm(p * 6.0 + 3.0);
  mask *= step(u_dissolve * 1.3, ash + (1.0 - rad) * 0.4);
  float ember = u_dissolve > 0.0 ? rsmooth(0.08, 0.0, abs(ash + (1.0 - rad) * 0.4 - u_dissolve * 1.3)) : 0.0;
  vec3 ink = mix(vec3(0.03, 0.01, 0.05), vec3(0.2, 0.06, 0.28), r.y);
  ink += vec3(0.35, 0.1, 0.45) * pow(q.x, 3.0) * 0.8;
  // Gold-leaf sigil glints drifting in the ink.
  vec2 sg = p * 9.0 + r * 3.0;
  float glint = smoothstep(0.9, 0.98, noise(sg + t * 0.5)) * (0.6 + 0.4 * sin(t * 5.0 + sg.x));
  ink += vec3(1.0, 0.78, 0.3) * glint * 0.9;
  // Rim light.
  ink += vec3(0.6, 0.3, 0.9) * smoothstep(body - 0.12, body, rad) * 0.5;
  // The eye.
  float eye = 0.0;
  if (u_open > 0.01) {
    vec2 ep = p * vec2(1.0, 1.0 / max(u_open, 0.05));
    float lid = length(ep * vec2(0.9, 1.8));
    float white = rsmooth(0.24, 0.2, lid);
    vec2 look = vec2(sin(t * 0.8) * 0.05, cos(t * 0.6) * 0.02);
    float iris = rsmooth(0.1, 0.085, length(p - look));
    float pupil = rsmooth(0.035, 0.02, length((p - look) * vec2(2.2, 0.8)));
    vec3 eyeCol = mix(vec3(0.85, 0.8, 0.7), vec3(0.55, 0.05, 0.1) * (0.6 + 0.8 * fbm(p * 30.0)), iris);
    eyeCol = mix(eyeCol, vec3(0.0), pupil);
    eyeCol += vec3(1.0) * rsmooth(0.02, 0.0, length(p - look - vec2(-0.03, 0.03))) * 0.8;
    ink = mix(ink, eyeCol, white);
    eye = white;
  }
  ink = mix(ink, vec3(1.0, 0.7, 0.4), u_flash * 0.6);
  vec3 col = ink + vec3(1.0, 0.5, 0.15) * ember * 3.0;
  float a = max(mask, ember);
  // Shadow halo cast on the flesh.
  float halo = rsmooth(body + 0.16, body - 0.05, rad) * 0.45;
  return vec4(col * a, max(a, halo * (1.0 - u_dissolve)));
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
