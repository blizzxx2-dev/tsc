/** GLSL ES 3.00 shader sources for the WebGL2 renderer. */

export const PRIM_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_col;
uniform vec2 u_view;
out vec2 v_uv;
out vec4 v_col;
void main() {
  v_uv = a_uv;
  v_col = a_col;
  vec2 c = a_pos / u_view * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

export const PRIM_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_col;
uniform sampler2D u_tex;
out vec4 o;
void main() {
  // The atlas stores glyph coverage in alpha; texel (0,0) is solid white for untextured shapes.
  vec4 t = texture(u_tex, v_uv);
  o = vec4(v_col.rgb, v_col.a * t.a);
}`;

/** Fullscreen triangle; v_uv spans 0..1 over the viewport. */
export const FULL_VS = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
// Distance to nearest cell edge: membranes, alveoli, fat lobules.
float cells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
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
out vec4 o;
${NOISE}
void main() {
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_view;
  vec2 q = (px - u_center) / u_radii;
  // Organs swell faintly with the heartbeat.
  float swell = 1.0 + u_pulse * 0.012;
  float r = length(q) / swell;
  float edge = r + (fbm(q * 3.0 + 4.0) - 0.5) * 0.08;

  // ---- drape (outside the opening)
  vec2 w = px * 0.5;
  float weave = 0.5 + 0.25 * sin(w.x * 3.1) * sin(w.y * 3.1) + 0.25 * fbm(px * 0.02);
  vec3 drape = mix(vec3(0.10, 0.12, 0.11), vec3(0.2, 0.23, 0.2), weave);
  drape *= 0.55 + 0.45 * smoothstep(900.0, 200.0, length(px - u_light));
  // Old bloodstains on the linen.
  drape = mix(drape, vec3(0.18, 0.04, 0.04), smoothstep(0.62, 0.72, fbm(px * 0.006 + 3.0)) * 0.6);

  // ---- flesh
  vec2 uv = q * 4.0;
  float n = fbm(uv + vec2(0.0, u_time * 0.02));
  vec3 col = mix(u_deep, u_base, smoothstep(0.2, 0.85, n));
  float c = 0.0;
  if (u_kind == 2) { c = cells(uv * 2.5); col *= 0.75 + 0.35 * smoothstep(0.0, 0.25, c); }
  else if (u_kind == 3) { c = sin((q.x + fbm(uv) * 0.5) * 22.0); col *= 0.8 + 0.2 * c; }
  else if (u_kind == 4) { c = cells(uv * 1.3); col *= 0.85 + 0.2 * smoothstep(0.0, 0.1, c); }
  else if (u_kind == 5) { c = abs(sin(fbm(uv * 0.8) * 18.0)); col *= 0.75 + 0.3 * c; }
  else if (u_kind == 6) { c = fbm(uv * 3.0); col = mix(col, vec3(0.86, 0.82, 0.7), 0.5) * (0.8 + 0.3 * c); }
  else if (u_kind == 1) { c = fbm(uv * 1.5 + u_pulse * 0.3); col *= 0.85 + 0.25 * c; }
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
  vec3 nrm = normalize(vec3(-grad * 0.35, 1.0));
  vec3 L = normalize(vec3((u_light - px) / 700.0, 0.9));
  float diff = max(dot(nrm, L), 0.0);
  float spec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), 18.0);
  col = col * (0.38 + 0.52 * diff) + vec3(1.0, 0.9, 0.82) * spec * 0.22;
  // Fine wet glints, sparse and soft.
  col += vec3(1.0, 0.95, 0.9) * smoothstep(0.82, 0.95, noise(uv * 6.0 + 3.0)) * spec * 0.25;

  // Curse corruption: purple-black bruising that creeps in from the rim.
  float cor = u_corrupt * smoothstep(0.3, 1.0, r + fbm(uv * 1.7 + u_time * 0.1) * 0.4);
  col = mix(col, vec3(0.16, 0.05, 0.2), cor * 0.7);

  // Retractor rim darkening.
  col *= smoothstep(1.02, 0.78, edge) * 0.6 + 0.4;
  float inside = smoothstep(1.0, 0.985, edge);
  vec3 outc = mix(drape, col * 0.3, smoothstep(1.06, 1.0, edge) * 0.6);
  o = vec4(mix(outc, col, inside), 1.0);
}`;

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
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = v_uv + u_shake;
  // Litany: the world ripples as time is held still.
  if (u_litany > 0.0) {
    float d = length(uv - 0.5);
    uv += (uv - 0.5) * sin(d * 40.0 - u_time * 3.0) * 0.003 * u_litany;
  }
  vec3 c = texture(u_scene, uv).rgb;
  c += texture(u_bloom, uv).rgb * u_bloomAmt;

  // Candlelit grade: warm highlights, cool-green shadows.
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, c * vec3(1.06, 0.98, 0.86), smoothstep(0.2, 0.9, l));
  c = mix(c, c * vec3(0.9, 1.0, 0.96), smoothstep(0.4, 0.0, l));
  c *= 1.0 - u_flicker * 0.05;

  if (u_litany > 0.0) {
    vec3 sepia = vec3(l * 1.1, l * 0.95, l * 0.7) + vec3(0.06, 0.04, 0.0);
    c = mix(c, sepia, u_litany * 0.7);
  }

  vec2 vq = v_uv - 0.5;
  float vig = smoothstep(0.85, 0.25, length(vq * vec2(1.0, 0.8)));
  c *= mix(0.35, 1.0, vig);
  // Failing vitals: the edges pulse red.
  c = mix(c, vec3(0.5, 0.0, 0.02), (1.0 - vig) * u_danger * (0.5 + 0.5 * sin(u_time * 6.0)));

  c += (hash(v_uv * 900.0 + u_time) - 0.5) * 0.035;
  o = vec4(c, 1.0);
}`;
