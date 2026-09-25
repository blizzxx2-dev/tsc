import type { Vec } from '../../core/math';
import type { Operation, OperationDef } from '../operation';

/**
 * What a boss announces on the simulation bus (`op.events.on('boss', …)`):
 * phases, tells and the attacks they warn of, adaptive-music intensity, and the
 * boss-specific sounds the presentation layer synthesises. The sim only
 * announces; audio, music, the HUD and tests subscribe.
 */

export type Difficulty = 'novice' | 'surgeon' | 'master';

/** Operation fields the boss framework reads (difficulty, checkpoint resume, cinematic skip). */
export interface BossOpDef extends OperationDef {
  difficulty?: Difficulty;
  /** Retry from a checkpoint: the boss starts at this phase index with that phase's HP and no adds. */
  bossCheckpoint?: number;
  /** Repeat attempts skip the phase-transition beat. */
  skipCinematics?: boolean;
  /** Story flags that change a fight (e.g. `strohAlly` for the Office). */
  storyFlags?: readonly string[];
  /** Boss accessibility assists, copied from the settings when the operation starts. */
  assists?: BossAssists;
}

/** Boss accessibility assists (settings `bossReducedLag`, `bossMinBrightness`, `bossHazeOutline`, `bossLagReadout`). */
export interface BossAssists {
  /** Sext's torpor never exceeds 120 ms (BOS-0085). */
  reducedLag?: boolean;
  /** Vespers's dark quadrants keep ≥ 45 % brightness and Vespers is outlined (BOS-0112). */
  minBrightness?: boolean;
  /** Terce's heat-haze shows as an orange outline and a ghost cursor instead of distortion (BOS-0069). */
  hazeOutline?: boolean;
  /** A numeric readout of the torpor lag (BOS-0082). */
  lagReadout?: boolean;
}

export const assistsOf = (op: Operation): BossAssists => (op.def as BossOpDef).assists ?? {};

export const difficultyOf = (op: Operation): Difficulty => (op.def as BossOpDef).difficulty ?? 'surgeon';

/** Boss-specific sounds (synthesised by src/scenes/bossAudio.ts). */
export type BossSound =
  | 'toll' // low bell toll: Matins opening
  | 'sting' // choir sting: phase transition
  | 'inhale' // choir inhale: Lauds hymn tell
  | 'call' // antiphon, first half (linked body A)
  | 'response' // antiphon, second half (linked body B)
  | 'flare' // dawn flare
  | 'crackle' // Terce leap tell
  | 'syllable' // a Terce tongue whispers
  | 'drone' // Sext noon heat drone / cicada buzz
  | 'ripple' // None burrow heartbeat
  | 'bulge' // None surfacing
  | 'three' // None's three-o'clock bell
  | 'hiss' // Vespers snuff
  | 'gasp' // Compline steals the Litany
  | 'hush' // Compline silence tell
  | 'dial' // the Office's clock hand
  | 'hum' // an elite's hum
  | 'reading' // Prime's monk reads a name
  | 'withering'; // death sequence

export type BossEvent =
  | { kind: 'encounter'; boss: string }
  | { kind: 'phase'; boss: string; index: number; count: number; name: string }
  | { kind: 'tell'; boss: string; attack: string; lead: number; visual: string; audio: string; pos: Vec }
  | { kind: 'attack'; boss: string; attack: string; pos: Vec }
  | { kind: 'music'; boss: string; intensity: 0 | 1 | 2 | 3; layers?: number }
  | { kind: 'sound'; sound: BossSound; pan: number; gain: number; pitch?: number }
  | { kind: 'ambience'; id: string; pan: number; gain: number; layers?: number }
  | { kind: 'cinematic'; boss: string; seconds: number }
  | { kind: 'death'; boss: string }
  | { kind: 'lighting'; dim: number }
  | { kind: 'hud'; flag: string; on: boolean };

/** Horizontal screen position → stereo pan −1..1 (field-relative). */
export function panOf(x: number): number {
  return Math.max(-1, Math.min(1, (x - 660) / 430));
}

/** Request a boss sound; respects Compline/vocal-fold mute windows like every other cue. */
export function bossSound(op: Operation, sound: BossSound, at?: Vec, gain = 1, pitch?: number): void {
  if (op.cues.muteFrames > 0) return;
  op.events.emit('boss', { kind: 'sound', sound, pan: at ? panOf(at.x) : 0, gain, pitch });
}

// ------------------------------------------------------------------ tells

/** An attack's warning: how long before it lands, what the eye sees and the ear hears. */
export interface TellSpec {
  lead: number;
  visual: string;
  audio: string;
}

/** Minimum tell lead per difficulty (BOS-0003). Novice gets at least 1.0 s. */
export const TELL_MIN_LEAD: Record<Difficulty, number> = { novice: 1.0, surgeon: 0.8, master: 0.8 };

/**
 * Every boss attack and its tell, by boss. Attacks read their lead from here
 * (so the table is the source of truth) and tests/bosses.test.ts enforces the
 * minimum lead for every entry.
 */
export const BOSS_TELLS: Record<string, Record<string, TellSpec>> = {
  matins: {
    open: { lead: 0.8, visual: 'shroud tremor, peels to an inner red glow', audio: 'toll (0.6 s lead)' },
    rend: { lead: 0.8, visual: 'shroud edge sharpens into hooks', audio: 'cut' },
    gaze: { lead: 1.0, visual: 'iris contracts; gaze line locks on the instrument', audio: 'heartbeat' },
    beat: { lead: 0.8, visual: 'eye pulses on each beat, wide on the third', audio: 'heartbeat' },
  },
  lauds: {
    hymn: { lead: 0.8, visual: 'ring outline shimmers', audio: 'inhale' },
    flare: { lead: 1.0, visual: 'horizon glow at the field edge', audio: 'flare' },
    dim: { lead: 0.8, visual: 'light-thread dims', audio: 'call' },
  },
  prime: {
    stroke: { lead: 0.8, visual: 'nib glint; faint indentation of the stroke', audio: 'cut (scratch)' },
    name: { lead: 1.2, visual: 'whole name glows at its last stroke', audio: 'bell' },
  },
  terce: {
    leap: { lead: 1.0, visual: 'target organ glows orange', audio: 'crackle panned toward the target' },
  },
  sext: {
    stillborn: { lead: 1.0, visual: 'sun-dials rise; HUD edges bleach', audio: 'drone' },
  },
  none: {
    surface: { lead: 0.8, visual: 'skin bulge at the exposure point', audio: 'bulge' },
    heart: { lead: 2.0, visual: 'skin ripple quickens toward the heart', audio: 'ripple (quickening)' },
  },
  vespers: {
    snuff: { lead: 1.0, visual: 'lamp flame gutters and leans', audio: 'hiss' },
  },
  compline: {
    silence: { lead: 1.0, visual: 'subtitle “[silence]”, ambience ducks', audio: 'hush' },
    steal: { lead: 1.0, visual: 'HUD star glyph cracks and blackens', audio: 'gasp' },
  },
  cantor: {
    hum: { lead: 1.0, visual: 'the throat glows and swells', audio: 'hum' },
  },
  broodmother: {
    hatch: { lead: 3.0, visual: 'the sacs swell and churn', audio: 'hum' },
  },
  office: {
    dial:{ lead: 1.5, visual: 'the clock hand sweeps to the next Hour', audio: 'dial + that Hour’s signature' },
  },
};

/** The lead actually used for a tell on this operation's difficulty. */
export function leadFor(op: Operation, boss: string, attack: string): number {
  const spec = BOSS_TELLS[boss]?.[attack];
  const base = spec?.lead ?? 1;
  return Math.max(base, TELL_MIN_LEAD[difficultyOf(op)]);
}

/** Announce a tell (the attack follows `leadFor` seconds later). */
export function tell(op: Operation, boss: string, attack: string, pos: Vec): void {
  const spec = BOSS_TELLS[boss]?.[attack];
  op.events.emit('boss', { kind: 'tell', boss, attack, lead: leadFor(op, boss, attack), visual: spec?.visual ?? '', audio: spec?.audio ?? '', pos: { x: pos.x, y: pos.y } });
}

/** Announce that an attack landed. */
export function attack(op: Operation, boss: string, name: string, pos: Vec): void {
  op.events.emit('boss', { kind: 'attack', boss, attack: name, pos: { x: pos.x, y: pos.y } });
}

/**
 * A repeating attack with a tell: `step` returns 'tell' `lead` seconds before
 * each attack and 'attack' when it lands. The period never drops below the lead.
 */
export class Cadence {
  t = 0;
  private told = false;
  constructor(
    public period: number,
    public lead: number,
  ) {}
  /** Seconds until the next attack. */
  get remaining(): number {
    return Math.max(0, this.period - this.t);
  }
  /** True while the tell is showing (between tell and attack). */
  get telling(): boolean {
    return this.told;
  }
  reset(t = 0): void {
    this.t = t;
    this.told = false;
  }
  step(dt: number): 'tell' | 'attack' | null {
    this.t += dt;
    const period = Math.max(this.period, this.lead);
    if (!this.told && this.t >= period - this.lead) {
      this.told = true;
      return 'tell';
    }
    if (this.told && this.t >= period) {
      this.t = 0;
      this.told = false;
      return 'attack';
    }
    return null;
  }
}
