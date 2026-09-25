/** GLSL ES 3.00 sources: post. */

export const BRIGHT_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float l = max(max(c.r, c.g), c.b);
  o = vec4(c * smoothstep(u_threshold, 1.0, l), 1.0);
}`;

export const BLUR_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;
out vec4 o;
void main() {
  float w[5] = float[](0.227, 0.194, 0.121, 0.054, 0.016);
  vec3 c = texture(u_tex, v_uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(u_tex, v_uv + u_dir * float(i)).rgb * w[i];
    c += texture(u_tex, v_uv - u_dir * float(i)).rgb * w[i];
  }
  o = vec4(c, 1.0);
}`;

export const POST_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_time;
uniform float u_litany;
uniform float u_danger;
uniform float u_bloomAmt;
uniform vec2 u_shake;
uniform float u_flicker;
uniform float u_chroma;
uniform vec3 u_tint;
uniform vec3 u_lift;
uniform vec2 u_res;
uniform vec2 u_litanyCenter;
uniform float u_litanyAge;
uniform vec3 u_hurt; // xy: direction from screen centre, z: intensity
uniform sampler2D u_lutA;
uniform sampler2D u_lutB;
uniform float u_lutMix;
uniform vec4 u_lens; // xy centre (0..1, y up), z radius (fraction of height), w strength
out vec4 o;
// 32³ LUT stored as a 1024×32 strip; blue selects the slice, blended between neighbours.
vec3 lut(sampler2D t, vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float b = c.b * 31.0;
  float b0 = floor(b), b1 = min(b0 + 1.0, 31.0);
  vec2 uv0 = vec2((b0 * 32.0 + c.r * 31.0 + 0.5) / 1024.0, (c.g * 31.0 + 0.5) / 32.0);
  vec2 uv1 = vec2((b1 * 32.0 + c.r * 31.0 + 0.5) / 1024.0, uv0.y);
  return mix(texture(t, uv0).rgb, texture(t, uv1).rgb, b - b0);
}
// smoothstep with edge0 > edge1 is undefined in GLSL; this is the portable falling edge.
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Five-pointed star distance (for the Litany ripple).
float starShape(vec2 p) {
  float a = atan(p.y, p.x) + 1.5708;
  float seg = 6.28318 / 5.0;
  float m = mod(a, seg) - seg * 0.5;
  float r = length(p);
  return r * (0.75 + 0.35 * abs(m) / (seg * 0.5));
}
void main() {
  vec2 uv = v_uv + u_shake;
  float aspect = u_res.x / max(u_res.y, 1.0);
  // Litany: a star-shaped ripple radiates from where the sign was drawn; the world holds still.
  float lring = 0.0;
  if (u_litany > 0.0) {
    vec2 lp = (uv - u_litanyCenter) * vec2(aspect, 1.0);
    float sd = starShape(lp);
    float front = u_litanyAge * 0.9;
    lring = exp(-pow((sd - front) * 14.0, 2.0)) * exp(-u_litanyAge * 1.2);
    uv += normalize(lp + 1e-4) / vec2(aspect, 1.0) * lring * 0.012;
    uv += (uv - u_litanyCenter) * sin(sd * 40.0 - u_time * 3.0) * 0.002 * u_litany;
  }
  // Scrying Lens: a magnifying glass disc with barrel distortion and a fringe at the rim.
  float lensMask = 0.0;
  vec2 lensD = vec2(0.0);
  if (u_lens.w > 0.0) {
    lensD = (uv - u_lens.xy) * vec2(aspect, 1.0);
    float lr = length(lensD) / u_lens.z;
    lensMask = (1.0 - smoothstep(0.96, 1.0, lr)) * u_lens.w;
    uv = mix(uv, u_lens.xy + (uv - u_lens.xy) * (0.72 + 0.2 * lr * lr), lensMask);
  }
  vec3 c;
  // Chromatic aberration grows toward the frame edge (curses, trauma).
  float ca = u_chroma * 0.006 + 0.0006;
  vec2 dir = (uv - 0.5) * ca;
  c.r = texture(u_scene, uv + dir).r;
  c.g = texture(u_scene, uv).g;
  c.b = texture(u_scene, uv - dir).b;
  c += texture(u_bloom, uv).rgb * u_bloomAmt;
  // Per-chapter grade.
  c = c * u_tint + u_lift;

  if (lensMask > 0.0) {
    float lr = length(lensD) / u_lens.z;
    // Blue scry-tint, fringe at the rim, a rotating scan sweep.
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 scry = vec3(lum * 0.75, lum * 0.95, lum * 1.25) + vec3(0.02, 0.04, 0.08);
    float ang = atan(lensD.y, lensD.x);
    float sweep = pow(max(0.0, cos(ang - u_time * 2.5)), 24.0) * (1.0 - lr) * 0.35;
    c = mix(c, scry + vec3(0.5, 0.75, 1.0) * sweep, lensMask * 0.75);
    float rim = smoothstep(0.86, 0.97, lr) * (1.0 - smoothstep(0.97, 1.02, lr));
    c += vec3(0.9, 0.7, 0.35) * rim * u_lens.w * 0.8;
    c.r += smoothstep(0.8, 1.0, lr) * lensMask * 0.12;
    c.b += smoothstep(0.7, 0.95, lr) * lensMask * 0.1;
  }
  // LUT grade, crossfading between two looks.
  c = mix(lut(u_lutA, c), lut(u_lutB, c), u_lutMix);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c *= 1.0 - u_flicker * 0.05;

  if (u_litany > 0.0) {
    // Sepia, but gold highlights survive — the Litany gilds what it touches.
    vec3 sepia = vec3(l * 1.1, l * 0.95, l * 0.7) + vec3(0.06, 0.04, 0.0);
    float keep = smoothstep(0.55, 0.9, l);
    vec3 gilded = mix(sepia, c * vec3(1.15, 0.95, 0.55), keep);
    c = mix(c, gilded, u_litany * 0.75);
    c += vec3(1.0, 0.8, 0.4) * lring * 0.6;
  }

  vec2 vq = v_uv - 0.5;
  float vig = rsmooth(0.85, 0.25, length(vq * vec2(1.0, 0.8)));
  c *= mix(0.35, 1.0, vig);
  // Failing vitals: the edges pulse red.
  c = mix(c, vec3(0.5, 0.0, 0.02), (1.0 - vig) * u_danger * (0.5 + 0.5 * sin(u_time * 6.0)));
  // Damage: a red flash from the edge nearest the wound.
  if (u_hurt.z > 0.0) {
    vec2 hd = normalize(u_hurt.xy + 1e-4);
    float side = max(dot(normalize(vq * vec2(aspect, 1.0) + 1e-4), hd), 0.0);
    float edgeW = smoothstep(0.25, 0.75, length(vq * vec2(1.0, 0.8)));
    c = mix(c, vec3(0.6, 0.02, 0.03), clamp(u_hurt.z, 0.0, 1.0) * edgeW * (0.35 + 0.65 * side) * 0.8);
  }

  c += (hash(v_uv * 900.0 + u_time) - 0.5) * 0.035;
  o = vec4(c, 1.0);
}`;
