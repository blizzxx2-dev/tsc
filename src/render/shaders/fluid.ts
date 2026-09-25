/** GLSL ES 3.00 sources: fluid. */

/** Metaball liquid: thresholds the summed density layer and shades it as a glossy fluid. */
export const FLUID_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_fluid;
uniform vec2 u_texel;
uniform vec2 u_view;
uniform vec2 u_light;
uniform float u_time;
/** Fluid colours (palette tokens) and gore level: 0 full, 1 reduced (browned, dulled), 2 minimal (flat, matte). */
uniform vec3 u_blood;
uniform vec3 u_pus;
uniform vec3 u_bile;
uniform float u_gore;
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
  float deep = smoothstep(0.5, 1.6, d);
  vec3 blood = mix(u_blood, u_blood * 0.36, deep);
  vec3 pus = mix(u_pus, u_pus * 0.64, deep);
  vec3 bile = u_bile;
  // Reduced gore: blood browned and desaturated; minimal: flat ink-black shapes.
  vec3 brown = vec3(0.34, 0.2, 0.1) * mix(1.0, 0.5, deep);
  blood = mix(blood, brown, step(0.5, u_gore));
  blood = mix(blood, vec3(0.05, 0.04, 0.04), step(1.5, u_gore));
  pus = mix(pus, vec3(0.42, 0.4, 0.34), step(1.5, u_gore));
  vec3 base = blood * w.r + pus * w.g + bile * w.b;
  // A darker meniscus at the edge, then glossy highlights.
  float edge = 1.0 - smoothstep(0.45, 0.65, d);
  vec3 col = base * (0.55 + 0.6 * diff) * (1.0 - edge * 0.45);
  float gloss = u_gore > 1.5 ? 0.0 : 1.0;
  // Viscosity highlights per fluid (ART-0191): blood a glassy pin glint; pus thick and creamy, a broad
  // soft sheen with a milky rim; black bile oily, a sharp glint over a thin-film rainbow.
  vec3 hiBlood = vec3(1.0, 0.92, 0.9) * spec * 1.3 + vec3(0.6, 0.2, 0.2) * spec2 * 0.15;
  vec3 hiPus = vec3(1.0, 0.97, 0.85) * pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0) * 0.5 + vec3(0.95, 0.9, 0.7) * edge * 0.25;
  float film = dot(n.xy, vec2(0.7, 0.7)) * 6.0 + d * 4.0;
  vec3 rainbow = 0.5 + 0.5 * cos(film + vec3(0.0, 2.1, 4.2));
  vec3 hiBile = vec3(1.0) * spec * 1.6 + rainbow * spec2 * 0.35;
  col += (hiBlood * w.r + hiPus * w.g + hiBile * w.b) * gloss;
  // Opacity: pus is semi-opaque at thin edges, bile fully opaque, blood nearly so.
  float op = mix(0.97, mix(0.8, 0.97, deep), w.g * (1.0 - w.r));
  op = mix(op, 1.0, w.b);
  o = vec4(col, a * op);
}`;
