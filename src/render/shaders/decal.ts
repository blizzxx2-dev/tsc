/**
 * Decal map shaders (ENG-0109, ENG-0114): instanced brush stamps into a field-space map, and the
 * composite that shades the blood map onto the field (fresh and glossy, darkening as it dries).
 */

/** Brush shapes for `stampDecal`. */
export const BRUSHES = { soft: 0, disc: 1, splat: 2, streak: 3, ring: 4 } as const;
export type Brush = keyof typeof BRUSHES;

/**
 * Stamps: per instance `a_xf` (centre x, y in map UV 0..1, rotation, half-size in UV x) and
 * `a_col` (RGB payload, stamp time); `a_brush` picks the shape. The quad is expanded here; the
 * map's aspect keeps brushes round.
 */
export const STAMP_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_xf;
layout(location=2) in vec4 a_col;
layout(location=3) in vec2 a_brush;
uniform float u_aspect;
out vec2 v_uv;
out vec4 v_col;
flat out vec2 v_brush;
void main() {
  float c = cos(a_xf.z), s = sin(a_xf.z);
  vec2 o = vec2(a_corner.x * c - a_corner.y * s, a_corner.x * s + a_corner.y * c) * a_xf.w;
  o.y *= u_aspect;
  vec2 p = a_xf.xy + o;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  v_uv = a_corner;
  v_col = a_col;
  v_brush = a_brush;
}`;

export const STAMP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_col;
flat in vec2 v_brush;
uniform int u_mode;
out vec4 o;
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  float d = length(v_uv);
  int b = int(v_brush.x + 0.5);
  float seed = v_brush.y;
  float m;
  if (b == 0) m = rsmooth(1.0, 0.0, d);
  else if (b == 1) m = rsmooth(1.0, 0.85, d);
  else if (b == 2) {
    // Splat: a lobed blot with satellite droplets.
    float a = atan(v_uv.y, v_uv.x);
    float r = 0.66 + 0.08 * sin(a * 3.0 + seed * 6.28) + 0.05 * sin(a * 7.0 - seed * 3.1);
    m = rsmooth(r, r - 0.18, d);
    vec2 cell = floor(v_uv * 4.0 + seed * 7.0);
    vec2 f = fract(v_uv * 4.0 + seed * 7.0) - 0.5;
    float drop = step(0.9, hash(cell)) * rsmooth(0.2, 0.1, length(f)) * step(d, 1.0);
    m = max(m, drop);
  } else if (b == 3) m = rsmooth(1.0, 0.7, abs(v_uv.y) * 2.2 + abs(v_uv.x) * 0.3);
  else m = rsmooth(0.12, 0.04, abs(d - 0.8));
  if (m <= 0.002) discard;
  if (u_mode == 1) {
    // Erase: the colour factor scales the destination down (blend ZERO, ONE_MINUS_SRC_COLOR).
    o = vec4(vec3(m * v_col.r), 0.0);
    return;
  }
  // Add: payload × coverage into RGB; the stamp time goes to alpha, blended with MAX.
  o = vec4(v_col.rgb * m, v_col.a * step(0.05, m));
}`;

/** Full quad over the map's field rect: position from a uniform rect through the view transform. */
export const DECAL_VS = /* glsl */ `#version 300 es
uniform vec4 u_rect;
uniform vec2 u_view;
uniform mat3 u_xf;
out vec2 v_uv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 p = u_rect.xy + c * u_rect.zw;
  vec2 q = (u_xf * vec3(p, 1.0)).xy / u_view * 2.0 - 1.0;
  gl_Position = vec4(q.x, -q.y, 0.0, 1.0);
  v_uv = vec2(c.x, 1.0 - c.y);
}`;

/**
 * Blood decal composite: R density, G wetness, A stamp time (world seconds). Fresh blood is the
 * species colour with a wet sheen; over ~20 s of world time it darkens to a matte brown crust.
 */
export const BLOOD_DECAL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_map;
uniform vec2 u_texel;
uniform float u_now;
uniform float u_dry;
uniform vec3 u_fresh;
uniform vec3 u_dried;
uniform vec2 u_light;
out vec4 o;
void main() {
  vec4 m = texture(u_map, v_uv);
  float d = clamp(m.r, 0.0, 1.6);
  if (d < 0.02) discard;
  float age = max(0.0, u_now - m.a);
  float dry = smoothstep(u_dry * 0.15, u_dry, age) * (1.0 - clamp(m.g - 1.0, 0.0, 1.0));
  float thick = smoothstep(0.02, 0.5, d);
  vec3 col = mix(u_fresh * (0.55 + 0.2 * thick), u_dried, dry);
  // Wet blood catches the lamp: a sheen from the density gradient, gone once dry.
  float dx = texture(u_map, v_uv + vec2(u_texel.x, 0.0)).r - texture(u_map, v_uv - vec2(u_texel.x, 0.0)).r;
  float dy = texture(u_map, v_uv + vec2(0.0, u_texel.y)).r - texture(u_map, v_uv - vec2(0.0, u_texel.y)).r;
  vec3 n = normalize(vec3(-dx * 6.0, dy * 6.0, 1.0));
  float spec = pow(max(0.0, dot(n, normalize(vec3(u_light, 1.2)))), 24.0) * (1.0 - dry) * thick;
  float a = thick * mix(0.85, 0.7, dry);
  o = vec4(col * a + vec3(spec * 0.25), a);
}`;

/** Coverage readback (ENG-0116): each output texel averages a 4×4 grid of map density samples. */
export const COVERAGE_VS = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const COVERAGE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_map;
uniform vec2 u_cell;
out vec4 o;
void main() {
  float d = 0.0;
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) d += clamp(texture(u_map, v_uv + (vec2(float(i), float(j)) / 4.0 - 0.375) * u_cell).r, 0.0, 1.0);
  o = vec4(d / 16.0, 0.0, 0.0, 1.0);
}`;
