/**
 * Two-slot portrait staging (UIX-0130): the story scene keeps at most two characters on stage,
 * one in the left slot and one in the right. The speaker is lit; the listener is darkened by
 * 35 % (ART-0089). A character entering slides in over 250 ms and fades up; one leaving slides
 * out the same way (ART-0132). Reduced Motion makes every move instant.
 *
 * Slot rule: a speaker already on stage keeps its slot; otherwise it takes a free slot (left
 * first), or replaces whichever staged character spoke least recently. Narration changes nothing
 * on stage: everyone rests at the listener value.
 */
import type { CharacterId } from '../content/characters';
import type { Face } from '../content/story';
import { LISTENER_LIT, PortraitRig, type PortraitPose, type RigOpts } from './portraitRig';

export type SlotId = 0 | 1;
/** Slide length of an entry or exit. */
export const SLIDE_S = 0.25;
/** How far a portrait travels while sliding, in virtual px (outward, away from the centre). */
export const SLIDE_PX = 90;
/** Speaker / listener lit values ease over this long. */
const LIT_S = 0.12;

export interface Staged {
  who: CharacterId;
  slot: SlotId;
  rig: PortraitRig;
  /** Entry progress 0..1. */
  enter: number;
  /** Set when the character is sliding out; removed once the exit completes. */
  leaving: boolean;
  /** Stage tick of the character's last line, for eviction. */
  lastSpoke: number;
}

export interface StageEntry {
  who: CharacterId;
  slot: SlotId;
  /** Horizontal offset from the slot's rest position (negative = toward the outer edge on the left slot). */
  dx: number;
  pose: PortraitPose;
  speaking: boolean;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export class PortraitStage {
  private slots: (Staged | null)[] = [null, null];
  private leaving: Staged[] = [];
  private speaker: CharacterId | null = null;
  private tick = 0;

  constructor(private opts: RigOpts = {}) {}

  private reduce(): boolean {
    return this.opts.reduceMotion?.() ?? false;
  }

  /** The staged character in a slot, if any (not counting one on its way out). */
  at(slot: SlotId): CharacterId | null {
    return this.slots[slot]?.who ?? null;
  }

  get current(): CharacterId | null {
    return this.speaker;
  }

  /** Is `who` on stage (entered or entering)? */
  has(who: CharacterId): boolean {
    return this.slots.some((s) => s?.who === who);
  }

  /** A narration line: nobody speaks; the stage rests. */
  rest(): void {
    this.speaker = null;
  }

  /** `who` speaks the next line with `face`; stages them if they are not on already. */
  speak(who: CharacterId, face?: Face | string): void {
    this.tick++;
    let s = this.slots.find((x) => x?.who === who) ?? null;
    if (!s) {
      const free = this.slots.indexOf(null);
      let slot: SlotId;
      if (free >= 0) slot = free as SlotId;
      else {
        // Evict whoever spoke least recently.
        slot = this.slots[0]!.lastSpoke <= this.slots[1]!.lastSpoke ? 0 : 1;
        this.dismiss(slot);
      }
      s = { who, slot, rig: new PortraitRig(face, this.opts), enter: this.reduce() ? 1 : 0, leaving: false, lastSpoke: this.tick };
      s.rig.lit = this.reduce() ? 1 : 0;
      this.slots[slot] = s;
    } else {
      s.rig.setFace(face ?? 'neutral');
      s.lastSpoke = this.tick;
    }
    this.speaker = who;
  }

  /** Slide the character in `slot` out (ART-0132). */
  dismiss(slot: SlotId): void {
    const s = this.slots[slot];
    if (!s) return;
    this.slots[slot] = null;
    if (this.speaker === s.who) this.speaker = null;
    if (this.reduce()) return;
    s.leaving = true;
    this.leaving.push(s);
  }

  /** Clear the stage at once (a cut to black, a scene end). */
  clear(): void {
    this.slots = [null, null];
    this.leaving.length = 0;
    this.speaker = null;
  }

  /** Advance every rig; `talking` while the speaker's text is still being revealed. */
  update(dt: number, talking: boolean): void {
    const instant = this.reduce();
    for (const s of this.slots) {
      if (!s) continue;
      const speaking = s.who === this.speaker;
      s.enter = instant ? 1 : Math.min(1, s.enter + dt / SLIDE_S);
      const target = (speaking ? 1 : LISTENER_LIT) * easeOutCubic(s.enter);
      s.rig.lit = instant ? target : s.rig.lit + (target - s.rig.lit) * Math.min(1, dt / LIT_S);
      s.rig.update(dt, speaking && talking);
    }
    for (const s of this.leaving) {
      s.enter = Math.max(0, s.enter - dt / SLIDE_S);
      s.rig.lit = LISTENER_LIT * easeOutCubic(s.enter);
      s.rig.update(dt, false);
    }
    this.leaving = this.leaving.filter((s) => s.enter > 0);
  }

  /** Everything to draw, back to front: those leaving first, then the listener, then the speaker. */
  entries(): StageEntry[] {
    const out: StageEntry[] = [];
    const push = (s: Staged) => {
      const k = easeOutCubic(s.enter);
      const dir = s.slot === 0 ? -1 : 1;
      out.push({ who: s.who, slot: s.slot, dx: dir * (1 - k) * SLIDE_PX, pose: s.rig.pose(), speaking: s.who === this.speaker && !s.leaving });
    };
    for (const s of this.leaving) push(s);
    const onStage = this.slots.filter((s): s is Staged => !!s);
    for (const s of onStage) if (s.who !== this.speaker) push(s);
    for (const s of onStage) if (s.who === this.speaker) push(s);
    return out;
  }
}
