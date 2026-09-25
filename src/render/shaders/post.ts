/** GLSL ES 3.00 sources: post. */

export const BRIGHT_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
out vec4 o;
// Soft-knee threshold: highlights ease into the bloom instead of popping.
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float br = max(max(c.r, c.g), c.b);
  float knee = u_threshold * 0.5;
  float soft = clamp(br - u_threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - u_threshold) / max(br, 1e-4);
  o = vec4(c * contrib, 1.0);
}`;

/** Bloom v2: 4-tap box downsample (half-texel offsets = 16 source texels). */
export const DOWN_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
out vec4 o;
void main() {
  vec2 d = u_texel;
  vec3 c = texture(u_tex, v_uv + vec2(-d.x, -d.y)).rgb + texture(u_tex, v_uv + vec2(d.x, -d.y)).rgb
         + texture(u_tex, v_uv + vec2(-d.x, d.y)).rgb + texture(u_tex, v_uv + vec2(d.x, d.y)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;

/** Bloom v2: 9-tap tent upsample, blended additively into the next larger mip. */
export const UP_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_radius;
out vec4 o;
void main() {
  vec2 d = u_texel * u_radius;
  vec3 c = texture(u_tex, v_uv).rgb * 4.0;
  c += (texture(u_tex, v_uv + vec2(d.x, 0.0)).rgb + texture(u_tex, v_uv - vec2(d.x, 0.0)).rgb + texture(u_tex, v_uv + vec2(0.0, d.y)).rgb + texture(u_tex, v_uv - vec2(0.0, d.y)).rgb) * 2.0;
  c += texture(u_tex, v_uv + d).rgb + texture(u_tex, v_uv - d).rgb + texture(u_tex, v_uv + vec2(d.x, -d.y)).rgb + texture(u_tex, v_uv + vec2(-d.x, d.y)).rgb;
  o = vec4(c / 16.0, 1.0);
}`

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
uniform sampler2D u_lutA;
uniform sampler2D u_lutB;
uniform float u_lutMix;
uniform vec4 u_lens; // xy centre (0..1, y up), z radius (fraction of height), w strength
uniform float u_beat;    // heartbeat pulse 0..1 from the ECG clock
uniform float u_curse;   // Malison presence 0..1: ink creeping from the edges
uniform vec2 u_outcome;  // x: flatline 0..1 (desaturate, burn, fade), y: victory 0..1 (warm swell)
uniform float u_hdr;     // 1 when the scene target is floating point
uniform vec4 u_prefs;    // player display options (UIX-0105): x grain, y vignette, z brightness gamma, w reduced motion
uniform float u_defocus; // menu depth of field: disc blur radius in px (0 = sharp)
uniform vec4 u_spot;     // operating lamp: xy centre (0..1, y up), zw radii (0..1); off when z = 0
uniform float u_spotK;   // how dark the surround falls
out vec4 o;
// Soft shoulder: identity below the knee, gently compresses HDR highlights above it.
vec3 shoulder(vec3 c) {
  vec3 k = vec3(0.8);
  return mix(c, k + 0.4 * (1.0 - exp(-(c - k) / 0.4)), step(k, c));
}
// Interleaved gradient noise: cheap, well-distributed (blue-noise-like) per-pixel noise.
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// 32³ LUT stored as a 1024×32 strip; blue selects the slice, blended between neighbours.
vec3 lut(sampler2D t, vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float b = c.b * 31.0;
  float b0 = floor(b), b1 = min(b0 + 1.0, 31.0);
  vec2 uv0 = vec2((b0 * 32.0 + c.r * 31.0 + 0.5) / 1024.0, (c.g * 31.0 + 0.5) / 32.0);
  vec2 uv1 = vec2((b1 * 32.0 + c.r * 31.0 + 0.5) / 1024.0, uv0.y);
  return mix(texture(t, uv0).rgb, texture(t, uv1).rgb, b - b0);
}
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
  // Reduced Motion (UIX-0152): the Litany keeps its sepia tint but the ripple and wobble stop.
  if (u_litany > 0.0 && u_prefs.w < 0.5) {
    vec2 lp = (uv - u_litanyCenter) * vec2(aspect, 1.0);
    float sd = starShape(lp);
    float front = u_litanyAge * 0.9;
    lring = exp(-pow((sd - front) * 14.0, 2.0)) * exp(-u_litanyAge * 1.2);
    uv += normalize(lp + 1e-4) / vec2(aspect, 1.0) * lring * 0.012;
    uv += (uv - u_litanyCenter) * sin(sd * 40.0 - u_time * 3.0) * 0.002 * u_litany;
  }
  // Scrying Lens: a magnifying glass disc with barrel distortion and a fringe at the rim.
  float lensMask = 0.0;
  vec2 lensD = vec2(0.0);
  if (u_lens.w > 0.0) {
    lensD = (uv - u_lens.xy) * vec2(aspect, 1.0);
    float lr = length(lensD) / u_lens.z;
    lensMask = (1.0 - smoothstep(0.96, 1.0, lr)) * u_lens.w;
    uv = mix(uv, u_lens.xy + (uv - u_lens.xy) * (0.72 + 0.2 * lr * lr), lensMask);
  }
  vec3 c;
  // Chromatic aberration grows toward the frame edge (curses, trauma).
  float ca = u_chroma * 0.006 + 0.0006;
  vec2 dir = (uv - 0.5) * ca;
  c.r = texture(u_scene, uv + dir).r;
  c.g = texture(u_scene, uv).g;
  c.b = texture(u_scene, uv - dir).b;
  // Depth of field for menu backdrops: a 32-tap golden-angle disc; bright taps weigh more, so
  // lights open into soft bokeh discs instead of smearing.
  if (u_defocus > 0.0) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    vec2 px = 1.0 / u_res;
    for (int i = 0; i < 32; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 32.0) * u_defocus;
      float a = fi * 2.39996323;
      vec3 s = texture(u_scene, uv + vec2(cos(a), sin(a)) * r * px).rgb;
      float w = 1.0 + 4.0 * smoothstep(0.55, 1.2, dot(s, vec3(0.333)));
      acc += s * w;
      wsum += w;
    }
    c = acc / wsum;
  }
  c += texture(u_bloom, uv).rgb * u_bloomAmt * (1.0 + u_outcome.y * 1.2);
  if (u_hdr > 0.5) c = shoulder(c);
  // Operating lamp: a soft pool of light on the field; the drape and table fall into shadow.
  if (u_spot.z > 0.0) {
    vec2 q = (v_uv - u_spot.xy) / u_spot.zw;
    float r = length(q);
    float lit = 1.0 - smoothstep(0.92, 1.55, r);
    c *= mix(1.0 - u_spotK, 1.06, lit);
  }
  // Per-chapter grade.
  c = c * u_tint + u_lift;

  if (lensMask > 0.0) {
    float lr = length(lensD) / u_lens.z;
    // Blue scry-tint, fringe at the rim, a rotating scan sweep.
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 scry = vec3(lum * 0.75, lum * 0.95, lum * 1.25) + vec3(0.02, 0.04, 0.08);
    float ang = atan(lensD.y, lensD.x);
    float sweep = pow(max(0.0, cos(ang - u_time * 2.5)), 24.0) * (1.0 - lr) * 0.35;
    c = mix(c, scry + vec3(0.5, 0.75, 1.0) * sweep, lensMask * 0.75);
    float rim = smoothstep(0.86, 0.97, lr) * (1.0 - smoothstep(0.97, 1.02, lr));
    c += vec3(0.9, 0.7, 0.35) * rim * u_lens.w * 0.8;
    c.r += smoothstep(0.8, 1.0, lr) * lensMask * 0.12;
    c.b += smoothstep(0.7, 0.95, lr) * lensMask * 0.1;
  }
  // LUT grade, crossfading between two looks.
  c = mix(lut(u_lutA, c), lut(u_lutB, c), u_lutMix);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
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
  // Aspect-aware vignette: measured in height units so ultrawide edges aren't crushed.
  float vig = rsmooth(0.85, 0.25, length(vq * vec2(min(aspect / (16.0 / 9.0), 1.0), 0.8)));
  c *= mix(mix(0.35, 1.0, vig), 1.0 - (1.0 - vig) * 0.25, 1.0 - u_prefs.y);
  // Failing vitals: progressive desaturation and an edge pulse on each heartbeat.
  float lumD = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(lumD), u_danger * 0.45);
  c = mix(c, vec3(0.5, 0.0, 0.02), (1.0 - vig) * u_danger * (0.25 + 0.75 * u_beat));
  // A Malison's presence: ink tendrils creep in from the frame edges.
  if (u_curse > 0.0) {
    float edgeDist = min(min(v_uv.x, 1.0 - v_uv.x) * aspect, min(v_uv.y, 1.0 - v_uv.y));
    float n = 0.0, a = 0.5; vec2 np = v_uv * vec2(aspect, 1.0) * 5.0 + vec2(u_time * 0.05, -u_time * 0.03);
    for (int i = 0; i < 4; i++) { n += a * (0.5 + 0.5 * sin(np.x + sin(np.y * 1.3))) ; np = mat2(1.6, 1.2, -1.2, 1.6) * np; a *= 0.5; }
    float reach = u_curse * 0.22;
    float ink = rsmooth(reach, reach - 0.08, edgeDist + (n - 0.5) * 0.16);
    c = mix(c, vec3(0.03, 0.0, 0.05), ink * 0.85);
  }
  // Outcomes: the flatline drains colour, burns the film at the edges and fades to black.
  if (u_outcome.x > 0.0) {
    float lo = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(lo * 0.9, lo * 0.85, lo * 0.8), min(1.0, u_outcome.x * 1.5));
    float burn = rsmooth(0.9 - u_outcome.x * 0.5, 0.5 - u_outcome.x * 0.5, length(vq) * 1.4 + (ign(v_uv * u_res * 0.05) - 0.5) * 0.1);
    c = mix(c, vec3(0.35, 0.12, 0.03), (1.0 - burn) * 0.6 * u_outcome.x);
    c *= 1.0 - smoothstep(0.5, 1.0, u_outcome.x) * 0.9;
  }
  // Victory: warmth swells.
  c = mix(c, c * vec3(1.12, 1.02, 0.85), u_outcome.y * 0.6);
  // Damage: a red flash from the edge nearest the wound.
  if (u_hurt.z > 0.0) {
    vec2 hd = normalize(u_hurt.xy + 1e-4);
    float side = max(dot(normalize(vq * vec2(aspect, 1.0) + 1e-4), hd), 0.0);
    float edgeW = smoothstep(0.25, 0.75, length(vq * vec2(1.0, 0.8)));
    c = mix(c, vec3(0.6, 0.02, 0.03), clamp(u_hurt.z, 0.0, 1.0) * edgeW * (0.35 + 0.65 * side) * 0.8);
  }

  // Film grain (animated interleaved-gradient noise), then ±0.5 LSB dither against banding.
  vec2 fc = gl_FragCoord.xy;
  c += (ign(fc + floor(u_time * 24.0) * 5.588) - 0.5) * 0.03 * u_prefs.x;
  c = pow(max(c, vec3(0.0)), vec3(1.0 / u_prefs.z));
  c += (ign(fc + 17.0) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;
