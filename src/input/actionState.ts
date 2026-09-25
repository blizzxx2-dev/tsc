import { ACTIONS, actionDef, type ActionId } from './actions';
import type { InputCode, InputEvent, Sticks } from './types';

/** A change in an action's state at a moment in time. Pulses (wheel, pad-on-release) produce a press and a release at once. */
export interface Edge {
  action: ActionId;
  kind: 'press' | 'release';
  t: number;
}

export const REPEAT_DELAY = 180;
export const REPEAT_RATE = 80;
/** Left-stick deflection that counts as a menu direction. */
export const STICK_MENU_THRESHOLD = 0.5;

const STICK_DIR: Record<string, ActionId> = { 'lstick:up': 'ui.up', 'lstick:down': 'ui.down', 'lstick:left': 'ui.left', 'lstick:right': 'ui.right' };

/**
 * Turns an ordered stream of physical events into action edges. Held state,
 * chords (all parts held), chord hold-times, pad-on-release pulses, wheel pulses
 * and menu auto-repeat all live here, so every scene sees the same semantics.
 */
export class ActionState {
  private held = new Map<InputCode, number>();
  private active = new Set<ActionId>();
  private pressedF = new Set<ActionId>();
  private releasedF = new Set<ActionId>();
  private repeatedF = new Set<ActionId>();
  private codesPressedF: InputCode[] = [];
  /** Pad buttons that took part in a satisfied chord since they went down. */
  private chordUsed = new Set<InputCode>();
  private chordSince = new Map<ActionId, number>();
  private repeatAt = new Map<ActionId, number>();

  constructor(private resolve: (id: ActionId) => InputCode[]) {}

  beginFrame(): void {
    this.pressedF.clear();
    this.releasedF.clear();
    this.repeatedF.clear();
    this.codesPressedF = [];
  }

  /** Process one event in order; returns the action edges it caused. */
  feed(ev: InputEvent): Edge[] {
    const edges: Edge[] = [];
    if (ev.type === 'down') {
      if (this.held.has(ev.code)) return edges;
      this.held.set(ev.code, ev.t);
      this.codesPressedF.push(ev.code);
      this.recompute(ev.t, edges);
    } else if (ev.type === 'up') {
      if (!this.held.has(ev.code)) return edges;
      this.held.delete(ev.code);
      // Pad-on-release actions pulse now, unless this button was part of a chord.
      if (!this.chordUsed.has(ev.code) && !ev.cancel) {
        for (const a of ACTIONS) if (a.padOnRelease && this.resolve(a.id).includes(ev.code) && ev.code.startsWith('pad:')) this.pulse(a.id, ev.t, edges);
      }
      this.chordUsed.delete(ev.code);
      this.recompute(ev.t, edges);
    } else if (ev.type === 'wheel') {
      this.codesPressedF.push(ev.code);
      for (const a of ACTIONS) if (this.resolve(a.id).includes(ev.code)) this.pulse(a.id, ev.t, edges);
    }
    return edges;
  }

  /** Close the frame: chord hold-times, stick-driven menu directions and auto-repeat. */
  endFrame(t: number, sticks: Sticks): Edge[] {
    const edges: Edge[] = [];
    const dirs: [string, boolean][] = [
      ['lstick:up', sticks.ly < -STICK_MENU_THRESHOLD],
      ['lstick:down', sticks.ly > STICK_MENU_THRESHOLD],
      ['lstick:left', sticks.lx < -STICK_MENU_THRESHOLD],
      ['lstick:right', sticks.lx > STICK_MENU_THRESHOLD],
    ];
    for (const [code, on] of dirs) {
      if (on && !this.held.has(code)) this.held.set(code, t);
      else if (!on) this.held.delete(code);
    }
    this.recompute(t, edges);
    for (const id of this.active) {
      if (!actionDef(id).repeat) continue;
      const at = this.repeatAt.get(id);
      if (at !== undefined && t >= at) {
        this.repeatedF.add(id);
        this.repeatAt.set(id, at + REPEAT_RATE * Math.max(1, Math.ceil((t - at + 1) / REPEAT_RATE)));
      }
    }
    return edges;
  }

  /** Release everything (focus lost): every held action gets a release edge. */
  releaseAll(t: number): Edge[] {
    const edges: Edge[] = [];
    this.held.clear();
    this.chordUsed.clear();
    this.recompute(t, edges);
    return edges;
  }

  private pulse(id: ActionId, t: number, edges: Edge[]): void {
    this.pressedF.add(id);
    this.releasedF.add(id);
    this.repeatedF.add(id);
    edges.push({ action: id, kind: 'press', t }, { action: id, kind: 'release', t });
  }

  private satisfied(code: InputCode): boolean {
    return code.split('+').every((c) => this.held.has(c));
  }

  private recompute(t: number, edges: Edge[]): void {
    for (const a of ACTIONS) {
      const codes = this.resolve(a.id);
      let on = false;
      for (const code of codes) {
        if (code.startsWith('wheel:')) continue;
        const chord = code.includes('+');
        if (a.padOnRelease && code.startsWith('pad:') && !chord) continue;
        if (!this.satisfied(code)) {
          if (chord) this.chordSince.delete(a.id);
          continue;
        }
        if (chord) {
          for (const c of code.split('+')) this.chordUsed.add(c);
          if (a.chordHold) {
            if (!this.chordSince.has(a.id)) this.chordSince.set(a.id, t);
            if (t - this.chordSince.get(a.id)! < a.chordHold * 1000) continue;
          }
        }
        on = true;
      }
      const stick = STICK_DIR_REV[a.id];
      if (stick && this.held.has(stick)) on = true;
      const was = this.active.has(a.id);
      if (on && !was) {
        this.active.add(a.id);
        this.pressedF.add(a.id);
        this.repeatedF.add(a.id);
        if (a.repeat) this.repeatAt.set(a.id, t + REPEAT_DELAY);
        edges.push({ action: a.id, kind: 'press', t });
      } else if (!on && was) {
        this.active.delete(a.id);
        this.releasedF.add(a.id);
        this.repeatAt.delete(a.id);
        edges.push({ action: a.id, kind: 'release', t });
      }
    }
  }

  down(id: ActionId): boolean {
    return this.active.has(id);
  }
  pressed(id: ActionId): boolean {
    return this.pressedF.has(id);
  }
  released(id: ActionId): boolean {
    return this.releasedF.has(id);
  }
  /** Pressed this frame, or auto-repeating while held (menu directions). */
  repeated(id: ActionId): boolean {
    return this.repeatedF.has(id);
  }
  codeDown(code: InputCode): boolean {
    return this.held.has(code);
  }
  /** Physical codes that went down this frame, in order (for the rebinding capture). */
  codesPressed(): readonly InputCode[] {
    return this.codesPressedF;
  }
}

const STICK_DIR_REV: Partial<Record<ActionId, string>> = Object.fromEntries(Object.entries(STICK_DIR).map(([k, v]) => [v, k]));
