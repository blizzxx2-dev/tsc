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
// Smooth voronoi edge distance: d2 - d1 with a soft minimum so membranes never form hard creases.
uniform float u_cellSoft;
float cells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  float k = max(u_cellSoft, 0.02);
  float sm = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
    float d = length(g + o - f);
    sm += exp(-d / k);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float smoothD1 = -k * log(sm);
  return max(d2 - max(d1, smoothD1), 0.0) * smoothstep(0.0, 0.08, d2 - d1);
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

  // ---- drape (outside the opening): creased linen over an oak table, lit by the candle.
  // Folds radiate from the opening: a height field of stretched creases plus slack wrinkles.
  vec2 fq = (px - u_center) / u_radii;
  float ang = atan(fq.y, fq.x);
  float rad = length(fq);
  float folds = sin(ang * 9.0 + fbm(fq * 2.0) * 3.0) * 0.5 + 0.5;
  folds *= smoothstep(1.0, 1.35, rad) * (1.0 - smoothstep(1.6, 2.4, rad));
  float slack = fbm(px * 0.008 + vec2(3.0, 1.0));
  float fh = folds * 0.6 + slack * 0.8;
  vec2 fd = vec2(dFdx(fh), dFdy(fh)) * 40.0;
  vec3 fn = normalize(vec3(-fd, 1.0));
  vec3 fl = normalize(vec3((u_light - px) / 600.0, 0.7));
  float fdiff = max(dot(fn, fl), 0.0);
  // Linen weave.
  vec2 w = px * 0.9;
  float weave = 0.5 + 0.18 * sin(w.x * 2.2) * sin(w.y * 2.2) + 0.2 * noise(px * 0.35);
  vec3 linen = mix(vec3(0.42, 0.40, 0.34), vec3(0.62, 0.59, 0.5), weave);
  vec3 drape = linen * (0.18 + 0.85 * fdiff);
  drape *= 0.45 + 0.65 * rsmooth(950.0, 150.0, length(px - u_light));
  // Blood soaks into the linen nearest the wound, and old stains elsewhere.
  float soak = rsmooth(1.3, 1.0, rad) * (0.6 + 0.4 * fbm(px * 0.02));
  drape = mix(drape, vec3(0.22, 0.02, 0.03) * (0.5 + 0.6 * fdiff), soak * 0.85);
  drape = mix(drape, vec3(0.3, 0.1, 0.07) * (0.5 + 0.5 * fdiff), smoothstep(0.64, 0.74, fbm(px * 0.006 + 3.0)) * 0.55);
  // Oak table at the frame edges.
  float tableMask = smoothstep(2.05, 2.25, rad + 0.1 * fbm(fq * 3.0));
  vec3 oak = vec3(0.14, 0.08, 0.045) * (0.6 + 0.5 * noise(vec2(px.x * 0.02, px.y * 0.6))) * (0.4 + 0.6 * rsmooth(1100.0, 200.0, length(px - u_light)));
  drape = mix(drape, oak, tableMask);

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
  // Specular anti-aliasing (Toksvig-style): widen the lobe where the normal varies within a pixel.
  float nVar = clamp(length(fwidth(nrm)) * 6.0, 0.0, 1.0);
  float specPow = mix(18.0, 6.0, nVar);
  float spec = pow(max(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0), specPow) * mix(1.0, 0.45, nVar);
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
  float glintFoot = 1.0 - smoothstep(0.02, 0.12, fwidth(uv.x * 6.0));
  col += vec3(1.0, 0.95, 0.9) * smoothstep(0.82, 0.95, noise(uv * 6.0 + 3.0)) * spec * 0.25 * glintFoot;

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
uniform vec2 u_litanyCenter;
uniform float u_litanyAge;
uniform vec3 u_hurt; // xy: direction from screen centre, z: intensity
out vec4 o;
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

/** Quad in a rect; v_uv 0..1 across the rect (y down). */
export const RECT_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
uniform vec2 u_view;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  vec2 c = a_pos / u_view * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

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
