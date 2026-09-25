/**
 * Instanced particles (ENG-0124): one static 4-vertex quad expanded per instance in the vertex
 * shader. Each instance carries position, velocity, base size, rotation, normalised age, shape and
 * three rows into the baked curve texture (ENG-0127): colour gradient, size-over-life and
 * alpha-over-life. Output is premultiplied, so one program serves the alpha and additive batches.
 */

/** Particle shapes (`a_p2.w`). */
export const PARTICLE_SHAPES = { disc: 0, glow: 1, streak: 2, smoke: 3, shard: 4 } as const;
export type ParticleShape = keyof typeof PARTICLE_SHAPES;

/** Size-over-life rows are stored normalised to 0..SIZE_RANGE. */
export const PARTICLE_SIZE_RANGE = 4;

export const PARTICLE_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_pv;
layout(location=2) in vec4 a_p2;
layout(location=3) in vec4 a_rows;
uniform vec2 u_view;
uniform mat3 u_xf;
uniform sampler2D u_curves;
uniform float u_sizeRange;
uniform float u_stretch;
out vec2 v_uv;
out vec4 v_col;
out float v_seed;
flat out int v_shape;
flat out vec2 v_ext;
void main() {
  float life = clamp(a_p2.z, 0.0, 1.0);
  vec4 col = texture(u_curves, vec2(life, a_rows.x));
  float sizeK = texture(u_curves, vec2(life, a_rows.y)).r * u_sizeRange;
  float alphaK = texture(u_curves, vec2(life, a_rows.z)).r;
  int shape = int(a_p2.w + 0.5);
  float r = a_p2.x * sizeK;
  vec2 axis = vec2(cos(a_p2.y), sin(a_p2.y));
  vec2 half_ = vec2(r);
  if (shape == 2) {
    // Streak: stretched along the velocity, with a glow halo around the core.
    float sp = length(a_pv.zw);
    axis = sp > 1e-3 ? a_pv.zw / sp : axis;
    half_ = vec2(r + sp * u_stretch * 0.5 + 4.0, r + 4.0);
  }
  vec2 off = axis * (a_corner.x * half_.x) + vec2(-axis.y, axis.x) * (a_corner.y * half_.y);
  vec2 p = (u_xf * vec3(a_pv.xy + off, 1.0)).xy;
  vec2 c = p / u_view * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  v_uv = a_corner * (shape == 2 ? half_ / max(half_.y, 1e-3) : vec2(1.0));
  // Streak: how far the capsule's straight part runs (in halo radii) and the core radius.
  v_ext = shape == 2 ? vec2(half_.x / max(half_.y, 1e-3) - 1.0, r / max(half_.y, 1e-3)) : vec2(0.0, 1.0);
  v_col = vec4(col.rgb, col.a * alphaK * a_rows.w);
  v_seed = a_p2.y;
  v_shape = shape;
}`;

export const PARTICLE_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_col;
in float v_seed;
flat in int v_shape;
flat in vec2 v_ext;
out vec4 o;
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
void main() {
  float d = length(v_uv);
  float a;
  if (v_shape == 0) {
    // Droplet disc with an anti-aliased rim.
    float aa = fwidth(d) * 1.5;
    a = rsmooth(1.0, 1.0 - aa, d);
  } else if (v_shape == 1) {
    // Soft glow (the old circleGrad falloff).
    a = max(0.0, 1.0 - d);
  } else if (v_shape == 2) {
    // Capsule core along x with a faint halo.
    float len = max(abs(v_uv.x) - v_ext.x, 0.0);
    float cd = length(vec2(len, v_uv.y));
    float halo = max(0.0, 1.0 - cd) * 0.35;
    a = max(rsmooth(v_ext.y, v_ext.y * 0.4, cd), halo);
  } else if (v_shape == 3) {
    // Smoke puff: soft disc broken up by a cheap swirl.
    float n = 0.75 + 0.25 * sin(v_uv.x * 5.0 + v_seed) * sin(v_uv.y * 4.0 - v_seed * 1.7);
    a = max(0.0, 1.0 - d) * n;
  } else {
    // Shard: a sharp diamond.
    a = rsmooth(1.0, 0.9, abs(v_uv.x) + abs(v_uv.y) * 1.8);
  }
  a *= v_col.a;
  if (a <= 0.002) discard;
  o = vec4(v_col.rgb * a, a);
}`;
