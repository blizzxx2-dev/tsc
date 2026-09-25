/**
 * GLSL ES 3.00 source: AILMENT_FS, the procedural ailment and wound art drawn by `Gfx.ailment()`.
 *
 * Every piece is painted in the rect's own pixel space (1 unit = 1 virtual px), turned by `u_rot`
 * so the art's +x axis follows the entity's direction, and lit by the surgeon's lamp from the
 * top-left like the UI kit. Animated pieces step through a fixed number of frames (`frame()`),
 * so each loop is a true flipbook with the frame count the art spec names. Output is premultiplied.
 *
 * Modes (typed wrappers in src/art/ailmentArt.ts):
 *  0 arrow / barbed arrow / bolt  (a.x shaft px, a.y skin line px along +x, a.z wobble, a.w kind 0 goose arrow, 1 barbed, 2 bolt, 3 leather-vaned bolt;
 *                                  b.x lancet nicks 0..2, b.y torn-out flesh on the barb, b.z snapped)
 *  1 lead shot                    (a.x ball radius px, a.y flattened 0..1, a.z sunk 0..1)
 *  2 powder tattoo / powder burn  (a.x ring radius px, a.y grain size 0 tattoo .. 1 embedded grains, a.z scorch)
 *  3 fang                         (a.x length px, a.y skin line px, a.w kind 0 gravehound canine, 1 brood-spider fang; b.x venom stain)
 *  4 glass shard                  (a.x length px, a.y skin line px, a.w shape 0..4)
 *  5 hexstone                     (a.x length px, a.y crackle 0..1, a.z dissolve 0..1, a.w stilled 0..1)
 *  6 fire burn                    (a.x radius px, a.y severity 0 reddened .. 0.5 blistered .. 1 charred, a.z cooled by salve 0..1)
 *  7 acid burn                    (a.x radius px, a.y neutralised 0..1)
 *  8 hexfire edge                 (a.x radius px, a.y intensity 0..1)
 *  9 bubo                         (a.x radius px, a.y ripeness, a.z burst 0..1, a.w drained 0..1)
 * 10 rot / gangrene               (a.x radius px, a.y growth 0..1 (4 stages), a.z debrided 0..1)
 * 11 pox cluster                  (a.x radius px, a.y lanced fraction)
 * 12 venom vein web               (a.x spread radius px, a.y neutralised 0..1; col = ink)
 * 13 grub                         (a.x length px, a.y burrowed 0..1, a.z squirm (in tongs), a.w heat 0..1)
 * 14 egg sac                      (a.x radius px, a.y hatch 0..1, a.z lifted by tongs 0..1, a.w swell 0..1)
 * 15 wound strip                  (a.x length px, a.y half-width px, a.z open 0..1, a.w edge 0 clean blade, 1 ragged claw; b.x bleed, b.y beat)
 * 16 gut stitch                   (a.x span px, a.y tightened 0..1)
 * 17 sutured scar                 (a.x length px, a.y width px, a.z age 0 fresh .. 1 healed)
 * 18 salve paste                  (a.x radius px, a.y absorbed 0..1)
 * 19 arterial spurt              (a.x length px, a.y 0..1 spurt phase)
 * 20 brood silk                   (a.x length px, a.y cut 0..1)
 * 21 blood pool (for kidney dish / lab) (a.x radius px, a.y kind 0 blood 1 pus 2 black bile)
 * 22 Malison thread knot           (a.x radius px, a.y shape 0 trefoil 1 figure-of-eight 2 tangle, a.z burst 0..1 (8 f), a.w crawler)
 * 23 boss thread spool (HUD)       (a.x thread left 0..1, a.y hurt flash, a.z unwinding spin)
 * 24 extraction dish               (a.x radius px, a.w 0 pewter kidney dish, 1 round lead dish)
 * 25 Malison silhouette            (a.x Hour 0 Matins … 7 Compline; col = the Hour's secondary colour)
 *
 * Colour filters and gore levels are applied by the callers through `u_col` / `u_alpha`.
 */
export const AILMENT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform int u_mode;
uniform vec2 u_size;
uniform float u_time;
uniform float u_seed;
uniform float u_rot;
uniform float u_alpha;
uniform vec3 u_col;
uniform vec4 u_a;
uniform vec4 u_b;
out vec4 o;

const float PI = 3.14159265;
vec3 LL; // lamp direction in the art's local frame
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
float rsmooth(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
/** Coverage of a signed distance (px) with a one-pixel antialiased edge. */
float fill(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdTri(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  vec2 v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float sdQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) { return min(sdTri(p, a, b, c), sdTri(p, a, c, d)); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
/** The current frame of an n-frame loop at fps frames a second (offset per instance by the seed). */
float frame(float fps, float n) { return mod(floor(u_time * fps + u_seed * 7.0), n); }
/** Lamp shading: diffuse wrap, a warm key and a Blinn highlight. */
vec3 lit(vec3 base, vec3 n, float gloss, float pw) {
  float d = max(dot(n, LL), 0.0);
  vec3 h = normalize(LL + vec3(0.0, 0.0, 1.0));
  float s = pow(max(dot(n, h), 0.0), pw);
  return base * (0.32 + 0.8 * d) + vec3(1.0, 0.93, 0.82) * s * gloss;
}
/** Normal of a cylinder lying along x with half-width w, at offset y. */
vec3 cylN(float y, float w) { float v = clamp(y / max(w, 0.001), -0.98, 0.98); return vec3(0.0, v, sqrt(1.0 - v * v)); }
/** Normal of a dome of radius r at offset p. */
vec3 domeN(vec2 p, float r) { vec2 v = p / max(r, 0.001); float l = min(dot(v, v), 0.96); return normalize(vec3(v, sqrt(1.0 - l))); }
/** Bump normal from an fbm height field (finite differences). */
vec3 bumpN(vec2 p, float k) {
  float h0 = fbm(p), hx = fbm(p + vec2(0.05, 0.0)), hy = fbm(p + vec2(0.0, 0.05));
  return normalize(vec3(-(hx - h0) * k, -(hy - h0) * k, 1.0));
}
vec4 over(vec4 top, vec4 bot) { return top + bot * (1.0 - top.a); }
vec4 paint(vec3 c, float a) { return vec4(c * a, a); }
vec2 cellOff; // offset from the nearest cell point, set by cellD
float cellD(vec2 p, out vec2 id) {
  vec2 g = floor(p), f = fract(p);
  float d1 = 8.0;
  id = g;
  cellOff = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = vec2(x, y);
    vec2 pt = c + vec2(hash(g + c), hash(g + c + 5.3)) * 0.7 + 0.15;
    float d = length(pt - f);
    if (d < d1) { d1 = d; id = g + c; cellOff = f - pt; }
  }
  return d1;
}
float voroEdge(vec2 p) {
  vec2 g = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = vec2(x, y);
    float d = length(c + vec2(hash(g + c), hash(g + c + 3.1)) - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
/** Where the object meets the skin (x = line): hide what is under it, darken and wet the rim. */
float skinMask(float x, float line) { return rsmooth(line + 1.0, line - 1.0, x); }
vec3 bloodWet(vec3 c, float x, float line) { float k = rsmooth(10.0, 0.0, abs(x - line)); return mix(c, vec3(0.32, 0.02, 0.03), k * 0.7); }

// ---------------------------------------------------------------- embedded objects

vec4 fletching(vec2 q, float x0, float len, float h, float kind) {
  // Two vanes seen edge-on either side of the shaft: a shield-cut goose feather or a stiff leather vane.
  float ay = abs(q.y);
  float t = clamp((q.x - x0) / len, 0.0, 1.0);
  float inX = step(x0, q.x) * step(q.x, x0 + len);
  float prof = kind < 0.5 ? h * (0.35 + 0.65 * smoothstep(0.0, 0.25, t)) * (0.55 + 0.45 * sqrt(max(0.0, 1.0 - pow(max(0.0, t - 0.55) / 0.45, 2.0))))
                          : h * (0.25 + 0.75 * smoothstep(0.0, 0.9, t));
  float d = ay - 1.5 - prof;
  float a = fill(d) * inX * step(1.2, ay);
  vec3 col;
  if (kind < 0.5) {
    // Goose feather: grey-barred, with barbs raking back from the shaft.
    float bars = smoothstep(0.35, 0.45, fract(t * 2.0 + 0.15)) * rsmooth(0.75, 0.65, fract(t * 2.0 + 0.15));
    col = mix(vec3(0.86, 0.84, 0.78), vec3(0.36, 0.34, 0.32), bars * 0.75);
    col *= 0.88 + 0.12 * sin((q.x + ay * 1.6) * 1.8);
    col *= 0.85 + 0.15 * noise(q * 0.8);
  } else {
    col = vec3(0.38, 0.24, 0.13) * (0.85 + 0.2 * noise(q * 0.5));
  }
  vec3 n = normalize(vec3(0.0, sign(q.y) * 0.35, 1.0));
  return paint(lit(col, n, 0.08, 8.0), a);
}

vec4 missile(vec2 q) {
  float L = u_a.x, line = u_a.y, kind = u_a.w;
  // Grab wobble: a 4-frame back-and-forth about the entry.
  float wf = frame(12.0, 4.0);
  q = rot2(u_a.z * 0.05 * (wf < 2.0 ? wf - 0.5 : 2.5 - wf)) * q;
  bool bolt = kind > 1.5;
  float r = bolt ? 3.2 : 2.1;
  vec4 acc = vec4(0.0);
  // Head at the far (+x) end: the part that went in first.
  vec2 h = q;
  float head;
  vec3 steel = vec3(0.56, 0.58, 0.6);
  vec3 hn;
  float headA;
  if (bolt) {
    // Square quarrel head: a four-faced pyramid (a diamond in profile) on a socket.
    float hx = h.x;
    float w = 4.8 * clamp(1.0 - (hx - 3.0) / 13.0, 0.0, 1.0);
    head = max(abs(h.y) - w, max(-hx + 0.5, hx - 16.0));
    head = min(head, sdBox(h - vec2(0.5, 0.0), vec2(3.0, 3.8)));
    hn = normalize(vec3(0.35, sign(h.y) * 0.7, 1.0));
    headA = fill(head) * (1.0 - u_b.z);
  } else {
    // Broadhead: a flat steel leaf; barbed heads sweep two barbs back past the socket.
    head = sdTri(h, vec2(2.0, -6.5), vec2(24.0, 0.0), vec2(2.0, 6.5));
    head = min(head, sdBox(h - vec2(0.0, 0.0), vec2(4.0, 2.6)));
    if (kind > 0.5) {
      float flare = 1.0 - u_b.x * 0.35;
      head = min(head, sdTri(h, vec2(2.0, -6.5), vec2(8.0, -3.0), vec2(-6.0, -9.5 * flare)));
      head = min(head, sdTri(h, vec2(2.0, 6.5), vec2(8.0, 3.0), vec2(-6.0, 9.5 * flare)));
    }
    hn = normalize(vec3(0.0, sign(h.y) * 0.55, 1.0));
    headA = fill(head);
  }
  vec3 hc = lit(steel * (0.8 + 0.3 * noise(h * 1.3)), hn, 0.9, 40.0);
  hc += vec3(1.0, 0.95, 0.85) * rsmooth(1.2, 0.0, abs(head + 0.8)) * 0.35; // honed edge
  // Blood on the head once it has been in the flesh; more after lancet nicks.
  hc = mix(hc, vec3(0.35, 0.02, 0.03), (0.35 + 0.2 * u_b.x) * smoothstep(0.3, 0.7, noise(h * 0.4 + u_seed)));
  vec4 headC = paint(hc, headA);
  // Torn-out state: a chunk of flesh snagged on the barb.
  if (u_b.y > 0.5) {
    float lump = length((h - vec2(-2.0, 5.0)) * vec2(0.8, 1.0)) - 6.5 - 2.0 * noise(h * 0.6 + 3.0);
    vec3 fc = mix(vec3(0.55, 0.12, 0.12), vec3(0.85, 0.7, 0.45), smoothstep(0.55, 0.8, noise(h * 0.9)));
    headC = over(paint(lit(fc, domeN(h - vec2(-2.0, 5.0), 8.0), 0.8, 30.0), fill(lump)), headC);
  }
  // Shaft: ash wood (arrow) or oak (bolt), round in section, grain along its length.
  float shaftEnd = u_b.z > 0.5 ? -L * 0.45 : 0.5;
  float sd = max(abs(q.y) - r, max(-L - q.x, q.x - shaftEnd));
  if (u_b.z > 0.5) sd = max(abs(q.y) - r, max(-L - q.x, q.x - shaftEnd - 3.0 * noise(vec2(q.y * 1.5, 1.0))));
  vec3 wood = bolt ? vec3(0.36, 0.25, 0.15) : vec3(0.6, 0.44, 0.26);
  wood *= 0.82 + 0.25 * noise(vec2(q.x * 0.08, q.y * 1.5 + u_seed));
  // Sinew binding behind the head and at the nock.
  float bind = step(abs(q.x + 2.5), 2.5) + step(abs(q.x + L - 36.0 + (bolt ? 14.0 : 0.0)), 2.0);
  wood = mix(wood, vec3(0.25, 0.14, 0.08) * (0.8 + 0.4 * step(0.5, fract(q.x * 0.7))), clamp(bind, 0.0, 1.0));
  vec4 shaft = paint(lit(wood, cylN(q.y, r), 0.25, 18.0), fill(sd));
  // Nock: a dark horn insert at the tail.
  float nock = sdBox(q - vec2(-L + 1.5, 0.0), vec2(2.0, r + 0.6));
  shaft = over(paint(lit(vec3(0.12, 0.09, 0.07), cylN(q.y, r + 0.6), 0.4, 20.0), fill(nock)), shaft);
  vec4 fl = fletching(q, -L + (bolt ? 3.0 : 4.0), bolt ? 18.0 : 30.0, bolt ? 5.0 : 7.5, kind > 2.5 ? 1.0 : (bolt ? 1.0 : 0.0));
  if (bolt && kind < 2.5) fl.rgb *= vec3(0.9, 0.85, 0.7) * 1.6; // wooden (parchment-pale) vanes on the plain bolt
  acc = over(shaft, fl);
  acc = over(headC, acc);
  // Hide what is still under the skin; wet the object where it meets the wound.
  float vis = skinMask(q.x, line);
  acc.rgb = mix(acc.rgb, acc.rgb * vec3(0.55, 0.12, 0.12), rsmooth(8.0, 0.0, abs(q.x - line)) * 0.6);
  acc *= vis;
  // A soft contact shadow on the flesh below the shaft.
  float sh = rsmooth(6.0, 0.0, sdSeg(q - vec2(2.0, 3.0), vec2(-L, 0.0), vec2(min(line, 20.0), 0.0))) * 0.35 * step(q.x, line);
  return over(acc, vec4(0.0, 0.0, 0.0, sh));
}

vec4 leadShot(vec2 q) {
  float R = u_a.x;
  vec2 p = q * vec2(1.0, 1.0 + u_a.y * 0.6);
  float d = length(p) - R - u_a.y * 1.2 * noise(q * 0.8);
  vec3 n = domeN(p, R);
  // Flattened: a hammered facet where it struck bone.
  n = normalize(mix(n, vec3(-0.2, 0.1, 1.0), u_a.y * rsmooth(R * 0.8, R * 0.3, length(p - vec2(R * 0.3, -R * 0.2)))));
  vec3 lead = vec3(0.42, 0.43, 0.47) * (0.85 + 0.2 * noise(q * 1.6));
  lead = mix(lead, vec3(0.25, 0.25, 0.28), smoothstep(0.6, 0.8, noise(q * 3.0 + u_seed)) * 0.5); // oxide bloom
  vec3 c = lit(lead, n, 0.45, 26.0);
  float scratch = rsmooth(0.6, 0.0, abs(sin(q.x * 0.9 + q.y * 1.7 + u_seed))) * step(0.7, noise(q * 0.5));
  c += vec3(0.35) * scratch * 0.4;
  float sink = u_a.z;
  float vis = 1.0 - sink * smoothstep(-R * 0.2, R * 0.4, q.y);
  c = mix(c, vec3(0.3, 0.03, 0.03), sink * rsmooth(3.0, 0.0, abs(q.y - R * 0.1)) * 0.6);
  float sh = rsmooth(R + 4.0, R - 1.0, length(q - vec2(1.5, 2.5))) * 0.4;
  return over(paint(c, fill(d) * vis), vec4(0.0, 0.0, 0.0, sh));
}

vec4 powder(vec2 q) {
  float R = u_a.x;
  float rr = length(q);
  // Tattooing: burnt grains driven into the skin, densest just outside the wound, thinning outward.
  float dens = exp(-pow(max(0.0, rr - R * 0.35) / (R * 0.55), 2.0));
  float gs = mix(1.1, 2.2, u_a.y);
  vec2 gp = q / (gs * 2.6);
  vec2 gi = floor(gp), gf = fract(gp);
  vec2 c = vec2(hash(gi + u_seed), hash(gi + 4.1 + u_seed)) * 0.6 + 0.2;
  float gd = length((gf - c) * gs * 2.6);
  float on = step(1.0 - dens * 0.85, hash(gi + 9.7));
  float grain = rsmooth(gs, gs * 0.4, gd) * on;
  vec3 gc = mix(vec3(0.05, 0.05, 0.08), vec3(0.2, 0.2, 0.26), hash(gi + 2.2));
  // Embedded grains glint (they catch the lamp like coal); tattoo specks stay matte blue-black.
  gc += vec3(0.4) * u_a.y * rsmooth(0.7, 0.0, length(gf - c - vec2(-0.08, -0.08)) * gs * 2.6) * on;
  float scorch = u_a.z * rsmooth(R * 1.1, R * 0.2, rr) * (0.6 + 0.4 * fbm(q * 0.08));
  vec4 base = paint(mix(vec3(0.3, 0.12, 0.06), vec3(0.08, 0.04, 0.03), smoothstep(0.3, 0.9, scorch)), scorch * 0.7);
  return over(paint(gc, grain * 0.95), base);
}

vec4 fang(vec2 q) {
  float L = u_a.x, line = u_a.y;
  bool spider = u_a.w > 0.5;
  // The fang lies along x: broken root at -L, tip at +L*0.5 inside the flesh; spider fangs hook.
  float t = clamp((q.x + L) / (L * 1.5), 0.0, 1.0);
  float bend = spider ? 7.0 * t * t : 3.0 * t * t;
  float y = q.y + bend;
  float w = (spider ? 5.0 : 7.5) * pow(1.0 - t, 0.8) + 0.3;
  float d = max(abs(y) - w, max(-L - q.x, q.x - L * 0.5));
  vec3 n = cylN(y, w);
  vec3 col;
  if (spider) {
    col = mix(vec3(0.08, 0.05, 0.03), vec3(0.45, 0.25, 0.08), smoothstep(0.3, 0.9, noise(vec2(q.x * 0.2, y * 0.8))) * 0.5);
    col = lit(col, n, 1.2, 60.0);
  } else {
    col = mix(vec3(0.9, 0.86, 0.72), vec3(0.72, 0.62, 0.42), t * 0.3 + noise(q * 0.3) * 0.2);
    col = lit(col, n, 0.6, 30.0);
    // Enamel crazing.
    col *= 1.0 - 0.18 * rsmooth(0.08, 0.0, voroEdge(q * 0.25 + u_seed));
  }
  // The root: ragged where it snapped from the jaw, stained by venom or old blood.
  float rootK = rsmooth(L * 0.45, 0.0, q.x + L);
  vec3 stain = u_b.x > 0.5 ? vec3(0.22, 0.38, 0.08) : vec3(0.42, 0.16, 0.12);
  col = mix(col, stain * (0.6 + 0.4 * noise(q * 0.7)), rootK * (0.55 + 0.35 * u_b.x));
  float rag = -L + 2.5 * noise(vec2(y * 0.9, u_seed));
  d = max(d, rag - q.x);
  col = bloodWet(col, q.x, line);
  vec4 acc = paint(col, fill(d) * skinMask(q.x, line));
  // A venom bead at the exposed tip once pulled.
  if (spider && line > L * 0.5) acc = over(paint(lit(vec3(0.35, 0.55, 0.1), domeN(q - vec2(L * 0.5 + 2.0, -bend), 2.5), 1.0, 40.0), fill(length(q - vec2(L * 0.5 + 2.0, -7.0)) - 2.5)), acc);
  return acc;
}

float glassShape(vec2 q, float s, float L) {
  // Five shard silhouettes, all long along x (the tip points +x into the flesh).
  if (s < 0.5) return sdTri(q, vec2(-L, -5.0), vec2(L * 0.45, 0.0), vec2(-L, 6.0));
  if (s < 1.5) return sdQuad(q, vec2(-L, -3.0), vec2(-L * 0.3, -7.0), vec2(L * 0.5, 0.0), vec2(-L * 0.6, 7.0));
  if (s < 2.5) return sdTri(q, vec2(-L, 0.0), vec2(L * 0.4, -3.0), vec2(-L * 0.2, 9.0));
  if (s < 3.5) return sdQuad(q, vec2(-L, -6.0), vec2(0.0, -4.0), vec2(L * 0.45, 1.0), vec2(-L * 0.9, 5.0));
  return min(sdTri(q, vec2(-L, -4.0), vec2(L * 0.45, -1.0), vec2(-L * 0.4, 3.0)), sdTri(q, vec2(-L * 0.8, 1.0), vec2(-L * 0.1, 8.0), vec2(-L * 0.3, 1.0)));
}

vec4 glass(vec2 q) {
  float L = u_a.x, line = u_a.y;
  float d = glassShape(q, floor(u_a.w + 0.5), L);
  float a = fill(d) * skinMask(q.x, line);
  // Bottle-green body you can see the flesh through, a refraction-bright rim and a sliding glint.
  vec3 body = vec3(0.55, 0.72, 0.62) * 0.55;
  float rim = rsmooth(2.2, 0.0, -d);
  float glint = rsmooth(2.0, 0.0, abs(q.x * 0.6 + q.y - 6.0 * sin(u_time * 0.8 + u_seed))) * step(d, 0.0);
  vec3 c = body + vec3(0.85, 1.0, 0.95) * rim * 0.9 + vec3(1.0) * glint * 0.8;
  float alpha = a * (0.35 + 0.6 * rim + 0.4 * glint);
  c = bloodWet(c, q.x, line);
  return vec4(c * alpha, alpha);
}

vec4 hexstone(vec2 q) {
  float L = u_a.x;
  float crackle = u_a.y, dis = u_a.z, still = u_a.w;
  // An elongated hexagonal prism of black-violet glass.
  vec2 p = q * vec2(1.0, 1.7);
  vec2 k = abs(p);
  float hexD = max(k.x * 0.5 + k.y * 0.866, k.x) - L * 0.5;
  // Facet normals: six faces plus a flat top.
  float ang = floor((atan(p.y, p.x) + PI) / (PI / 3.0));
  vec2 fdir = vec2(cos(ang * PI / 3.0 + PI / 6.0 - PI), sin(ang * PI / 3.0 + PI / 6.0 - PI));
  float top = rsmooth(L * 0.32, L * 0.28, max(k.x * 0.5 + k.y * 0.866, k.x));
  vec3 n = normalize(mix(vec3(fdir * 0.8, 1.0), vec3(0.0, 0.0, 1.0), top));
  vec3 col = lit(vec3(0.07, 0.03, 0.1), n, 1.1, 50.0);
  // Pulsing inner light: a 6-frame loop, dimmed when branded still.
  float f = frame(10.0, 6.0);
  float pulse = (0.55 + 0.45 * sin(f / 6.0 * 2.0 * PI)) * (1.0 - 0.7 * still);
  float core = exp(-length(q * vec2(0.9, 1.6)) / (L * 0.2));
  col += vec3(0.62, 0.3, 0.95) * core * pulse * 1.1 + vec3(1.0, 0.8, 1.0) * pow(core, 4.0) * pulse * 0.6;
  // The carved rune (ENG-0106): a staff with two barbs and a crossing stroke, cut into the top
  // face and glowing with the pulse — dimmer, not dark, once branded still.
  vec2 rq = q / (L * 0.5);
  float staff = rsmooth(0.07, 0.03, abs(rq.x)) * rsmooth(0.62, 0.55, abs(rq.y));
  float barbs = rsmooth(0.06, 0.02, abs(rq.y - 0.3 - abs(rq.x) * 0.9)) * rsmooth(0.35, 0.3, abs(rq.x));
  float cross = rsmooth(0.06, 0.02, abs(rq.y + 0.15 + rq.x * 0.4)) * rsmooth(0.3, 0.25, abs(rq.x));
  float rune = max(staff, max(barbs, cross)) * top;
  col += vec3(1.0, 0.72, 1.0) * rune * (0.35 + 0.65 * pulse);
  // Grab crackle: veins of light race through the crystal.
  float cr = rsmooth(0.06, 0.0, voroEdge(q * 0.18 + vec2(floor(u_time * 14.0) * 0.37, 0.0)));
  col += vec3(0.85, 0.6, 1.0) * cr * crackle;
  // Dissolve on removal: fragments burn out from the edge, leaving an ember rim.
  float ash = noise(q * 0.35 + u_seed) + (1.0 - clamp(-hexD / (L * 0.5), 0.0, 1.0)) * 0.4;
  float keep = step(dis * 1.4, ash);
  float ember = dis > 0.0 ? rsmooth(0.08, 0.0, abs(ash - dis * 1.4)) : 0.0;
  float a = fill(hexD) * keep;
  vec4 c = paint(col, a);
  return over(paint(vec3(0.85, 0.5, 1.0) * 1.5, max(ember * fill(hexD), 0.0)), c);
}

// ---------------------------------------------------------------- burns

vec4 fireBurn(vec2 q) {
  float R = u_a.x, sev = u_a.y, cool = u_a.z;
  float r = length(q) / R + (fbm(q * 0.05 + u_seed) - 0.5) * 0.35;
  // Erythema: an angry red halo, calmed to pink by salve.
  vec3 red = mix(vec3(0.8, 0.14, 0.08), vec3(0.85, 0.5, 0.45), cool);
  float halo = rsmooth(1.3, 0.45, r) * (0.55 + 0.3 * noise(q * 0.12));
  vec4 acc = paint(red, halo * (0.8 - 0.3 * cool));
  // Raw, weeping bed where the skin has lifted (from severity 0.33).
  float rawK = smoothstep(0.3, 0.5, sev) * rsmooth(0.95, 0.7, r);
  vec3 raw = lit(mix(vec3(0.72, 0.16, 0.14), vec3(0.85, 0.5, 0.45), cool), bumpN(q * 0.07 + 2.0, 1.5), 1.0 * (1.0 - cool * 0.5), 45.0);
  acc = over(paint(raw, rawK * 0.8), acc);
  // Blisters: glossy fluid domes on the mid band.
  vec2 id;
  float cs = R * 0.34;
  float cd = cellD(q / cs, id);
  float bR = 0.36 + 0.14 * hash(id);
  float bl = step(0.3, hash(id + 2.0)) * smoothstep(0.3, 0.55, sev) * rsmooth(1.0, 0.75, r) * step(0.4 * smoothstep(0.66, 1.0, sev), r);
  float blister = rsmooth(bR, bR - 0.08, cd) * bl;
  vec3 bn = domeN(cellOff, bR);
  vec3 bc = lit(mix(vec3(0.96, 0.88, 0.66), vec3(0.9, 0.6, 0.5), 0.35 * cd / bR), bn, 1.3, 70.0);
  // Some blisters have burst and weep: a collapsed skin flap over a wet red base.
  float wept = step(0.72, hash(id + 5.0));
  bc = mix(bc, lit(vec3(0.75, 0.25, 0.2), bn, 1.4, 70.0), wept * 0.75);
  acc = over(paint(bc, blister * 0.95), acc);
  // Char: cracked black eschar with ember fissures in the core (from severity 0.66).
  float dragon = u_a.w;
  float charR = dragon > 0.0 ? 0.88 : smoothstep(0.55, 1.0, sev) * 0.65;
  float ch = rsmooth(charR, charR - 0.12, r);
  float crack = rsmooth(0.07, 0.0, voroEdge(q * 0.09 + u_seed));
  float ember = crack * (0.6 + 0.4 * sin(u_time * 3.0 + q.x * 0.1)) * (1.0 - cool);
  vec3 cc = lit(vec3(0.07, 0.05, 0.04) * (0.8 + 0.4 * noise(q * 0.3)), bumpN(q * 0.08, 3.0), 0.25, 12.0);
  cc = mix(cc, mix(vec3(0.15, 0.1, 0.08), vec3(1.0, 0.35, 0.06), 1.0 - cool), crack * 0.8);
  cc += vec3(1.0, 0.45, 0.1) * ember * 0.5;
  // Dragon-breath (ENG-0263): the fissures run molten — HDR emissive above 1.0 so bloom takes it —
  // breathing slowly and dimming as the bed cools.
  if (dragon > 0.0) {
    float wide = rsmooth(0.14, 0.0, voroEdge(q * 0.05 + u_seed + 4.0));
    float breathe = 0.75 + 0.25 * sin(u_time * 1.7 + hash(floor(q * 0.05)) * 6.0);
    cc += vec3(2.4, 0.9, 0.22) * max(crack, wide * 0.8) * dragon * breathe;
  }
  // Ember speckle (ENG-0101): sparse sparks winking in the char until it cools.
  vec2 sp = floor(q * 0.35);
  float spark = step(0.93, hash(sp + u_seed)) * rsmooth(0.35, 0.1, length(fract(q * 0.35) - 0.5));
  cc += vec3(1.0, 0.55, 0.15) * spark * (0.5 + 0.5 * sin(u_time * 7.0 + hash(sp) * 30.0)) * (1.0 - cool);
  acc = over(paint(cc, ch), acc);
  if (dragon > 0.0) {
    // Dragon-breath's crater edge (ART-0208): flesh fused to a glassy black lip that catches the light.
    float lip = rsmooth(0.07, 0.0, abs(r - charR - 0.02 + (fbm(q * 0.08 + u_seed) - 0.5) * 0.05));
    vec3 glass = lit(vec3(0.05, 0.04, 0.05), bumpN(q * 0.15, 4.0), 2.4, 140.0);
    acc = over(paint(glass, lip * 0.9), acc);
  }
  return acc * (1.0 - 0.3 * cool);
}

vec4 acidBurn(vec2 q) {
  float R = u_a.x, neu = u_a.y;
  float r = length(q) / R + (fbm(q * 0.06 + u_seed) - 0.5) * 0.3;
  float m = rsmooth(1.0, 0.8, r);
  // Etched pits: the acid eats a pocked, terraced bed.
  vec2 id;
  float pit = cellD(q / 7.0, id);
  float pits = rsmooth(0.35, 0.18, pit);
  vec3 bed = mix(vec3(0.62, 0.66, 0.16), vec3(0.34, 0.3, 0.1), pits * 0.7 + 0.3 * smoothstep(0.2, 0.8, r));
  bed = mix(bed, vec3(0.45, 0.36, 0.3), neu * 0.8); // neutralised: a dull grey-brown scab
  vec3 c = lit(bed, bumpN(q * 0.12, 2.5 * (1.0 - pits)), 0.9 * (1.0 - neu), 30.0);
  // Etched rim: a raised yellow tideline.
  float rim = rsmooth(0.08, 0.0, abs(r - 0.92));
  c = mix(c, vec3(0.9, 0.85, 0.3) * (1.0 - neu * 0.5), rim * 0.7);
  vec4 acc = paint(c, max(m, rim) * 0.85);
  // Bubbling: a 6-frame loop of beads that swell and pop, stopped once neutralised.
  float f = frame(10.0, 6.0);
  vec2 bp = q / (R * 0.28);
  vec2 bi = floor(bp), bf = fract(bp);
  float ph = mod(f + floor(hash(bi) * 6.0), 6.0) / 5.0;
  float br = mix(0.08, 0.3, ph) * step(ph, 0.9);
  vec2 bc = vec2(hash(bi + 1.3), hash(bi + 7.1)) * 0.5 + 0.25;
  float bub = rsmooth(br, br - 0.05, length(bf - bc)) * step(0.4, hash(bi + 3.3)) * (1.0 - neu) * m;
  vec3 bcol = lit(vec3(0.8, 0.9, 0.35), domeN((bf - bc) * 3.0, br * 3.0), 1.4, 60.0);
  acc = over(paint(bcol, bub * 0.9), acc);
  // Froth (ENG-0101): a fine yellow-green foam scum over the live bed, gone once neutralised.
  float froth = smoothstep(0.55, 0.8, noise(q * 0.45 + u_time * 0.6)) * smoothstep(0.45, 0.7, fbm(q * 0.08 + u_seed + 2.0));
  acc = over(paint(vec3(0.86, 0.94, 0.55), froth * m * (1.0 - neu) * 0.55), acc);
  return acc;
}

vec4 hexfireEdge(vec2 q) {
  float R = u_a.x, k = u_a.y;
  float rr = length(q);
  float ang = atan(q.y, q.x);
  // Licking flame tongues: an 8-frame flipbook of rising tongues along the burn's rim.
  float f = frame(12.0, 8.0);
  float tongue = fbm(vec2(ang * 5.0, rr * 0.05 - f * 0.45) + u_seed);
  float edge = rr - R * (0.85 + 0.35 * tongue);
  float flame = rsmooth(R * 0.25, 0.0, edge) * smoothstep(-R * 0.35, 0.0, edge);
  vec3 c = mix(vec3(0.3, 0.05, 0.5), vec3(0.85, 0.6, 1.0), smoothstep(0.2, 0.9, flame));
  c = mix(c, vec3(1.0, 0.92, 1.0), pow(flame, 4.0) * 0.6);
  // Violet core scorch inside the ring.
  float core = rsmooth(R * 0.85, R * 0.3, rr) * 0.45;
  vec4 acc = paint(vec3(0.12, 0.02, 0.16), core * k);
  return over(paint(c, flame * k), acc);
}

// ---------------------------------------------------------------- disease

vec4 bubo(vec2 q) {
  float R = u_a.x, ripe = u_a.y, burst = u_a.z, drained = u_a.w;
  float r = length(q);
  float d = r - R;
  vec3 n = domeN(q, R * (1.0 - drained * 0.5));
  // Deflated: the skin collapses into wrinkles around an open crater.
  float wr = sin(r * 0.9 + atan(q.y, q.x) * 3.0) * drained;
  n = normalize(n + vec3(normalize(q + 0.001) * wr * 0.4, 0.0));
  vec3 skin = mix(vec3(0.72, 0.28, 0.24), vec3(0.95, 0.8, 0.5), rsmooth(R * (0.35 + 0.25 * ripe), 0.0, r) * (1.0 - drained));
  // Pus shadow (ENG-0102): the pus pools low under the taut skin, a murky yellow-grey crescent.
  float pool = rsmooth(R * 0.7, R * 0.15, length(q - vec2(0.0, R * 0.3))) * step(r, R) * ripe * (1.0 - drained);
  skin = mix(skin, vec3(0.5, 0.42, 0.2), pool * 0.4);
  // Taut veins crawl across the swelling as it ripens.
  float vein = pow(1.0 - abs(fbm(q * 0.12 + u_seed) * 2.0 - 1.0), 12.0) * ripe * (1.0 - drained);
  skin = mix(skin, vec3(0.4, 0.05, 0.12), vein * 0.8);
  // Tension shine: a hard lamp highlight that tightens as it ripens.
  vec3 c = lit(skin, n, 0.4 + 1.2 * ripe * (1.0 - drained), mix(20.0, 90.0, ripe));
  vec4 acc = paint(c, fill(d));
  // Burst flipbook (6 frames): the crown splits in a star, pus wells and runs.
  if (burst > 0.0) {
    float bf = floor(burst * 5.99) / 5.0;
    float a = atan(q.y, q.x);
    float star = r - R * 0.6 * bf * (0.55 + 0.45 * abs(sin(a * 2.5 + u_seed)));
    vec3 pus = lit(vec3(0.85, 0.78, 0.35), domeN(q, R * 0.6), 1.0, 50.0);
    acc = over(paint(mix(vec3(0.2, 0.03, 0.03), pus, smoothstep(0.2, 0.8, bf)), fill(star) * (1.0 - drained)), acc);
  }
  if (drained > 0.0) acc = over(paint(vec3(0.18, 0.02, 0.03), fill(r - R * 0.22) * drained), acc);
  // Inflamed areola around the base.
  float areola = rsmooth(R * 1.6, R * 0.9, r) * step(R, r) * 0.5 * (1.0 - drained * 0.6);
  return over(acc, paint(vec3(0.7, 0.12, 0.1), areola));
}

vec4 rot(vec2 q) {
  float R = u_a.x;
  float stage = (floor(clamp(u_a.y, 0.0, 1.0) * 3.99) + 1.0) / 4.0;
  float deb = u_a.z;
  float r = length(q) / (R * (0.4 + 0.6 * stage)) + (fbm(q * 0.04 + u_seed) - 0.5) * 0.45;
  float m = rsmooth(1.0, 0.72, r);
  // Necrotic bed: black-green at the heart, bruised violet-brown and dusky toward the margin.
  vec3 bed = mix(vec3(0.05, 0.08, 0.03), vec3(0.24, 0.28, 0.1), fbm(q * 0.1 + 3.0));
  bed = mix(bed, vec3(0.36, 0.18, 0.2), smoothstep(0.45, 0.95, r) * 0.8);
  // Pus-slick wet map: glossy yellow-green sheets over the necrosis.
  float slick = smoothstep(0.5, 0.72, fbm(q * 0.06 + 9.0)) * rsmooth(0.8, 0.3, r);
  bed = mix(bed, vec3(0.7, 0.66, 0.24), slick * 0.45);
  // Stage ramp (ENG-0102): angry red → bruised purple → black as it deepens, drying as it goes.
  vec3 ramp = stage < 0.4 ? vec3(0.55, 0.1, 0.1) : stage < 0.6 ? vec3(0.3, 0.08, 0.28) : vec3(0.04, 0.03, 0.04);
  bed = mix(bed, ramp, rsmooth(0.9, 0.2, r) * mix(0.55, 0.35, stage));
  float wetness = mix(1.2, 0.35, stage);
  vec3 c = lit(bed, bumpN(q * 0.09, 2.0), (0.2 + 1.4 * slick) * wetness, 50.0);
  // Crusted edge: a raised, flaking brown rind.
  float crust = rsmooth(0.16, 0.02, abs(r - 0.86)) * (0.55 + 0.45 * noise(q * 0.4));
  vec3 cc = lit(vec3(0.42, 0.26, 0.12) * (0.7 + 0.5 * noise(q * 0.8)), bumpN(q * 0.3, 5.0), 0.2, 10.0);
  c = mix(c, cc, crust);
  // Inflamed margin beyond the crust.
  float margin = rsmooth(1.35, 0.9, r) * step(0.9, r) * 0.45;
  // Debrided: the dead tissue scraped back to a clean, bleeding bed.
  vec3 clean = lit(vec3(0.72, 0.14, 0.14), bumpN(q * 0.05, 1.0), 1.1, 50.0);
  float db = step(fbm(q * 0.07 + 5.0) + 0.15, deb * 1.2) * rsmooth(1.0, 0.8, r);
  c = mix(c, clean, db);
  return over(paint(c, max(m, crust)), paint(vec3(0.6, 0.12, 0.12), margin));
}

vec4 pox(vec2 q) {
  float R = u_a.x;
  float rr = length(q);
  vec2 id;
  float cs = 13.0;
  float cd = cellD(q / cs, id);
  vec2 off2 = cellOff;
  float on = step(0.25, hash(id)) * rsmooth(R, R * 0.55, length(q - off2 * cs));
  float pr = 0.26 + 0.12 * hash(id + 1.0);
  float popped = step(hash(id + 4.0), u_a.y);
  vec3 n = domeN(off2, pr);
  // Umbilicated pustule: a pearly head with a dimpled centre; lanced ones crust over.
  vec3 head = mix(vec3(0.96, 0.92, 0.66), vec3(0.34, 0.16, 0.08), popped);
  head *= 1.0 - 0.25 * rsmooth(pr * 0.3, 0.0, cd) * (1.0 - popped);
  vec3 c = lit(head, n, 1.2 * (1.0 - popped) + 0.1, 55.0);
  float pust = rsmooth(pr, pr - 0.06, cd) * on;
  float areola = rsmooth(pr + 0.24, pr, cd) * on;
  vec4 acc = paint(vec3(0.78, 0.16, 0.14), areola * 0.75);
  return over(paint(c, pust), acc) * rsmooth(R * 1.1, R * 0.8, rr);
}

vec4 venomWeb(vec2 q) {
  float R = u_a.x, neu = u_a.y;
  float rr = length(q);
  float a = atan(q.y, q.x);
  // Branching veins: ridges in warped polar noise, several scales, thinning with distance.
  float web = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float k = 4.0 + fi * 3.0;
    float warp = fbm(q * (0.03 + fi * 0.02) + u_seed + fi) * 3.0;
    float ridge = 1.0 - abs(sin(a * k + warp + rr * 0.02 * fi));
    web = max(web, pow(ridge, 6.0 + fi * 6.0) * (1.0 - fi * 0.2) * step(fi * R * 0.2, rr));
  }
  float reach = rsmooth(R, R * 0.6, rr + (fbm(q * 0.05) - 0.5) * R * 0.4);
  float halo = rsmooth(R * 1.1, 0.0, rr) * 0.3;
  vec3 ink = u_col;
  vec3 c = mix(ink, vec3(0.75, 0.68, 0.35), neu);
  // Green-black cores (ENG-0102): the venom tracks along the vein centres.
  c = mix(c, vec3(0.03, 0.08, 0.03), smoothstep(0.6, 0.95, web) * (1.0 - neu) * 0.7);
  vec4 acc = paint(mix(vec3(0.3, 0.4, 0.15), vec3(0.6, 0.55, 0.3), neu), halo * 0.6);
  return over(paint(c, smoothstep(0.25, 0.7, web) * reach), acc) * (1.0 - neu * 0.85);
}

// ---------------------------------------------------------------- vermin

vec4 grub(vec2 q) {
  float L = u_a.x;
  float bur = u_a.y, squirm = u_a.z, heat = u_a.w;
  // Crawl cycle: an 8-frame peristaltic wave from tail to head; squirming curls it (4-frame loop).
  float f = frame(12.0, 8.0);
  float sf = frame(10.0, 4.0);
  float curl = squirm * (sf < 2.0 ? sf - 0.5 : 2.5 - sf) * 0.9;
  vec4 acc = vec4(0.0);
  float segs = 7.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float t = fi / (segs - 1.0);           // 0 head .. 1 tail
    float wave = sin((t * 8.0 - f) / 8.0 * 2.0 * PI);
    float x = L * 0.5 - t * L + wave * 1.4 * (1.0 - squirm);
    float y = sin(t * PI * 1.5 + curl * 2.0) * curl * L * 0.18;
    float rs = L * (0.13 - 0.05 * t * t) * (1.0 + 0.12 * wave) * (1.0 + heat * 0.25);
    vec2 d = q - vec2(x, y);
    float sd = length(d * vec2(0.9, 1.0)) - rs;
    vec3 body = mix(vec3(0.9, 0.86, 0.7), vec3(0.78, 0.72, 0.56), t);
    // The gut shows through the translucent body as a dark streak.
    body = mix(body, vec3(0.35, 0.28, 0.2), rsmooth(rs * 0.35, 0.0, abs(d.y)) * 0.45 * step(0.5, fi));
    body = mix(body, vec3(0.25, 0.1, 0.05), heat * 0.7);
    vec3 c = lit(body, domeN(d, rs), 0.7, 30.0);
    // Head capsule and mandibles.
    if (i == 0) {
      c = lit(vec3(0.22, 0.13, 0.08), domeN(d, rs), 0.9, 40.0);
      float mand = min(sdSeg(q, vec2(x + rs * 0.8, y - rs * 0.35), vec2(x + rs * 1.4, y - rs * 0.1)), sdSeg(q, vec2(x + rs * 0.8, y + rs * 0.35), vec2(x + rs * 1.4, y + rs * 0.1))) - 0.8;
      acc = over(acc, paint(vec3(0.1, 0.05, 0.03), fill(mand)));
    }
    acc = over(acc, paint(c, fill(sd)));
  }
  // Burrowing: the body disappears head-first into a puckered hole in the flesh.
  float line = L * 0.62 - bur * L * 1.35;
  float hole = length((q - vec2(line, 0.0)) * vec2(1.3, 1.0)) - L * 0.16;
  acc *= skinMask(q.x, line) * (1.0 - step(0.999, bur));
  vec4 pit = paint(vec3(0.25, 0.03, 0.04), fill(hole) * step(0.02, bur) * (1.0 - step(0.999, bur) * 0.3));
  return over(acc, pit);
}

vec4 eggSac(vec2 q) {
  float R = u_a.x, hatch = u_a.y, lift = u_a.z, swell = u_a.w;
  // Pulsing loop (8 frames), quicker and larger as the sac swells toward hatching.
  float f = frame(8.0 + swell * 8.0, 8.0);
  float pulse = 1.0 + (0.04 + swell * 0.06) * sin(f / 8.0 * 2.0 * PI);
  vec2 p = q / pulse;
  float r = length(p * vec2(1.0, 1.15));
  float d = r - R;
  vec4 acc = vec4(0.0);
  // Translucent membrane, veined, with the lamp's sheen.
  vec3 mem = mix(vec3(0.85, 0.82, 0.7), vec3(0.62, 0.58, 0.44), smoothstep(0.3, 1.0, r / R));
  float vein = pow(1.0 - abs(fbm(p * 0.1 + u_seed) * 2.0 - 1.0), 14.0);
  mem = mix(mem, vec3(0.5, 0.2, 0.2), vein * 0.6);
  vec3 n = domeN(p, R);
  // Eggs packed inside: pale spheres, each with a curled dark embryo that stirs.
  vec2 id;
  float cd = cellD(p / (R * 0.32), id);
  float egg = rsmooth(0.42, 0.36, cd) * rsmooth(R * 0.85, R * 0.7, r);
  vec2 eo = vec2(hash(id), hash(id + 2.0)) - 0.5;
  float ea = f * 0.3 + hash(id) * 6.0;
  vec2 ep = (p / (R * 0.32) - (id + 0.5)) * rot2(ea);
  float emb = rsmooth(0.2, 0.12, length(ep * vec2(1.0, 1.8) + eo * 0.1)) * egg;
  vec3 ec = mix(vec3(0.95, 0.93, 0.8), vec3(0.16, 0.1, 0.05), emb * (0.75 + 0.25 * hatch));
  // Each egg is its own glossy bead under the membrane.
  vec3 eggN = domeN(cellOff, 0.42);
  vec3 inside = mix(mem * 0.8, lit(ec, eggN, 0.9, 40.0), egg);
  vec3 c = lit(inside, n, 0.8, 45.0) * 0.8 + inside * 0.3;
  // Translucent: the flesh shows between the eggs; the membrane's rim catches the lamp.
  float rimL = smoothstep(0.75, 1.0, r / R);
  float alpha = fill(d) * (0.45 + 0.5 * egg + 0.4 * rimL);
  // Hatch flipbook (8 frames): the membrane tears and the brood wriggles free.
  float hf = floor(hatch * 7.99) / 7.0;
  float tear = rsmooth(0.12, 0.0, voroEdge(p * 0.07 + u_seed)) * step(0.01, hatch) * hf;
  c = mix(c, vec3(0.15, 0.02, 0.02), tear * 0.9);
  alpha *= 1.0 - tear * hf * 0.6;
  acc = paint(c, alpha);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ang = fi * 1.57 + u_seed;
    vec2 gp = vec2(cos(ang), sin(ang)) * R * (0.4 + hf * 0.9);
    vec2 gd = (q - gp) * rot2(-ang);
    float wrig = sin(u_time * 14.0 + fi * 2.0) * 1.2;
    float g = length((gd - vec2(0.0, wrig * 0.3)) * vec2(0.55, 1.0)) - R * 0.12;
    acc = over(paint(lit(vec3(0.88, 0.84, 0.66), domeN(gd, R * 0.12), 0.6, 30.0), fill(g) * step(0.3, hf)), acc);
  }
  // Lifted in tongs: strands of tissue stretch back to the bed.
  if (lift > 0.0) {
    float strand = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i) - 1.0;
      strand = max(strand, rsmooth(1.2, 0.0, sdSeg(q, vec2(fi * R * 0.4, R * 0.7), vec2(fi * R * 0.7, R * (0.8 + lift * 1.4)))));
    }
    acc = over(acc, paint(vec3(0.7, 0.35, 0.3), strand * 0.8 * lift));
  }
  float sh = rsmooth(R * 1.25, R * 0.8, length(q - vec2(3.0, 5.0))) * 0.35 * (1.0 - lift);
  return over(acc, vec4(0.0, 0.0, 0.0, sh));
}

// ---------------------------------------------------------------- wounds and closure

vec4 woundStrip(vec2 q) {
  float L = u_a.x, W = u_a.y, open = u_a.z, claw = u_a.w;
  // The cut opens over 6 frames.
  float op = floor(clamp(open, 0.0, 1.0) * 5.99 + 0.01) / 5.0;
  // Along a polyline each segment is drawn separately: b.z is where this segment starts along the
  // whole cut and b.w the cut's full length, so the lens taper closes only at the true ends.
  float total = u_b.w > 0.0 ? u_b.w : L;
  float along = (u_b.w > 0.0 ? u_b.z : 0.0) + q.x + L * 0.5;
  float t = clamp(along / total * 2.0 - 1.0, -1.0, 1.0);
  float prof = sqrt(max(0.0, 1.0 - t * t));
  float rag = claw * (noise(vec2(along * 0.35, sign(q.y) * 3.0 + u_seed)) - 0.5) * W * 0.9;
  float hw = W * op * prof + rag * prof;
  float ay = abs(q.y);
  float inX = rsmooth(L * 0.5 + 0.5, L * 0.5 - 0.5, abs(q.x));
  // Gap: deep, wet oxblood, with blood welling on the heartbeat.
  float gap = fill(ay - hw) * inX;
  float depth = clamp(1.0 - ay / max(hw, 0.5), 0.0, 1.0);
  vec3 wound = mix(vec3(0.55, 0.06, 0.06), vec3(0.18, 0.0, 0.02), depth);
  // Muscle fibres run across the floor of the cut.
  wound *= 0.85 + 0.2 * sin((along * 0.6 + q.y * 1.4) * 1.3);
  float well = u_b.x * (0.6 + 0.4 * u_b.y);
  wound = mix(wound, vec3(0.62, 0.02, 0.04), well * depth * 0.6);
  vec3 wn = normalize(vec3(0.0, -q.y / max(hw, 0.5) * 0.5, 1.0));
  vec3 wc = lit(wound, wn, 0.9 + well, 60.0);
  // Fat layer: a thin yellow band inside the lips (not on claw rakes, which tear through it raggedly).
  float fat = fill(ay - hw - 1.4) * (1.0 - gap) * inX * step(0.05, op);
  vec3 fc = lit(vec3(0.9, 0.76, 0.42), vec3(0.0, sign(q.y) * 0.5, 0.87), 0.6, 30.0);
  // Skin lips: raised, pinched and lit on the lamp side.
  float lipW = 3.5 + W * 0.3;
  float lip = fill(ay - hw - 1.4 - lipW) * (1.0 - fill(ay - hw - 1.4)) * inX;
  float lt = clamp((ay - hw - 1.4) / lipW, 0.0, 1.0);
  vec3 ln = normalize(vec3(0.0, sign(q.y) * (1.0 - 2.0 * lt) * 0.8, 1.0));
  vec3 lc = lit(vec3(0.62, 0.26, 0.22), ln, 0.18, 25.0);
  vec4 acc = paint(lc, lip * (0.2 + 0.4 * op) * (1.0 - lt * 0.6));
  acc = over(paint(fc, fat * 0.75), acc);
  acc = over(paint(wc, gap), acc);
  // Blood running over the lip at the lowest point.
  return acc;
}

vec4 gutStitch(vec2 q) {
  // One crossing: the thread spans the wound (along y), knotted on the far side.
  float S = u_a.x, tight = clamp(u_a.y, 0.0, 1.0);
  // Tightening pull: slack loop → drawn taut (2 frames).
  float slack = (1.0 - step(0.5, tight)) * 2.5;
  float y = q.y;
  float bow = slack * (1.0 - (y / S) * (y / S));
  float d = abs(q.x - bow) - 1.1;
  d = max(d, abs(y) - S);
  vec3 gut = vec3(0.78, 0.66, 0.42) * (0.85 + 0.2 * sin(y * 2.2));
  vec3 c = lit(gut, normalize(vec3((q.x - bow) / 1.1 * 0.8, 0.0, 0.6)), 0.7, 30.0);
  vec4 acc = paint(c, fill(d));
  // Puncture holes where the needle went in and out.
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0;
    float hole = length(q - vec2(0.0, s * S)) - 1.8;
    acc = over(acc, paint(vec3(0.35, 0.03, 0.04), fill(hole)));
  }
  // The knot: a lumpy double throw with two short tails.
  vec2 kq = q - vec2(0.0, S + 0.5);
  float knot = length(kq * vec2(1.0, 1.3)) - 2.6;
  float tails = min(sdSeg(kq, vec2(0.0), vec2(4.5, 3.5)), sdSeg(kq, vec2(0.0), vec2(-4.0, 4.0))) - 0.6;
  acc = over(paint(lit(gut * 0.9, domeN(kq, 2.6), 0.8, 30.0), fill(min(knot, tails))), acc);
  float sh = rsmooth(2.5, 0.0, abs(q.x - bow - 1.2)) * step(abs(y), S) * 0.3;
  return over(acc, vec4(0.0, 0.0, 0.0, sh));
}

vec4 scar(vec2 q) {
  float L = u_a.x, W = u_a.y, age = u_a.z;
  float t = clamp(q.x / (L * 0.5), -1.0, 1.0);
  float prof = sqrt(max(0.0, 1.0 - t * t));
  float hw = W * (0.35 + 0.65 * prof);
  float d = abs(q.y) - hw;
  float inX = rsmooth(L * 0.5 + 1.0, L * 0.5 - 1.0, abs(q.x));
  // A raised, pink-to-pale ridge with a glossy crown; stitch tracks cross it every 11 px.
  vec3 col = mix(vec3(0.78, 0.36, 0.36), vec3(0.86, 0.66, 0.6), age);
  vec3 c = lit(col, cylN(q.y, hw), 0.5, 30.0);
  float track = rsmooth(1.2, 0.3, abs(mod(q.x, 11.0) - 5.5)) * rsmooth(hw + 4.5, hw + 3.0, abs(q.y)) * step(hw * 0.4, abs(q.y));
  vec4 acc = paint(c, fill(d) * inX * 0.85);
  return over(paint(mix(vec3(0.5, 0.15, 0.15), vec3(0.7, 0.5, 0.45), age), track * inX * 0.8), acc);
}

vec4 salvePaste(vec2 q) {
  float R = u_a.x, ab = clamp(u_a.y, 0.0, 1.0);
  float r = length(q) / R + (noise(q * 0.2 + u_seed) - 0.5) * 0.35;
  float m = rsmooth(1.0, 0.75, r);
  // Pale-gold paste, thick at the centre, glistening; it thins and dulls as it is absorbed.
  vec3 n = bumpN(q * 0.1 + u_seed, 3.0 * (1.0 - ab));
  vec3 c = lit(vec3(0.92, 0.8, 0.5), n, 1.3 * (1.0 - ab), 60.0);
  return paint(c, m * (0.75 * (1.0 - ab)));
}

vec4 spurt(vec2 q) {
  float L = u_a.x;
  // Arterial spurt flipbook (6 frames): a jet leaves the vessel, breaks into droplets and falls.
  float f = floor(clamp(u_a.y, 0.0, 1.0) * 5.99) / 5.0;
  float reach = L * (0.3 + 0.7 * f);
  float t = clamp(q.x / reach, 0.0, 1.0);
  float arc = -sin(t * PI) * L * 0.18 * (0.5 + f);
  float w = mix(3.5, 1.5, t) * (1.0 - f * 0.5);
  float jet = fill(abs(q.y - arc) - w) * step(0.0, q.x) * step(q.x, reach * (1.0 - f * 0.5));
  vec4 acc = paint(lit(vec3(0.62, 0.02, 0.04), normalize(vec3(0.0, (q.y - arc) / max(w, 0.1) * 0.7, 0.7)), 1.0, 50.0), jet);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float dx = reach * (0.45 + fi * 0.12) + hash(vec2(fi, u_seed)) * 8.0;
    float dy = -sin(clamp(dx / reach, 0.0, 1.0) * PI) * L * 0.18 * (0.5 + f) + (hash(vec2(fi + 3.0, u_seed)) - 0.5) * 10.0 * f;
    float dr = mix(2.8, 1.2, fi / 6.0) * step(0.25, f);
    float drop = length(q - vec2(dx, dy)) - dr;
    acc = over(acc, paint(lit(vec3(0.55, 0.02, 0.04), domeN(q - vec2(dx, dy), dr), 1.0, 50.0), fill(drop)));
  }
  return acc;
}

vec4 silk(vec2 q) {
  float L = u_a.x, cut = u_a.y;
  // Brood silk: a sagging bundle of strands; once cut the two halves recoil and curl.
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float off = (fi - 2.0) * 2.4 + sin(fi * 3.1 + u_seed) * 1.5;
    float sag = sin(clamp(q.x / L + 0.5, 0.0, 1.0) * PI) * (3.0 + fi);
    float gapX = cut * L * 0.35;
    // Recoiled ends curl back on themselves near the cut.
    float nearCut = rsmooth(L * 0.2, 0.0, abs(q.x) - gapX);
    float y = off * (1.0 + cut * nearCut * 1.5) + sag * (1.0 - cut * 0.6) - cut * nearCut * nearCut * 6.0;
    float d = abs(q.y - y) - 0.55;
    float inX = rsmooth(L * 0.5, L * 0.5 - 1.0, abs(q.x)) * step(gapX, abs(q.x));
    float glint = pow(max(0.0, sin(q.x * 0.15 + u_time * 1.5 + fi)), 8.0);
    acc = over(paint(vec3(0.9, 0.88, 0.82) + glint * 0.5, fill(d) * inX * 0.8), acc);
  }
  return acc;
}


// ---------------------------------------------------------------- the Malison's thread

/** A point on one of the three thread-knot curves (t in 0..2π), in units of the knot radius. */
vec2 knotAt(float shape, float t) {
  if (shape < 0.5) return vec2(sin(t) + 2.0 * sin(2.0 * t), cos(t) - 2.0 * cos(2.0 * t)) / 3.0; // trefoil
  if (shape < 1.5) return vec2(sin(t) * 0.9, sin(2.0 * t) * 0.55) + vec2(0.0, 0.15 * cos(t)); // figure-of-eight
  return vec2(sin(3.0 * t + 1.0), sin(4.0 * t)) * 0.85; // tangle
}

vec4 threadKnot(vec2 q) {
  float R = u_a.x, shape = floor(u_a.y + 0.5), burst = clamp(u_a.z, 0.0, 1.0), crawler = u_a.w;
  // Drift loop: a slow turn and bob.
  q = rot2(sin(u_time * 0.6 + u_seed) * 0.35) * (q - vec2(0.0, sin(u_time * 1.3 + u_seed) * 1.5));
  // Burst on kill: 8 frames; the thread snaps into pieces that fly outward and fade.
  float bf = floor(burst * 7.99) / 7.0;
  float d = 1e9;
  float along = 0.0;
  const int N = 36;
  vec2 prev = knotAt(shape, 0.0) * R;
  for (int i = 1; i <= N; i++) {
    float t = float(i) / float(N) * 6.2831853;
    vec2 cur = knotAt(shape, t) * R;
    vec2 mid = (prev + cur) * 0.5;
    vec2 off = normalize(mid + 0.001) * bf * R * 1.6 * (0.6 + 0.8 * hash(vec2(float(i), u_seed)));
    float sd = sdSeg(q, prev + off, cur + off);
    if (sd < d) { d = sd; along = t; }
    prev = cur;
  }
  float w = mix(2.4, 1.2, bf);
  float m = fill(d - w);
  // Twisted violet thread: a two-ply sheen along its length, gold motes caught in the weave.
  float ply = 0.5 + 0.5 * sin(along * 30.0 + d * 2.0);
  vec3 thread = mix(vec3(0.35, 0.1, 0.55), vec3(0.8, 0.55, 1.0), ply * rsmooth(w, 0.0, d));
  thread = mix(thread, vec3(0.85, 0.25, 0.3), crawler * 0.6);
  thread += vec3(1.0, 0.8, 0.35) * step(0.93, hash(vec2(floor(along * 6.0), u_seed))) * 0.6;
  float glow = rsmooth(R * 0.6, 0.0, d) * 0.25 * (1.0 - bf);
  vec4 acc = paint(thread, m * (1.0 - bf * bf));
  return over(acc, paint(mix(vec3(0.5, 0.2, 0.8), vec3(0.9, 0.3, 0.3), crawler), glow));
}

vec4 spool(vec2 q) {
  // The boss's life as thread on a bobbin (side view, axis along x): the winding thins as it is hurt.
  float frac = clamp(u_a.x, 0.0, 1.0), flash = u_a.y, spin = u_a.z;
  float W = u_size.x * 0.34, H = u_size.y * 0.4;
  float core = H * 0.28;
  float wind = core + (H * 0.86 - core) * frac;
  vec4 acc = vec4(0.0);
  // Core (turned oak).
  float coreD = max(abs(q.x) - W, abs(q.y) - core);
  acc = paint(lit(vec3(0.42, 0.27, 0.14), cylN(q.y, core), 0.3, 20.0), fill(coreD));
  // Wound thread: fine helical turns that scroll while it unwinds.
  float windD = max(abs(q.x) - W + 1.0, abs(q.y) - wind);
  float turns = 0.5 + 0.5 * sin((q.x * 1.6 + q.y * 0.35 + spin * 18.0) * 2.2);
  vec3 th = mix(vec3(0.32, 0.1, 0.5), vec3(0.78, 0.52, 1.0), turns);
  th = mix(th, vec3(1.0, 0.85, 0.7), flash * 0.7);
  acc = over(paint(lit(th, cylN(q.y, max(wind, 0.5)), 0.6, 30.0), fill(windD) * step(0.001, frac)), acc);
  // Flanges: two oak discs seen edge-on, brass-capped.
  for (int i = 0; i < 2; i++) {
    float sx = i == 0 ? -1.0 : 1.0;
    vec2 fq = q - vec2(sx * (W + 1.5), 0.0);
    float fd = sdBox(fq, vec2(2.5, H));
    vec3 fc = lit(vec3(0.3, 0.18, 0.09), normalize(vec3(sx * 0.2, fq.y / H * 0.8, 1.0)), 0.4, 20.0);
    fc = mix(fc, vec3(0.8, 0.62, 0.3), rsmooth(1.5, 0.0, H - abs(fq.y)) * 0.8);
    acc = over(paint(fc, fill(fd)), acc);
  }
  // The loose end runs off the top of the winding toward the bar.
  float endD = sdSeg(q, vec2(W * 0.6, -wind), vec2(u_size.x * 0.5, -wind - 1.0)) - 0.8;
  acc = over(acc, paint(vec3(0.7, 0.45, 0.95), fill(endD) * step(0.001, frac)));
  return acc;
}

vec4 dish(vec2 q) {
  // A pewter kidney dish (a.w 0) or a round lead-lined dish (a.w 1), seen from above, lit from the lamp.
  float R = u_a.x;
  bool lead = u_a.w > 0.5;
  float d;
  if (lead) d = length(q) - R;
  else {
    // Kidney: two lobes joined, with the inner curve bitten out.
    vec2 k = q / vec2(R, R * 0.62);
    float lobes = min(length(k - vec2(-0.45, 0.0)) - 0.55, length(k - vec2(0.45, 0.0)) - 0.55);
    float body = sdBox(k, vec2(0.5, 0.52)) - 0.02;
    float bite = length(k - vec2(0.0, 1.05)) - 0.62;
    d = max(min(lobes, body), -bite) * R * 0.62;
  }
  float rim = 7.0;
  // Rim: a rolled lip, bright on the lamp side; the well darker and satin.
  float inRim = smoothstep(-rim, -rim + 2.0, d);
  vec2 g2 = normalize(vec2(dFdx(d), dFdy(d)) + 1e-5);
  vec3 n = normalize(vec3(g2 * (inRim > 0.5 ? (d + rim * 0.5) / (rim * 0.5) : 0.0) * 0.9, 1.0));
  vec3 metal = lead ? vec3(0.44, 0.45, 0.48) : vec3(0.78, 0.77, 0.74);
  metal *= 0.85 + 0.15 * noise(q * 0.3 + u_seed);
  vec3 well = lit(metal * 0.62, vec3(-g2 * 0.15 * rsmooth(0.0, -R * 0.4, d), 1.0), 0.35, 12.0);
  vec3 lipC = lit(metal, n, 1.1, 40.0);
  vec3 c = mix(well, lipC, inRim);
  // Old scratches and a bloom of oxide on the lead.
  c *= 1.0 - 0.12 * rsmooth(0.6, 0.0, abs(sin(q.x * 0.7 + q.y * 1.3 + u_seed * 3.0))) * step(0.72, noise(q * 0.2));
  vec4 acc = paint(c, fill(d));
  float sh = rsmooth(10.0, -2.0, d - 3.0) * 0.45 * (1.0 - fill(d));
  return over(acc, vec4(0.0, 0.0, 0.0, sh));
}

// ---------------------------------------------------------------- Malison design language

float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }

/** The eight Hours' silhouettes (ART-0226), in a ±100 px cell, y down. Returns a signed distance. */
float hourShape(vec2 q, float h, out vec2 eye) {
  float d = 1e9;
  eye = vec2(0.0, -10.0);
  if (h < 0.5) {
    // Matins: a hooded shroud with one great eye.
    d = sdEll(q - vec2(0.0, -28.0), vec2(38.0, 36.0));
    float bell = max(abs(q.x) - (38.0 + (q.y + 30.0) * 0.3), max(-q.y - 30.0, q.y - 62.0 - 5.0 * sin(q.x * 0.3)));
    d = min(d, bell);
    eye = vec2(0.0, -18.0);
  } else if (h < 1.5) {
    // Lauds: two antiphonal bodies joined by a light-thread.
    d = min(sdEll(q - vec2(-46.0, 5.0), vec2(30.0, 40.0)), sdEll(q - vec2(46.0, 5.0), vec2(30.0, 40.0)));
    d = max(d, -sdEll(q - vec2(-46.0, 0.0), vec2(9.0, 13.0)));
    d = max(d, -sdEll(q - vec2(46.0, 0.0), vec2(9.0, 13.0)));
    d = min(d, sdSeg(q, vec2(-20.0, -5.0), vec2(20.0, -5.0)) - 2.0);
    eye = vec2(-46.0, -22.0);
  } else if (h < 2.5) {
    // Prime: a hunched scribe with a fan of quill fingers.
    d = min(sdEll(q - vec2(-8.0, 22.0), vec2(38.0, 48.0)), sdEll(q - vec2(-18.0, -40.0), vec2(18.0, 20.0)));
    for (int i = 0; i < 5; i++) {
      float a = -1.25 + float(i) * 0.22;
      vec2 tip = vec2(24.0, -8.0) + vec2(cos(a), sin(a)) * (58.0 + 6.0 * float(i % 2));
      d = min(d, sdSeg(q, vec2(24.0, -8.0), tip) - 2.6 + 2.0 * clamp(dot(q - vec2(24.0, -8.0), normalize(tip - vec2(24.0, -8.0))) / 60.0, 0.0, 1.0));
    }
    eye = vec2(-14.0, -44.0);
  } else if (h < 3.5) {
    // Terce: a crown of flame tongues.
    d = sdBox(q - vec2(0.0, 42.0), vec2(48.0, 12.0));
    for (int i = 0; i < 5; i++) {
      float x = -40.0 + float(i) * 20.0;
      float top = -52.0 + 26.0 * abs(float(i) - 2.0) + 6.0 * sin(float(i) * 2.7);
      d = min(d, sdTri(q, vec2(x - 11.0, 32.0), vec2(x + 11.0, 32.0), vec2(x + 5.0 * sin(float(i) * 1.9), top)));
    }
    eye = vec2(0.0, 40.0);
  } else if (h < 4.5) {
    // Sext: a slumped stone torpor under a false-calm halo and a gnomon.
    d = sdEll(q - vec2(0.0, 36.0), vec2(72.0, 34.0));
    d = min(d, abs(length(q - vec2(0.0, -30.0)) - 42.0) - 3.0);
    d = min(d, sdTri(q, vec2(-6.0, 6.0), vec2(6.0, 6.0), vec2(0.0, -60.0)));
    eye = vec2(-20.0, 26.0);
  } else if (h < 5.5) {
    // None: an hourglass-segmented burrower.
    for (int i = 0; i < 6; i++) {
      float t = float(i) / 5.0;
      vec2 c = vec2(-70.0 + t * 140.0, 18.0 * sin(t * 5.0));
      float seg = min(sdEll(q - c - vec2(-6.0, 0.0), vec2(10.0, 18.0 - 4.0 * t)), sdEll(q - c - vec2(6.0, 0.0), vec2(10.0, 18.0 - 4.0 * t)));
      d = min(d, seg);
    }
    eye = vec2(-72.0, 0.0);
  } else if (h < 6.5) {
    // Vespers: a tall lamp-lighter trailing wick filaments.
    d = min(sdBox(q - vec2(-10.0, 22.0), vec2(14.0, 58.0)), sdEll(q - vec2(-10.0, -46.0), vec2(14.0, 16.0)));
    d = min(d, sdSeg(q, vec2(0.0, -10.0), vec2(56.0, -70.0)) - 2.5);
    d = min(d, sdEll(q - vec2(58.0, -62.0), vec2(9.0, 12.0)));
    for (int i = 0; i < 4; i++) d = min(d, sdSeg(q, vec2(-16.0 + float(i) * 4.0, -60.0), vec2(-40.0 + float(i) * 14.0, -92.0 + 4.0 * sin(float(i)))) - 1.2);
    eye = vec2(-10.0, -48.0);
  } else {
    // Compline: a veiled sleeper laid out long, the Great Silence.
    d = sdEll(q - vec2(0.0, 30.0), vec2(84.0, 24.0));
    d = min(d, sdEll(q - vec2(-70.0, 14.0), vec2(20.0, 20.0)));
    d = min(d, sdTri(q, vec2(-60.0, 10.0), vec2(80.0, 24.0), vec2(-10.0, -14.0)));
    eye = vec2(-72.0, 10.0);
  }
  return d;
}

vec4 hourSilhouette(vec2 q) {
  float h = floor(u_a.x + 0.5);
  vec2 eye;
  float d = hourShape(q, h, eye);
  // Common anatomy: a woven-thread body (fine cross-weave), trailing threads, one eye, curse-violet rim.
  float weave = 0.5 + 0.25 * sin((q.x + q.y) * 0.9) * sin((q.x - q.y) * 0.9);
  vec3 ink = vec3(0.06, 0.03, 0.08) * (0.8 + 0.4 * weave);
  vec3 violet = vec3(0.62, 0.3, 0.95);
  float rim = rsmooth(4.0, 0.0, -d) * step(d, 0.0);
  vec3 c = mix(ink, mix(violet, u_col, 0.55), rim * 0.9);
  // A liturgical fragment: a scrap of rubricated text crossing the body.
  float scrap = step(abs(q.y - 8.0 - 6.0 * sin(q.x * 0.05)), 1.2) * step(0.45, fract(q.x * 0.14)) * step(d, -5.0);
  c = mix(c, vec3(0.7, 0.15, 0.1), scrap * 0.8);
  vec4 acc = paint(c, fill(d));
  float threads = 0.0;
  for (int i = 0; i < 3; i++) {
    float x0 = -14.0 + float(i) * 14.0 + 4.0 * sin(u_time + float(i));
    threads = max(threads, rsmooth(1.2, 0.0, abs(q.x - x0 - 5.0 * sin(q.y * 0.08 + float(i)))) * step(62.0, q.y) * step(q.y, 92.0));
  }
  acc = over(acc, paint(violet * 0.8, threads * 0.9));
  float e = length(q - eye);
  acc = over(paint(u_col * 1.2 + 0.2, rsmooth(4.5, 3.0, e)), acc);
  acc = over(paint(vec3(0.02), rsmooth(1.8, 1.0, e)), acc);
  return acc;
}

vec4 pool(vec2 q) {
  float R = u_a.x;
  float r = length(q) + (fbm(q * 0.08 + u_seed) - 0.5) * R * 0.3;
  vec3 c = u_a.y < 0.5 ? vec3(0.42, 0.02, 0.03) : u_a.y < 1.5 ? vec3(0.8, 0.72, 0.32) : vec3(0.06, 0.05, 0.04);
  vec3 n = normalize(vec3(-q / R * 0.15 * rsmooth(R, R * 0.7, r), 1.0));
  return paint(lit(c, n, 1.2, 70.0), fill(r - R));
}

void main() {
  // Local pixel space, turned so +x follows the entity's direction.
  vec2 px = (v_uv - 0.5) * u_size;
  float c = cos(u_rot), s = sin(u_rot);
  vec2 q = vec2(px.x * c + px.y * s, -px.x * s + px.y * c);
  vec3 Ls = normalize(vec3(-0.55, -0.7, 0.62));
  LL = normalize(vec3(Ls.x * c + Ls.y * s, -Ls.x * s + Ls.y * c, Ls.z));
  vec4 r;
  if (u_mode == 0) r = missile(q);
  else if (u_mode == 1) r = leadShot(q);
  else if (u_mode == 2) r = powder(q);
  else if (u_mode == 3) r = fang(q);
  else if (u_mode == 4) r = glass(q);
  else if (u_mode == 5) r = hexstone(q);
  else if (u_mode == 6) r = fireBurn(q);
  else if (u_mode == 7) r = acidBurn(q);
  else if (u_mode == 8) r = hexfireEdge(q);
  else if (u_mode == 9) r = bubo(q);
  else if (u_mode == 10) r = rot(q);
  else if (u_mode == 11) r = pox(q);
  else if (u_mode == 12) r = venomWeb(q);
  else if (u_mode == 13) r = grub(q);
  else if (u_mode == 14) r = eggSac(q);
  else if (u_mode == 15) r = woundStrip(q);
  else if (u_mode == 16) r = gutStitch(q);
  else if (u_mode == 17) r = scar(q);
  else if (u_mode == 18) r = salvePaste(q);
  else if (u_mode == 19) r = spurt(q);
  else if (u_mode == 20) r = silk(q);
  else if (u_mode == 21) r = pool(q);
  else if (u_mode == 22) r = threadKnot(q);
  else if (u_mode == 23) r = spool(q);
  else if (u_mode == 24) r = dish(q);
  else r = hourSilhouette(q);
  // Nothing may touch the quad's border, so no rectangle edge ever shows.
  vec2 e = abs(v_uv - 0.5);
  r *= rsmooth(0.5, 0.47, max(e.x, e.y));
  o = r * u_alpha;
}`;
