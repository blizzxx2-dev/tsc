/** GLSL ES 3.00 sources: image. */

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
