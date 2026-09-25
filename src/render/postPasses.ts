/**
 * The post-process chain as an ordered pass list (ENG-0146). Every stage of the composite —
 * shake, Litany ripple, Scrying Lens, chromatic aberration, defocus, bloom, lamp, grade, LUT,
 * flicker, Litany sepia, vignette, danger, curse, outcome, damage flash, grain, gamma, dither —
 * is declared here with the uniforms it owns and a default enable flag. The fragment shader is
 * generated from this list (`postShaderSource`): each pass becomes a `P_<ID>` macro that reads its
 * slot of the `u_pass[]` flag array, so toggling a pass from the debug overlay or console needs no
 * recompile, and adding a pass means adding a row here and a guarded block in the shader body.
 *
 * The chain is a single full-screen program on purpose: every stage is a per-pixel colour
 * operation on the same sample, and a pass-per-draw split would cost a full-screen target write
 * per stage on integrated GPUs for no visual gain. Bloom's own mip chain (bright/down/up) runs
 * before the composite and is gated by the `bloom` pass flag as well.
 */

export interface PostPassDef {
  /** Stable id used by the console (`post <id> on|off`) and the overlay. */
  id: string;
  /** Human-readable label for the overlay. */
  label: string;
  /** Uniforms this pass reads (documentation for the debug listing; the shader declares them). */
  uniforms: readonly string[];
  /** Enabled by default. */
  enabled?: boolean;
}

/** In pipeline order: sampling-position passes first, then colour passes, then output shaping. */
export const POST_PASSES: readonly PostPassDef[] = [
  { id: 'shake', label: 'Screen shake', uniforms: ['u_shake'] },
  { id: 'litany', label: 'Litany ripple & sepia', uniforms: ['u_litany', 'u_litanyCenter', 'u_litanyAge'] },
  { id: 'lens', label: 'Scrying Lens', uniforms: ['u_lens'] },
  { id: 'chroma', label: 'Chromatic aberration', uniforms: ['u_chroma'] },
  { id: 'defocus', label: 'Menu depth of field', uniforms: ['u_defocus'] },
  { id: 'bloom', label: 'Bloom', uniforms: ['u_bloom', 'u_bloomAmt'] },
  { id: 'spot', label: 'Operating lamp', uniforms: ['u_spot', 'u_spotK'] },
  { id: 'grade', label: 'Chapter tint & lift', uniforms: ['u_tint', 'u_lift'] },
  { id: 'lut', label: 'LUT grade', uniforms: ['u_lutA', 'u_lutB', 'u_lutMix'] },
  { id: 'flicker', label: 'Candle flicker', uniforms: ['u_flicker'] },
  { id: 'vignette', label: 'Vignette', uniforms: ['u_prefs.y'] },
  { id: 'danger', label: 'Low-vitals desaturation & pulse', uniforms: ['u_danger', 'u_beat', 'u_flash'] },
  { id: 'curse', label: 'Malison ink', uniforms: ['u_curse'] },
  { id: 'outcome', label: 'Flatline / victory', uniforms: ['u_outcome'] },
  { id: 'damage', label: 'Damage flash', uniforms: ['u_hurt', 'u_flash'] },
  { id: 'grain', label: 'Film grain', uniforms: ['u_prefs.x'] },
  { id: 'gamma', label: 'Brightness', uniforms: ['u_prefs.z'] },
  { id: 'dither', label: 'Output dither', uniforms: [] },
];

export type PostPassId = (typeof POST_PASSES)[number]['id'];

export const POST_PASS_COUNT = POST_PASSES.length;

/** `#define P_BLOOM u_pass[5]` … one macro per pass, in list order. */
export function postPassDefines(passes: readonly PostPassDef[] = POST_PASSES): string {
  return passes.map((p, i) => `#define P_${p.id.toUpperCase()} u_pass[${i}]`).join('\n');
}

/** Runtime enable flags for the pass list, uploaded as `u_pass[]` each frame. */
export class PostPipeline {
  readonly passes: readonly PostPassDef[];
  private readonly on: boolean[];
  private readonly flagsArr: Float32Array;

  constructor(passes: readonly PostPassDef[] = POST_PASSES) {
    this.passes = passes;
    this.on = passes.map((p) => p.enabled !== false);
    this.flagsArr = new Float32Array(passes.length);
  }

  index(id: string): number {
    return this.passes.findIndex((p) => p.id === id);
  }

  enabled(id: string): boolean {
    const i = this.index(id);
    return i >= 0 && this.on[i];
  }

  /** Enable or disable a pass; returns false for an unknown id. */
  setEnabled(id: string, on: boolean): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    this.on[i] = on;
    return true;
  }

  toggle(id: string): boolean {
    return this.setEnabled(id, !this.enabled(id));
  }

  setAll(on: boolean): void {
    this.on.fill(on);
  }

  /** The `u_pass[]` upload (1 = enabled). Reused between frames; do not keep a reference. */
  flags(): Float32Array {
    for (let i = 0; i < this.on.length; i++) this.flagsArr[i] = this.on[i] ? 1 : 0;
    return this.flagsArr;
  }

  /** One line per pass for the console. */
  describe(): string {
    return this.passes.map((p, i) => `${this.on[i] ? '[x]' : '[ ]'} ${p.id.padEnd(9)} ${p.label}${p.uniforms.length ? ` (${p.uniforms.join(', ')})` : ''}`).join('\n');
  }
}
