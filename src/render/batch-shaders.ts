/**
 * Engine-owned shaders for the batcher and fallbacks. The look shaders (flesh,
 * post, backdrops, portraits) live in shaders.ts; these are plumbing only.
 */

/** Max texture units a single batch can sample (ENG-0031). Unit 0 is always the glyph atlas. */
export const BATCH_UNITS = 8;

/**
 * Batched primitive vertex shader: positions go through the `u_xf` view
 * matrix (aspect-policy origin × camera, ENG-0045/0182) on the GPU, so camera
 * moves never rebuild vertex data. `a_tex` selects the texture unit.
 */
export const BATCH_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_col;
layout(location=3) in float a_tex;
uniform vec2 u_view;
uniform mat3 u_xf;
out vec2 v_uv;
out vec4 v_col;
flat out int v_tex;
void main() {
  v_uv = a_uv;
  v_col = a_col;
  v_tex = int(a_tex + 0.5);
  vec2 p = (u_xf * vec3(a_pos, 1.0)).xy;
  vec2 c = p / u_view * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

/**
 * Unit 0 is the glyph atlas (coverage in alpha, colour from the vertex — the
 * original PRIM_FS behaviour); units 1–7 are RGBA sprite pages tinted by the
 * vertex colour. Gradients are taken outside the branch so mip selection stays
 * well-defined.
 */
export const BATCH_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_col;
flat in int v_tex;
uniform sampler2D u_tex[${BATCH_UNITS}];
out vec4 o;
void main() {
  vec2 dx = dFdx(v_uv);
  vec2 dy = dFdy(v_uv);
  if (v_tex == 0) {
    o = vec4(v_col.rgb, v_col.a * textureGrad(u_tex[0], v_uv, dx, dy).a);
    return;
  }
  vec4 t;
  if (v_tex == 1) t = textureGrad(u_tex[1], v_uv, dx, dy);
  else if (v_tex == 2) t = textureGrad(u_tex[2], v_uv, dx, dy);
  else if (v_tex == 3) t = textureGrad(u_tex[3], v_uv, dx, dy);
  else if (v_tex == 4) t = textureGrad(u_tex[4], v_uv, dx, dy);
  else if (v_tex == 5) t = textureGrad(u_tex[5], v_uv, dx, dy);
  else if (v_tex == 6) t = textureGrad(u_tex[6], v_uv, dx, dy);
  else t = textureGrad(u_tex[7], v_uv, dx, dy);
  o = t * v_col;
}`;

/** Fullscreen triangle with 0..1 UVs (same as FULL_VS, kept local so fallbacks never depend on look shaders). */
export const FALLBACK_VS = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** FXAA 3.11-style edge AA — the world-layer fallback when MSAA is unavailable (ENG-0193). */
export const FXAA_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
out vec4 o;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 rgbM = texture(u_tex, v_uv).rgb;
  vec3 rgbNW = texture(u_tex, v_uv + vec2(-1.0, -1.0) * u_texel).rgb;
  vec3 rgbNE = texture(u_tex, v_uv + vec2(1.0, -1.0) * u_texel).rgb;
  vec3 rgbSW = texture(u_tex, v_uv + vec2(-1.0, 1.0) * u_texel).rgb;
  vec3 rgbSE = texture(u_tex, v_uv + vec2(1.0, 1.0) * u_texel).rgb;
  float lM = luma(rgbM), lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * u_texel;
  vec3 a = 0.5 * (texture(u_tex, v_uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(u_tex, v_uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(u_tex, v_uv - dir * 0.5).rgb + texture(u_tex, v_uv + dir * 0.5).rgb);
  float lB = luma(b);
  o = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
}`;
