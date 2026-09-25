/** GLSL ES 3.00 sources: prim. */

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
