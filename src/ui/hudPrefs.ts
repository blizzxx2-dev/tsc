/**
 * Player HUD preferences turned into behaviour (UIX-0049, UIX-0053, UIX-0056, UIX-0071). Pure
 * helpers so the rules are unit-testable; the operation scene owns one instance of each.
 */
import type { Vec } from '../core/math';
import type { ToolId } from '../surgery/types';

// ------------------------------------------------------------------ damage numbers

/** A vitals-loss popup ("-12"). */
export const isDamageText = (text: string): boolean => /^-\d+$/.test(text);

interface Pending {
  pos: Vec;
  sum: number;
  age: number;
  color: string;
}

/**
 * Sums vitals-loss popups per source (a 48 px cell of the field) and releases at most one number
 * per source every `window` seconds, so a lashing curse reads "-12" rather than a column of "-2"s.
 * With damage numbers off, nothing is released.
 */
export class DamageAggregator {
  private pending = new Map<string, Pending>();

  constructor(
    public enabled = true,
    readonly window = 0.5,
  ) {}

  private key(p: Vec): string {
    return `${Math.round(p.x / 48)},${Math.round(p.y / 48)}`;
  }

  /** Take a damage popup; returns true when it was absorbed (the caller must not show it). */
  absorb(text: string, pos: Vec, color: string): boolean {
    if (!isDamageText(text)) return false;
    if (!this.enabled) return true;
    const k = this.key(pos);
    const cur = this.pending.get(k);
    const n = Number(text.slice(1));
    if (cur) cur.sum += n;
    else this.pending.set(k, { pos: { ...pos }, sum: n, age: 0, color });
    return true;
  }

  /** Advance time; returns the aggregated popups that are due. */
  tick(dt: number): { text: string; pos: Vec; color: string }[] {
    const out: { text: string; pos: Vec; color: string }[] = [];
    for (const [k, p] of this.pending) {
      p.age += dt;
      if (p.age >= this.window) {
        if (p.sum > 0) out.push({ text: `-${p.sum}`, pos: p.pos, color: p.color });
        this.pending.delete(k);
      }
    }
    return out;
  }
}

// ------------------------------------------------------------------ tool hints

export type ToolHintMode = 'always' | 'first' | 'off';

/** How many selections of each instrument show its tooltip in "First uses" mode. */
export const FIRST_USES = 3;
/** Idle seconds after which "First uses" shows the tooltip again during a tutorial. */
export const IDLE_REMIND = 5;

/**
 * Decides when the instrument tooltip beside the tray appears. "Always": on every switch.
 * "First uses": the first three selections of each instrument per session, and again after 5 s of
 * idling during a guided tutorial. "Off": never.
 */
export class ToolHints {
  private seen = new Map<ToolId, number>();

  constructor(public mode: ToolHintMode = 'first') {}

  /** The player switched to `tool`: should the tooltip show? */
  selected(tool: ToolId): boolean {
    if (this.mode === 'off') return false;
    const n = (this.seen.get(tool) ?? 0) + 1;
    this.seen.set(tool, n);
    return this.mode === 'always' || n <= FIRST_USES;
  }

  /** Idle reminder during a tutorial step. */
  remind(idleSeconds: number, tutorial: boolean): boolean {
    return this.mode === 'first' && tutorial && idleSeconds >= IDLE_REMIND;
  }
}

// ------------------------------------------------------------------ cursor

export type CursorColour = 'brass' | 'white' | 'cyan' | 'magenta';

export const CURSOR_COLOURS: Record<CursorColour, string> = {
  brass: '#f5d76e',
  white: '#f4f4f0',
  cyan: '#5ff0ff',
  magenta: '#ff5ce0',
};

/** The neutral reticle tint the scene uses when nothing special is under the cursor. */
export const NEUTRAL_TINT = '#f5d76e';

/** Replace the neutral tint with the player's cursor colour; state tints (valid, invalid, off-body) are kept. */
export const cursorColour = (tint: string, pref: CursorColour): string => (tint === NEUTRAL_TINT ? CURSOR_COLOURS[pref] : tint);
