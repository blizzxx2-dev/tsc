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
