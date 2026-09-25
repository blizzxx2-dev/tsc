/**
 * Portrait rig (ART-0044 / UIX-0129): the animated pose of one character bust — its expression
 * (with a short morph between faces, ART-0132), blink (ART-0301) and lip flap while its line is
 * being typed out — packed into the two scalar uniforms `Gfx.portrait()` exposes (see
 * src/render/shaders/portrait.ts). The rig is pure state: no DOM, no renderer, so it is unit-tested
 * headlessly and the story stage drives one per slot.
 */
import { FACES, type Face } from '../content/story';

/** How the shader reads a pose; kept in step with `decodePose()` in PORTRAIT_FS. */
export interface PortraitPose {
  /** Face being morphed from (index into FACES). */
  prev: number;
  /** Face being morphed to. */
  next: number;
  /** 0 = fully `prev`, 1 = fully `next`. */
  blend: number;
  /** 0 open .. 1 shut. */
  blink: number;
  /** 0 closed .. 1 wide, the lip flap. */
  mouth: number;
  /** Value multiplier 0..1: 1 for the speaker, `LISTENER_LIT` for a listener, lower during fades. */
  lit: number;
}

/** The listener darken rule (ART-0089): −35 % value against the speaker. */
export const LISTENER_LIT = 0.65;
/** Expression morph length (ART-0132). */
export const FACE_FADE_S = 0.12;
/** A blink shuts and reopens over this long (ART-0301). */
export const BLINK_S = 0.12;
/** Seconds between blinks: uniform in [BLINK_GAP_MIN, BLINK_GAP_MAX] (ART-0301). */
export const BLINK_GAP_MIN = 3;
export const BLINK_GAP_MAX = 6;
/** Lip-flap cadence while text is being revealed: a new mouth target this often. */
export const FLAP_S = 0.07;

/** Index of a face; unknown names fall back to neutral (with a dev warning, once per name). */
const warned = new Set<string>();
export function faceIndex(face: string | undefined, warn?: (msg: string) => void): number {
  if (face === undefined) return 0;
  const i = FACES.indexOf(face as Face);
  if (i >= 0) return i;
  if (!warned.has(face)) {
    warned.add(face);
    (warn ?? (import.meta.env?.DEV ? (m: string) => console.warn(m) : undefined))?.(`[portrait] unknown expression "${face}": falling back to neutral`);
  }
  return 0;
}

/** Pack a pose into the `talk` / `active` uniforms of `Gfx.portrait()`. */
export function packPose(p: PortraitPose): { talk: number; active: number } {
  const q = (v: number, n: number) => Math.round(Math.min(1, Math.max(0, v)) * n);
  const mouth = Math.min(0.999, Math.max(0, p.mouth));
  const prev = Math.min(7, Math.max(0, Math.round(p.prev)));
  const next = Math.min(7, Math.max(0, Math.round(p.next)));
  return { talk: mouth + q(p.blink, 15) + prev * 16 + next * 128, active: Math.min(1, Math.max(0, p.lit)) + 2 * q(p.blend, 99) };
}

/** Inverse of `packPose` (as the shader decodes it), for tests and the look-dev page. */
export function unpackPose(talk: number, active: number): PortraitPose {
  let pk = talk;
  const next = Math.floor(pk / 128);
  pk -= next * 128;
  const prev = Math.floor(pk / 16);
  pk -= prev * 16;
  const bl = Math.floor(pk);
  const mouth = pk - bl;
  const bq = Math.floor(active / 2);
  return { prev, next, blend: bq / 99, blink: bl / 15, mouth, lit: active - bq * 2 };
}

export interface RigOpts {
  /** Cosmetic randomness source (blink gaps, flap amplitude); `Math.random` by default. */
  rng?: () => number;
  /** Reduced Motion: expression changes are instant and the head does not flap or blink. */
  reduceMotion?: () => boolean;
}

export class PortraitRig {
  private prev = 0;
  private next = 0;
  private blendT = 1;
  /** Seconds until the next blink starts; negative while a blink is in progress (−BLINK_S..0). */
  private blinkIn: number;
  private blinkPhase = -1;
  private mouth = 0;
  private mouthTarget = 0;
  private flapT = 0;
  private rng: () => number;
  private reduce: () => boolean;
  /** Value multiplier the stage sets (speaker / listener / fading). */
  lit = 1;

  constructor(face: Face | string = 'neutral', o: RigOpts = {}) {
    this.rng = o.rng ?? Math.random;
    this.reduce = o.reduceMotion ?? (() => false);
    this.prev = this.next = faceIndex(face);
    this.blinkIn = this.nextGap();
  }

  private nextGap(): number {
    return BLINK_GAP_MIN + this.rng() * (BLINK_GAP_MAX - BLINK_GAP_MIN);
  }

  get face(): Face {
    return FACES[this.next];
  }

  /** Change expression: morphs over FACE_FADE_S unless `instant` or Reduced Motion. */
  setFace(face: Face | string, instant = false): void {
    const k = faceIndex(face);
    if (k === this.next) return;
    // Start from wherever the current morph is, so a quick succession never snaps.
    this.prev = this.blendT >= 1 ? this.next : this.blendT < 0.5 ? this.prev : this.next;
    this.next = k;
    this.blendT = instant || this.reduce() ? 1 : 0;
  }

  /** Advance the rig; `talking` while the character's text is still being revealed. */
  update(dt: number, talking: boolean): void {
    const still = this.reduce();
    if (this.blendT < 1) this.blendT = Math.min(1, this.blendT + dt / FACE_FADE_S);
    // Blink: a gap of 3–6 s, then 120 ms shut-and-open.
    if (this.blinkPhase < 0) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) this.blinkPhase = 0;
    } else {
      this.blinkPhase += dt / BLINK_S;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1;
        this.blinkIn = this.nextGap();
      }
    }
    // Lip flap: a fresh random opening every FLAP_S while typing, eased toward; closed otherwise.
    if (talking && !still) {
      this.flapT -= dt;
      if (this.flapT <= 0) {
        this.flapT = FLAP_S;
        this.mouthTarget = this.mouthTarget > 0.3 ? 0.05 + this.rng() * 0.2 : 0.4 + this.rng() * 0.6;
      }
    } else this.mouthTarget = 0;
    const k = Math.min(1, dt * 30);
    this.mouth += (this.mouthTarget - this.mouth) * k;
  }

  /** Force the next blink to start now (look-dev, tests). */
  blinkNow(): void {
    this.blinkIn = 0;
  }

  get blinking(): boolean {
    return this.blinkPhase >= 0;
  }

  pose(): PortraitPose {
    // Eyes shut on a triangle: closed at the middle of the blink.
    const shut = this.blinkPhase < 0 || this.reduce() ? 0 : 1 - Math.abs(this.blinkPhase * 2 - 1);
    return { prev: this.prev, next: this.next, blend: this.blendT, blink: shut, mouth: this.mouth, lit: this.lit };
  }
}
