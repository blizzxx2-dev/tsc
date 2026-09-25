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

/**
 * Scorch composite (ENG-0117): R char, G hexfire. Char is a matte brown-black crust with a faint
 * blistered edge; hexfire scars glow violet along their rim, pulsing slowly with world time.
 */
export const SCORCH_DECAL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_map;
uniform vec2 u_texel;
uniform float u_time;
out vec4 o;
void main() {
  vec4 m = texture(u_map, v_uv);
  float c = clamp(m.r, 0.0, 1.2);
  float hx = clamp(m.g, 0.0, 1.0);
  if (c < 0.02 && hx < 0.02) discard;
  float edge = clamp(texture(u_map, v_uv + vec2(u_texel.x * 2.0, 0.0)).r + texture(u_map, v_uv - vec2(u_texel.x * 2.0, 0.0)).r - 2.0 * m.r, -1.0, 1.0);
  float a = smoothstep(0.02, 0.6, c);
  vec3 col = mix(vec3(0.24, 0.12, 0.07), vec3(0.05, 0.03, 0.025), smoothstep(0.2, 0.9, c));
  col += vec3(0.25, 0.08, 0.02) * max(0.0, edge) * 2.0;
  // curse-violet: hexfire scars keep a Malison glow.
  vec3 violet = vec3(0.62, 0.3, 0.95) * (0.75 + 0.25 * sin(u_time * 1.7));
  vec3 outc = col * a + violet * hx * 0.8;
  o = vec4(outc, max(a, hx * 0.5));
}`;

/** Full-map pass for the 10 Hz update (ENG-0119): one triangle strip covering the target. */
export const DECAL_UPDATE_VS = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  gl_Position = vec4(c * 2.0 - 1.0, 0.0, 1.0);
  v_uv = c;
}`;

/**
 * The 10 Hz decal update (ENG-0119), ping-ponged into a scratch map. Blood (`u_kind` 0): wet blood
 * seeps into its neighbours and its wetness (G) evaporates, so pools spread a little then set.
 * Scorch (`u_kind` 1): hexfire corruption (G) creeps outward along charred flesh (R), fading as it
 * goes, so a hexfire scar keeps growing violet veins into the burn around it.
 */
export const DECAL_UPDATE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_map;
uniform vec2 u_texel;
uniform float u_dt;
uniform int u_kind;
out vec4 o;
void main() {
  vec4 m = texture(u_map, v_uv);
  vec4 l = texture(u_map, v_uv - vec2(u_texel.x, 0.0));
  vec4 r = texture(u_map, v_uv + vec2(u_texel.x, 0.0));
  vec4 d = texture(u_map, v_uv - vec2(0.0, u_texel.y));
  vec4 u = texture(u_map, v_uv + vec2(0.0, u_texel.y));
  if (u_kind == 0) {
    // Seep: density flows from wet neighbours (a wet neighbour pushes, a dry one holds).
    float wetN = max(max(l.g, r.g), max(d.g, u.g));
    float avg = (l.r + r.r + d.r + u.r) * 0.25;
    float k = clamp(u_dt * 2.5, 0.0, 0.5) * clamp(max(m.g, wetN), 0.0, 1.0);
    float dens = min(1.6, m.r + max(0.0, avg - m.r) * k);
    // Blood that seeped in carries the time of the blood it came from.
    float t = dens > m.r + 0.004 ? max(m.a, max(max(l.a, r.a), max(d.a, u.a))) : m.a;
    o = vec4(dens, m.g * exp(-u_dt / 12.0), m.b, t);
  } else if (u_kind == 2) {
    // Stain (ENG-0264): necrosis (B) spreads slowly into living flesh around it; stone and frost
    // (R, G) are laid and lifted by stamps only.
    float bN = max(max(l.b, r.b), max(d.b, u.b));
    float spread = bN > 0.35 ? (bN - 0.35) * clamp(u_dt * 0.12, 0.0, 0.05) : 0.0;
    o = vec4(m.r, m.g, min(1.0, m.b + spread), m.a);
  } else {
    float hxN = max(max(l.g, r.g), max(d.g, u.g));
    float creep = hxN * (1.0 - clamp(u_dt * 0.3, 0.0, 0.2)) * step(0.05, m.r);
    o = vec4(m.r, max(m.g, creep), m.b, m.a);
  }
}`;

/**
 * Stain composite (ENG-0261, ENG-0262, ENG-0264): R petrification — grey granite with voronoi
 * fissures and no wet shine; G frost — dendritic rime, icy glints; B necrosis — a ramp from angry
 * red through purple to black, drying as it deepens.
 */
export const STAIN_DECAL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_map;
uniform vec2 u_texel;
uniform float u_time;
out vec4 o;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// Distance to the nearest cell edge of a voronoi pattern (fissures).
float fissure(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 c = g + hash2(i + g) - f;
      float d = dot(c, c);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  return sqrt(d2) - sqrt(d1);
}
void main() {
  vec4 m = texture(u_map, v_uv);
  float stone = clamp(m.r, 0.0, 1.0);
  float frost = clamp(m.g, 0.0, 1.0);
  float nec = clamp(m.b, 0.0, 1.0);
  if (stone < 0.02 && frost < 0.02 && nec < 0.02) discard;
  vec2 px = v_uv / u_texel;
  vec3 col = vec3(0.0);
  float a = 0.0;
  // Necrosis: red, purple, then black and dry.
  if (nec > 0.02) {
    vec3 ramp = nec < 0.5 ? mix(vec3(0.55, 0.12, 0.1), vec3(0.32, 0.1, 0.28), nec * 2.0) : mix(vec3(0.32, 0.1, 0.28), vec3(0.05, 0.03, 0.04), (nec - 0.5) * 2.0);
    float na = smoothstep(0.02, 0.4, nec) * 0.85;
    col = ramp * na;
    a = na;
  }
  // Frost: rime in branching needles with sparkles.
  if (frost > 0.02) {
    float needles = abs(sin(px.x * 0.21 + sin(px.y * 0.13) * 3.0)) * abs(sin(px.y * 0.17 + sin(px.x * 0.11) * 3.0));
    float rime = smoothstep(0.02, 0.6, frost) * (0.55 + 0.45 * needles);
    float glint = step(0.985, fract(sin(dot(floor(px * 0.5), vec2(12.9898, 78.233))) * 43758.5453)) * (0.6 + 0.4 * sin(u_time * 3.0 + px.x));
    vec3 ice = vec3(0.78, 0.88, 1.0) + vec3(glint);
    col = col * (1.0 - rime) + ice * rime * 0.8;
    a = max(a, rime * 0.8);
  }
  // Meltwater: a wet film where frost has just thawed, drying over ~4 s (m.a is the last stamp time).
  if (stone < 0.02 && frost < 0.1 && nec < 0.02 && m.a > 0.0) {
    float wet = exp(-max(0.0, u_time - m.a) / 4.0);
    float sheen = pow(abs(sin(px.x * 0.05 + px.y * 0.03)), 12.0);
    col += vec3(0.75, 0.85, 1.0) * wet * (0.08 + 0.25 * sheen);
    a = max(a, wet * 0.18);
  }
  // Stone: granite over everything, cracked.
  if (stone > 0.02) {
    float cracks = 1.0 - smoothstep(0.0, 0.06, fissure(px * 0.05));
    float grain = fract(sin(dot(floor(px * 0.7), vec2(12.9898, 78.233))) * 43758.5453) * 0.12;
    vec3 granite = vec3(0.47, 0.46, 0.44) + grain - cracks * 0.28;
    float sa = smoothstep(0.02, 0.5, stone);
    col = col * (1.0 - sa) + granite * sa;
    a = max(a, sa * 0.95);
  }
  o = vec4(col, a);
}`;
