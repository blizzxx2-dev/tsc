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
  // Quintic fade: continuous second derivative, so no creases at cell borders.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Each octave is rotated so the value-noise lattices never line up into visible squares.
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = OCT * p + 17.1; a *= 0.5; }
  return v + a * 0.5;
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
uniform sampler2D u_surface;
uniform vec2 u_surfTexel;
out vec4 o;
// smoothstep with edge0 > edge1 is undefined in GLSL; this is the portable falling edge.
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }

${NOISE}
// Height contributed by wounds (negative) and swelling (positive).
float surfH(vec2 uv) {
  vec4 s = texture(u_surface, uv);
  return s.a * 1.3 - s.r * 1.4;
}
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
  drape *= 0.55 + 0.45 * rsmooth(900.0, 200.0, length(px - u_light));
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
  // Wounds and swellings from the surface layer shape the normal: cuts read as carved channels.
  vec4 sf = texture(u_surface, v_uv);
  vec2 st = u_surfTexel * 1.5;
  vec2 sg = vec2(surfH(v_uv + vec2(st.x, 0.0)) - surfH(v_uv - vec2(st.x, 0.0)), surfH(v_uv - vec2(0.0, st.y)) - surfH(v_uv + vec2(0.0, st.y)));
  grad += sg * 14.0;
  vec3 nrm = normalize(vec3(-grad * 0.35, 1.0));
  vec3 L = normalize(vec3((u_light - px) / 700.0, 0.9));
  float diff = max(dot(nrm, L), 0.0);
  float spec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), 18.0);
  float cut = smoothstep(0.05, 0.7, sf.r);
  // Subsurface scattering: light bleeds red through flesh on the shadowed side.
  vec3 sss = u_base * vec3(1.25, 0.35, 0.28) * pow(1.0 - diff, 2.0) * 0.32;
  float fres = pow(1.0 - clamp(nrm.z, 0.0, 1.0), 3.0);
  col = col * (0.38 + 0.52 * diff) + sss + vec3(1.0, 0.9, 0.82) * spec * 0.22 + vec3(1.0, 0.75, 0.7) * fres * 0.12;

  // Wound interior: deep, wet, glistening maroon with a dark rim.
  vec3 woundCol = mix(vec3(0.42, 0.03, 0.05), vec3(0.16, 0.0, 0.02), smoothstep(0.3, 1.0, sf.r));
  float wspec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), 50.0);
  woundCol += vec3(1.0, 0.8, 0.8) * wspec * 0.8;
  float rim = smoothstep(0.02, 0.15, sf.r) * (1.0 - smoothstep(0.15, 0.45, sf.r));
  col = mix(col, woundCol, cut);
  col *= 1.0 - rim * 0.35;
  // Blood staining and bruising.
  col = mix(col, vec3(0.26, 0.015, 0.04) * (0.7 + 0.5 * diff), clamp(sf.g * 1.3, 0.0, 1.0) * 0.85);
  // Scorch: blackened, cracked eschar with ember-red fissures.
  float crack = rsmooth(0.02, 0.0, cells(uv * 5.0));
  vec3 charCol = mix(vec3(0.06, 0.04, 0.035), vec3(0.5, 0.12, 0.03), crack * 0.6) * (0.6 + 0.6 * diff);
  col = mix(col, charCol, clamp(sf.b, 0.0, 1.0));
  // Swelling: inflamed, taut and shiny.
  col = mix(col, col * vec3(1.25, 0.88, 0.78) + spec * 0.25, clamp(sf.a * 1.2, 0.0, 1.0) * 0.75);
  // Fine wet glints, sparse and soft.
  col += vec3(1.0, 0.95, 0.9) * smoothstep(0.82, 0.95, noise(uv * 6.0 + 3.0)) * spec * 0.25;

  // Curse corruption: purple-black bruising that creeps in from the rim.
  float cor = u_corrupt * smoothstep(0.3, 1.0, r + fbm(uv * 1.7 + u_time * 0.1) * 0.4);
  col = mix(col, vec3(0.16, 0.05, 0.2), cor * 0.7);

  // Retractor rim darkening.
  col *= rsmooth(1.02, 0.78, edge) * 0.6 + 0.4;
  float inside = rsmooth(1.0, 0.985, edge);
  vec3 outc = mix(drape, col * 0.3, rsmooth(1.06, 1.0, edge) * 0.6);
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
uniform float u_chroma;
uniform vec3 u_tint;
uniform vec3 u_lift;
uniform vec2 u_res;
out vec4 o;
// smoothstep with edge0 > edge1 is undefined in GLSL; this is the portable falling edge.
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = v_uv + u_shake;
  // Litany: the world ripples as time is held still.
  if (u_litany > 0.0) {
    float d = length(uv - 0.5);
    uv += (uv - 0.5) * sin(d * 40.0 - u_time * 3.0) * 0.003 * u_litany;
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

  // Candlelit grade: warm highlights, cool-green shadows.
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, c * vec3(1.06, 0.98, 0.86), smoothstep(0.2, 0.9, l));
  c = mix(c, c * vec3(0.9, 1.0, 0.96), rsmooth(0.4, 0.0, l));
  c *= 1.0 - u_flicker * 0.05;

  if (u_litany > 0.0) {
    vec3 sepia = vec3(l * 1.1, l * 0.95, l * 0.7) + vec3(0.06, 0.04, 0.0);
    c = mix(c, sepia, u_litany * 0.7);
  }

  vec2 vq = v_uv - 0.5;
  float vig = rsmooth(0.85, 0.25, length(vq * vec2(1.0, 0.8)));
  c *= mix(0.35, 1.0, vig);
  // Failing vitals: the edges pulse red.
  c = mix(c, vec3(0.5, 0.0, 0.02), (1.0 - vig) * u_danger * (0.5 + 0.5 * sin(u_time * 6.0)));

  c += (hash(v_uv * 900.0 + u_time) - 0.5) * 0.035;
  o = vec4(c, 1.0);
}`;

/** Metaball liquid: thresholds the summed density layer and shades it as a glossy fluid. */
export const FLUID_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_fluid;
uniform vec2 u_texel;
uniform vec2 u_view;
uniform vec2 u_light;
uniform float u_time;
out vec4 o;
float dens(vec2 uv) { vec4 f = texture(u_fluid, uv); return f.r + f.g + f.b; }
void main() {
  vec4 f = texture(u_fluid, v_uv);
  float d = f.r + f.g + f.b;
  float a = smoothstep(0.42, 0.52, d);
  if (a < 0.003) discard;
  vec2 t = u_texel * 2.0;
  float dx = dens(v_uv + vec2(t.x, 0.0)) - dens(v_uv - vec2(t.x, 0.0));
  float dy = dens(v_uv - vec2(0.0, t.y)) - dens(v_uv + vec2(0.0, t.y));
  // Surface bulges toward the centre of each pool; clamp so thick pools stay flat and glassy.
  vec3 n = normalize(vec3(-dx * 2.2, -dy * 2.2, 1.0) * vec3(1.0, 1.0, 1.0 + smoothstep(0.5, 1.4, d) * 3.0));
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_view;
  vec3 L = normalize(vec3((u_light - px) / 700.0, 0.9));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 90.0);
  float spec2 = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 12.0);
  vec3 w = f.rgb / max(d, 1e-4);
  vec3 blood = mix(vec3(0.55, 0.02, 0.05), vec3(0.2, 0.0, 0.015), smoothstep(0.5, 1.6, d));
  vec3 pus = mix(vec3(0.78, 0.7, 0.3), vec3(0.5, 0.45, 0.16), smoothstep(0.5, 1.6, d));
  vec3 bile = vec3(0.06, 0.04, 0.06);
  vec3 base = blood * w.r + pus * w.g + bile * w.b;
  // A darker meniscus at the edge, then glossy highlights.
  float edge = 1.0 - smoothstep(0.45, 0.65, d);
  vec3 col = base * (0.55 + 0.6 * diff) * (1.0 - edge * 0.45);
  col += vec3(1.0, 0.92, 0.9) * spec * 1.3 + vec3(0.6, 0.2, 0.2) * spec2 * 0.15;
  o = vec4(col, a * 0.97);
}`;

/** Textured quad with period grading for engravings/paintings (backdrops, portraits, plates). */
export const IMAGE_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
uniform vec2 u_view;
out vec2 v_uv;
out vec2 v_screen;
void main() {
  v_uv = a_uv;
  v_screen = a_pos / u_view;
  vec2 c = a_pos / u_view * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

export const IMAGE_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec2 v_screen;
uniform sampler2D u_img;
uniform float u_alpha;
uniform float u_sepia;
uniform vec3 u_ink;
uniform vec3 u_paper;
uniform float u_contrast;
uniform float u_vignette;
uniform float u_time;
uniform vec2 u_light;
out vec4 o;
void main() {
  vec4 t = texture(u_img, v_uv);
  float l = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  l = clamp((l - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  // Map luminance onto an ink-to-paper ramp (engraving look), blended with the original colour.
  vec3 toned = mix(u_ink, u_paper, l);
  vec3 c = mix(t.rgb, toned, u_sepia);
  // Candlelight pooling from a moving source, and a flicker.
  float d = length((v_screen - u_light) * vec2(1.6, 1.0));
  float glow = 1.0 - smoothstep(0.1, 0.9, d);
  float flick = 0.94 + 0.06 * sin(u_time * 9.1) * sin(u_time * 3.7);
  c *= mix(1.0, (0.45 + 0.75 * glow) * flick, u_vignette);
  o = vec4(c, t.a * u_alpha);
}`;
