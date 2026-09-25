/**
 * UI plate shader: the one material the HUD and menus are built from. A signed-distance plate
 * (rounded or chamfered) with a vertical gradient fill, fine grain, a lit bevel along the top edge
 * and a shadowed one along the bottom, an optional inset hairline, a crisp border, a soft drop
 * shadow and an outer glow. Everything is analytic, so it stays sharp at any resolution.
 */
export const PLATE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_size;      // plate size in px
uniform float u_pad;      // quad margin around the plate (for shadow/glow)
uniform vec2 u_shape;     // x: corner radius px, y: 1 = chamfered corners
uniform vec4 u_top;       // fill at the top (straight alpha)
uniform vec4 u_bot;       // fill at the bottom
uniform vec4 u_border;    // border colour; w = alpha
uniform float u_bw;       // border width px
uniform vec4 u_inset;     // inset hairline colour (a = 0: none)
uniform float u_insetD;   // inset hairline distance from the edge, px
uniform float u_bevel;    // bevel light strength 0..1
uniform vec4 u_shadow;    // x alpha, y blur px, z offset y px
uniform vec4 u_glow;      // outer glow colour; a = strength
uniform float u_glowR;    // glow radius px
uniform float u_grain;    // grain amount 0..1
uniform float u_alpha;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float sdPlate(vec2 p, vec2 b, float r, float chamfer) {
  if (chamfer > 0.5) {
    vec2 q = abs(p) - b;
    float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float cut = (abs(p.x) + abs(p.y) - (b.x + b.y - r)) * 0.70710678;
    return max(box, cut);
  }
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec4 over(vec4 top, vec4 base) { return top + base * (1.0 - top.a); }

void main() {
  vec2 full = u_size + 2.0 * u_pad;
  vec2 px = v_uv * full - u_pad;          // plate-local px, 0..size inside
  vec2 p = px - u_size * 0.5;
  vec2 b = u_size * 0.5;
  float r = min(u_shape.x, min(b.x, b.y));
  float d = sdPlate(p, b, r, u_shape.y);
  float aa = max(fwidth(d), 0.5);

  vec4 col = vec4(0.0);
  // Drop shadow and glow sit under the plate.
  if (u_shadow.x > 0.0) {
    float ds = sdPlate(p - vec2(0.0, u_shadow.z), b, r, u_shape.y);
    float s = 1.0 - smoothstep(-u_shadow.y * 0.3, u_shadow.y, ds);
    col = over(vec4(0.0, 0.0, 0.0, 1.0) * s * u_shadow.x, col);
  }
  if (u_glow.a > 0.0) {
    float g = exp(-max(d, 0.0) / max(u_glowR, 1.0) * 2.2) * step(0.0, d + aa);
    col = over(vec4(u_glow.rgb, 1.0) * g * u_glow.a, col);
  }

  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside > 0.0) {
    float ty = clamp(px.y / u_size.y, 0.0, 1.0);
    vec4 fill = mix(u_top, u_bot, ty);
    // Grain and a faint horizontal brushing, so dark plates read as material, not flat colour.
    float n = hash(floor(px)) - 0.5;
    float brush = hash(vec2(floor(px.y * 0.5), 7.0)) - 0.5;
    fill.rgb += (n * 0.035 + brush * 0.02) * u_grain;
    // Bevel: light along the top edge, shade along the bottom, fading inward over ~6 px.
    float edge = 1.0 - smoothstep(0.0, 6.0, -d);
    float up = clamp(-p.y / b.y, -1.0, 1.0);
    fill.rgb += edge * u_bevel * (up > 0.0 ? 0.16 * up : 0.0);
    fill.rgb *= 1.0 - edge * u_bevel * (up < 0.0 ? 0.45 * -up : 0.0);
    // Inner shadow: a soft darkening just inside the rim.
    fill.rgb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 14.0, -d)) * u_bevel;
    vec4 pf = vec4(fill.rgb * fill.a, fill.a) * inside;
    // Inset hairline.
    if (u_inset.a > 0.0) {
      float il = 1.0 - smoothstep(0.35, 0.35 + aa, abs(d + u_insetD));
      pf = over(vec4(u_inset.rgb, 1.0) * il * u_inset.a * inside, pf);
    }
    col = over(pf, col);
  }
  // Border straddles the edge; its top half catches the light.
  if (u_bw > 0.0 && u_border.a > 0.0) {
    float bl = 1.0 - smoothstep(u_bw * 0.5 - aa * 0.5, u_bw * 0.5 + aa * 0.5, abs(d + u_bw * 0.5));
    float lit = 0.8 + 0.35 * clamp(-p.y / b.y, -1.0, 1.0);
    col = over(vec4(u_border.rgb * lit, 1.0) * bl * u_border.a, col);
  }
  o = col * u_alpha;
}`;
