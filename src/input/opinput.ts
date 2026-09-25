import { t } from '../i18n';
import type { Input } from '../core/input';
import { settings } from '../core/settings';
import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { analyzeStar, STAR_FAILURE_HINT } from '../surgery/gesture';
import { onBody, type Operation } from '../surgery/operation';
import { TOOL_INFO, type Pointer, type ToolId } from '../surgery/types';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import type { Edge } from './actionState';
import { TOOL_SLOTS, type ActionId } from './actions';
import { aimSlow, brushRing, lancetSnap, magnet, StitchAssist, zonesFor, type Zone } from './assist';
import { bindings as defaultBindings, type Bindings, type LitanyInput } from './bindings';
import { RadialMenu } from './radial';
import type { InputEvent } from './types';

/** Tools whose action is "hold the button": the Toggle-hold option and the hold key apply to these. */
export const HOLD_TOOLS: readonly ToolId[] = ['leech', 'salve', 'tincture', 'brand'];
/**
 * Tools whose release carries no judgement of its own, so it can be held back for the
 * chatter window (INP-0034) without adding latency to anything that is judged on release
 * (an extraction, an incision stroke). Chatter on these would otherwise reset an
 * injection or a searing, or split one stitching stroke into two.
 */
export const DEBOUNCED_TOOLS: readonly ToolId[] = [...HOLD_TOOLS, 'thread'];
/** A pointer jump larger than this in one sample breaks the stroke instead of drawing a giant segment. */
export const TELEPORT_PX = 200;
const MAX_TRAIL = 4000;
/** Button chatter (INP-0034): a release followed by a press within this many ms, with the pointer still, is one hold. */
export const CHATTER_MS = 60;
/** …"still" means the pointer moved no more than this many px between the release and the press. */
export const CHATTER_PX = 3;
/** Holding the previous-instrument key (Q) this long opens the instrument wheel (GAM-0056). */
export const WHEEL_HOLD_MS = 300;
/** The wheel always shows every instrument slot, clockwise from the top; ones not in the kit are greyed. */
export const WHEEL_TOOLS: readonly ToolId[] = TOOL_INFO.map((i) => i.id);

/** HUD hit-test: return a tool to select it, 'consume' to swallow the press, or null to let it through. */
export type HudHit = (p: Vec) => ToolId | 'consume' | null;

/** Effective Litany input mode (the older "Litany on Space" assist counts as Both). */
export function litanyMode(b: Bindings = defaultBindings): LitanyInput {
  return b.prefs.litanyInput === 'draw' && settings.litanyKey ? 'both' : b.prefs.litanyInput;
}

/**
 * Turns the input timeline into `Operation` calls. It replays each frame's events
 * in timestamp order (so a key pressed just before a click applies first, and a
 * press+release inside one frame both register), splits the frame's dt across the
 * events by their timestamps (hold durations are measured from event time), and
 * applies every input option: tool selection, radial menu, Litany star/key,
 * toggle-hold, hold key, Target Size, assisted stitching and gamepad aim assist.
 */
export class OperationInput {
  starTrail: Vec[] = [];
  litanyCenter: [number, number] = [0.5, 0.5];
  readonly radial = new RadialMenu();
  /** The previous-instrument key is down (keyboard): held past WHEEL_HOLD_MS it opens the wheel instead. */
  private cycleHold: { t: number; before: ToolId; opened: boolean } | null = null;
  /** Shown over the pause menu after a controller disconnect. */
  disconnectNotice = false;
  /** Toggle-hold: a hold tool is running without the button held. */
  latched = false;
  /** Click-to-toggle grab (INP-0044): the Tongs hold something without the button held. */
  grabLatched = false;
  /** Tray shake (0..1) after a hotkey for an instrument the kit lacks (INP-0048); presentation only. */
  trayShake = 0;
  /** View → world mapping (the operation camera). Input, HUD and the radial live in view space; entities in world space. */
  toWorld: (p: Vec) => Vec = (p) => p;
  toView: (p: Vec) => Vec = (p) => p;

  private opDown = false;
  private sent: Vec = { x: 0, y: 0 };
  private cursor: Vec = { x: 0, y: 0 };
  private lastT = 0;
  private k = 0;
  private suppressed = false;
  private ignoreRelease = false;
  private holdKeyActive = false;
  private drawing = false;
  private strokeStart: Vec = { x: 0, y: 0 };
  private strokeOffset: Vec = { x: 0, y: 0 };
  private strokeZone: Zone | null = null;
  private stitch = new StitchAssist();
  private pad = false;
  /**
   * A primary release held back for the chatter window (INP-0034): if the button
   * comes straight back down without the pointer moving, the release never happened.
   * `owed` is hold time accrued while waiting, paid to the sim if the hold resumes.
   */
  private pending: { t: number; pos: Vec; owed: number } | null = null;
  private lastRelease: { t: number; pos: Vec } = { t: -Infinity, pos: { x: 0, y: 0 } };
  private kitWarned = false;

  constructor(private b: Bindings = defaultBindings) {}

  /** Should the operation pause this frame? Focus loss and pad disconnects force it; the pause action toggles. */
  pauseRequest(input: Input): 'toggle' | 'pause' | null {
    if (input.padDisconnected) this.disconnectNotice = true;
    else if (input.padConnected || (this.disconnectNotice && input.codesPressed().length)) this.disconnectNotice = false;
    if (input.focusLost || input.padDisconnected) return 'pause';
    if (input.actPressed('pause')) return 'toggle';
    return null;
  }

  /** The operation is paused: end any stroke (grabs return to origin), drop the star and the radial. */
  suspend(op: Operation): void {
    this.pending = null;
    if (this.opDown) this.cancelStroke(op);
    this.latched = false;
    this.holdKeyActive = false;
    this.drawing = false;
    this.starTrail = [];
    this.radial.close();
    this.cycleHold = null;
  }

  update(op: Operation, input: Input, dt: number, hud?: HudHit): void {
    this.b = input.bindings;
    const f = input.frame;
    const prefs = this.b.prefs;
    this.pad = f.device === 'pad';
    this.cursor = { ...f.start };
    if (!this.opDown) this.sent = this.toWorld(f.start);
    this.lastT = f.t0;
    const span = f.t - f.t0;
    this.k = span > 0 ? dt / span : 0;
    // With no timing information (a zero-length frame), give the whole dt to the final flush.
    const noSpan = span <= 0;

    for (const { ev, edges } of input.timeline) {
      if (ev.type === 'move') this.move(op, ev.t, { x: ev.x, y: ev.y });
      for (const e of edges) this.edge(op, input, e, ev, hud);
    }
    for (const e of input.tailEdges) this.edge(op, input, e, null, hud);
    this.flush(op, f.t);
    if (noSpan && !this.pending) this.send(op, 'hold', this.cursor, dt);
    this.trayShake = Math.max(0, this.trayShake - dt * 4);

    // Hold Q: the tap already stepped back one instrument; the hold undoes that and opens the wheel.
    if (this.cycleHold && !this.cycleHold.opened && !this.radial.isOpen && f.t - this.cycleHold.t >= WHEEL_HOLD_MS) {
      this.cycleHold.opened = true;
      if (op.tool !== this.cycleHold.before) this.setTool(op, f.t, this.cycleHold.before);
      this.openWheel(op, 'pointer');
    }
    this.radial.update(this.cursor, f.sticks, dt);
    // The world runs at 0.35× while the wheel is open (never stacking with the Litany's own slow).
    op.wheelOpen = this.radial.isOpen;
    // Aim assist and the right-stick nudge for the next frame's virtual cursor.
    input.nudge = !this.radial.isOpen;
    input.cursorSlow = this.pad && prefs.aimAssist ? (p) => aimSlow(this.toWorld(p), zonesFor(op, op.tool)) : () => 1;
  }

  // ------------------------------------------------------------------ events

  private move(op: Operation, t: number, p: Vec): void {
    if (this.drawing && this.starTrail.length < MAX_TRAIL) this.starTrail.push(p);
    // A held-back release is delivered as soon as the pointer travels or the chatter window closes.
    if (this.pending && (dist(this.pending.pos, p) > CHATTER_PX || t > this.pending.t + CHATTER_MS)) this.commitRelease(op);
    if (this.opDown && dist(this.cursor, p) > TELEPORT_PX) {
      // Focus regained, cursor warped, pen re-entered: break the stroke where it was.
      this.flush(op, t);
      this.release(op);
      this.suppressed = true;
      this.latched = false;
      this.cursor = p;
      this.sent = this.toWorld(p);
      return;
    }
    const d = Math.max(0, t - this.lastT) * this.k;
    this.lastT = Math.max(this.lastT, t);
    this.cursor = p;
    if (this.pending) this.pending.owed += d;
    else this.send(op, 'hold', p, d);
  }

  private edge(op: Operation, input: Input, e: Edge, ev: InputEvent | null, hud?: HudHit): void {
    const press = e.kind === 'press';
    const a: ActionId = e.action;
    if (a === 'primary') return press ? this.primaryPress(op, input, e.t, hud) : this.primaryRelease(op, e.t, ev?.type === 'up' && !!ev.cancel);
    if (a === 'tool.hold') {
      if (press) this.commitRelease(op);
      if (press && HOLD_TOOLS.includes(op.tool) && !this.opDown && !this.drawing) {
        this.flush(op, e.t);
        this.holdKeyActive = true;
        this.press(op, input);
      } else if (!press && this.holdKeyActive) {
        this.flush(op, e.t);
        this.holdKeyActive = false;
        if (!this.latched) this.release(op);
      }
      return;
    }
    if (a === 'litany.draw') return press ? this.beginStar(op, e.t) : this.endStar(op);
    if (!press) {
      if (a === 'tool.radial' || (a === 'tool.prev' && this.cycleHold?.opened)) this.pickFromWheel(op, e.t);
      if (a === 'tool.prev') this.cycleHold = null;
      return;
    }
    if (a === 'litany.key') {
      const mode = litanyMode(this.b);
      // The gamepad chord is always available; the keyboard key follows the Litany input option.
      if (mode !== 'draw' || this.pad || op.assists.simpleGestures) this.invokeLitany(op, this.cursor);
      return;
    }
    if (a.startsWith('tool.select.')) {
      const n = Number(a.slice('tool.select.'.length)) as (typeof TOOL_SLOTS)[number];
      const tool = TOOL_INFO[n - 1]?.id;
      if (!tool) return;
      if (!op.def.tools.includes(tool)) return this.unavailable(op);
      // Pressing the tincture's slot again cycles the tincture colour.
      if (tool === 'tincture' && op.tool === 'tincture') op.cycleTincture();
      else this.setTool(op, e.t, tool);
      return;
    }
    if (a === 'tool.prev' && ev?.type === 'down' && ev.code.startsWith('key:')) this.cycleHold = { t: e.t, before: op.tool, opened: false };
    if (a === 'tool.next' || a === 'tool.prev') return this.cycle(op, e.t, a === 'tool.next' ? 1 : -1);
    if (a === 'tool.quickSwap') {
      this.commitRelease(op);
      this.flush(op, e.t);
      this.unlatch(op);
      op.quickSwap();
      return;
    }
    if (a === 'tool.radial') this.openWheel(op, this.pad ? 'stick' : 'pointer');
  }

  private openWheel(op: Operation, via: 'pointer' | 'stick'): void {
    this.radial.open(this.cursor, WHEEL_TOOLS, via, op.def.tools);
  }

  private pickFromWheel(op: Operation, t: number): void {
    const pick = this.radial.close();
    if (!pick) return;
    if (op.def.tools.includes(pick)) this.setTool(op, t, pick);
    else this.unavailable(op);
  }

  private setTool(op: Operation, t: number, tool: ToolId): void {
    // A release held back for the chatter window belongs to the old instrument: deliver it first.
    if (tool !== op.tool) this.commitRelease(op);
    this.flush(op, t);
    if (tool !== op.tool) this.unlatch(op);
    op.setTool(tool);
  }

  private cycle(op: Operation, t: number, dir: number): void {
    const tools = op.def.tools;
    const j = tools.indexOf(op.tool) + dir;
    if (!this.b.prefs.wrapWheel && (j < 0 || j >= tools.length)) return;
    this.setTool(op, t, tools[(j + tools.length) % tools.length]);
  }

  private unlatch(op: Operation): void {
    if (!this.latched && !this.grabLatched) return;
    this.latched = false;
    this.release(op);
  }

  /** A hotkey for an instrument this operation's kit lacks (INP-0048): shake the tray, say so once, no `select` cue. */
  private unavailable(op: Operation): void {
    this.trayShake = 1;
    if (this.kitWarned) return;
    this.kitWarned = true;
    op.popup(t('popup.not_in_kit'), this.cursor, PALETTE.inkDim);
  }

  /** Is a press at `t` the bounce of the last release (same spot, within the chatter window)? */
  private isChatter(t: number, since: { t: number; pos: Vec }): boolean {
    return t - since.t <= CHATTER_MS && dist(since.pos, this.cursor) <= CHATTER_PX;
  }

  private primaryPress(op: Operation, input: Input, t: number, hud?: HudHit): void {
    // Chatter (INP-0034): the button bounced back down before its release was delivered — the hold never ended.
    if (this.pending) {
      if (this.isChatter(t, this.pending)) {
        const owed = this.pending.owed;
        this.pending = null;
        this.flush(op, t);
        if (owed > 0) this.send(op, 'hold', this.cursor, owed);
        return;
      }
      this.commitRelease(op);
    }
    this.flush(op, t);
    if (this.drawing) {
      this.suppressed = true;
      return;
    }
    const hit = hud?.(this.cursor) ?? null;
    if (hit) {
      if (hit !== 'consume') this.setTool(op, t, hit);
      this.suppressed = true;
      return;
    }
    const prefs = this.b.prefs;
    // Suggest tool on press (INP-0052): the target under the pointer picks the instrument before the press lands.
    if (prefs.autoTool && !this.opDown) {
      const want = op.suggestTool(this.toWorld(this.cursor));
      if (want && want !== op.tool) this.setTool(op, t, want);
    }
    if (prefs.holdMode === 'toggle' && HOLD_TOOLS.includes(op.tool)) {
      this.ignoreRelease = true;
      // A bounced click must not toggle the hold straight back off.
      if (this.isChatter(t, this.lastRelease)) return;
      if (this.latched) {
        this.latched = false;
        this.release(op);
      } else if (!this.opDown) {
        this.latched = true;
        this.press(op, input);
      }
      return;
    }
    if (prefs.grabMode === 'toggle' && op.tool === 'tongs') {
      this.ignoreRelease = true;
      if (this.isChatter(t, this.lastRelease)) return;
      if (this.grabLatched) return this.release(op);
      if (this.opDown) return;
      this.press(op, input);
      // Seized something: keep holding until the next click. Empty air: let go at once (no lingering MISS).
      if (op.held) this.grabLatched = true;
      else this.release(op);
      return;
    }
    if (this.opDown) this.release(op);
    this.press(op, input);
  }

  private primaryRelease(op: Operation, t: number, cancel: boolean): void {
    this.lastRelease = { t, pos: { ...this.cursor } };
    if (this.suppressed) {
      this.suppressed = false;
      return;
    }
    if (this.ignoreRelease) {
      this.ignoreRelease = false;
      return;
    }
    if (!this.opDown || this.holdKeyActive) return;
    this.flush(op, t);
    if (cancel) return this.cancelStroke(op);
    // Hold the release back for the chatter window; it is delivered (at this time and place) unless the button bounces.
    if (DEBOUNCED_TOOLS.includes(op.tool)) this.pending = { t, pos: { ...this.cursor }, owed: 0 };
    else this.release(op);
  }

  /** Deliver a held-back release where and when it happened. */
  private commitRelease(op: Operation): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    const cur = this.cursor;
    this.cursor = p.pos;
    this.release(op);
    this.cursor = cur;
  }

  // ------------------------------------------------------------------ strokes

  private press(op: Operation, input: Input): void {
    let raw = this.cursor;
    const prefs = this.b.prefs;
    if (this.pad && prefs.aimAssist && op.tool === 'lancet') {
      const snap = lancetSnap(op, this.toWorld(raw));
      if (snap) {
        raw = this.toView(snap);
        this.cursor = raw;
        input.warp(raw);
      }
    }
    const w = this.toWorld(raw);
    const m = magnet(w, zonesFor(op, op.tool), prefs.hitScale, ['press', 'trace']);
    this.strokeZone = m.zone?.kind === 'trace' ? m.zone : null;
    this.strokeOffset = this.strokeZone ? { x: 0, y: 0 } : { x: m.p.x - w.x, y: m.p.y - w.y };
    this.strokeStart = raw;
    this.stitch.reset();
    this.opDown = true;
    this.send(op, 'press', raw, 0);
  }

  private release(op: Operation): void {
    this.grabLatched = false;
    this.pending = null;
    if (!this.opDown) return;
    this.opDown = false;
    this.send(op, 'release', this.cursor, 0);
    this.strokeZone = null;
    this.strokeOffset = { x: 0, y: 0 };
  }

  /** Abandon the stroke without completing it: a held object is put back where it was seized. */
  private cancelStroke(op: Operation): void {
    if (!this.opDown) return;
    if (op.tool === 'tongs') this.send(op, 'hold', this.strokeStart, 0);
    this.cursor = this.strokeStart;
    this.release(op);
    this.latched = false;
  }

  /** Give the time since the last step to the current pointer state. */
  private flush(op: Operation, t: number): void {
    if (this.pending && t > this.pending.t + CHATTER_MS) this.commitRelease(op);
    if (t <= this.lastT) return;
    const d = (t - this.lastT) * this.k;
    this.lastT = t;
    if (this.pending) this.pending.owed += d;
    else this.send(op, 'hold', this.cursor, d);
  }

  /** Build the `Pointer` the Operation sees, with assists applied, and dispatch it. */
  private send(op: Operation, kind: 'hold' | 'press' | 'release', view: Vec, dt: number): void {
    const prefs = this.b.prefs;
    const scale = prefs.hitScale;
    const down = kind === 'release' ? false : this.opDown;
    const raw = this.toWorld(view);
    let p = { x: raw.x + this.strokeOffset.x, y: raw.y + this.strokeOffset.y };
    if (kind === 'press') p = magnet(raw, zonesFor(op, op.tool), scale, ['press', 'trace']).p;
    else if (down && this.strokeZone) p = magnet(p, [this.strokeZone], scale, ['trace'], true).p;
    else if (down && HOLD_TOOLS.includes(op.tool)) p = magnet(p, zonesFor(op, op.tool), scale, ['hold']).p;
    else if (op.tool === 'lens') p = magnet(p, zonesFor(op, op.tool), scale, ['hover']).p;
    if (this.latched && down && !onBody(raw)) {
      // Toggle-hold stops when the cursor leaves the body.
      this.latched = false;
      this.opDown = false;
      op.handlePointer({ pos: p, prev: this.sent, down: false, pressed: false, released: true }, 0);
      this.sent = p;
      return;
    }
    const ptr: Pointer = { pos: p, prev: this.sent, down, pressed: kind === 'press', released: kind === 'release' };
    op.handlePointer(ptr, dt);
    this.sent = p;
    if (!down || kind !== 'hold') return;
    if (op.tool === 'salve') for (const q of brushRing(p, scale)) op.handlePointer({ pos: q, prev: q, down: true, pressed: false, released: false }, 0);
    if (op.tool === 'thread' && this.stitchAssistOn()) {
      const c = this.stitch.step(op, p);
      if (c) {
        op.handlePointer({ pos: c.from, prev: c.from, down: true, pressed: false, released: false }, 0);
        op.handlePointer({ pos: c.to, prev: c.from, down: true, pressed: false, released: false }, 0);
        // Each assisted stitch is its own stroke, so assisted closures rate GOOD at best.
        op.handlePointer({ pos: c.to, prev: c.to, down: false, pressed: false, released: true }, 0);
        op.handlePointer({ pos: c.to, prev: c.to, down: true, pressed: true, released: false }, 0);
      }
    }
  }

  private stitchAssistOn(): boolean {
    const s = this.b.prefs.assistedStitch;
    return s === 'on' || (s === 'gamepad' && this.pad);
  }

  // ------------------------------------------------------------------ Litany

  private beginStar(op: Operation, t: number): void {
    if (litanyMode(this.b) === 'key' && !this.pad) return;
    this.commitRelease(op);
    this.flush(op, t);
    // Starting the sign while holding something puts it back (the star still records).
    if (this.opDown) {
      this.cancelStroke(op);
      this.suppressed = true;
    }
    this.drawing = true;
    this.starTrail = [{ ...this.cursor }];
  }

  private endStar(op: Operation): void {
    if (!this.drawing) return;
    this.drawing = false;
    const trail = this.starTrail;
    this.starTrail = [];
    const res = analyzeStar(trail, { profile: this.pad ? 'gamepad' : 'pointer' });
    if (op.litanyPractice) {
      if (res.ok || trail.length > 8) op.practiceStar(res.ok);
      return;
    }
    if (res.ok) {
      const cx = trail.reduce((a, p) => a + p.x, 0) / trail.length;
      const cy = trail.reduce((a, p) => a + p.y, 0) / trail.length;
      this.litanyCenter = [cx / VIEW_W, 1 - cy / VIEW_H];
      this.invokeLitany(op, this.cursor);
    } else if (trail.length > 8 && res.reason) op.popup(STAR_FAILURE_HINT[res.reason], this.cursor, PALETTE.inkDim);
  }

  private invokeLitany(op: Operation, at: Vec): void {
    if (op.litanyPractice) return op.practiceStar(true);
    if (!op.invokeLitany() && op.def.litany !== false) op.popup(op.litanyUsed ? t('popup.litany_spent') : t('popup.not_now'), at, PALETTE.inkDim);
  }

  // ------------------------------------------------------------------ drawing

  /** Overlays owned by input: the radial menu and the controller-disconnected notice. */
  draw(g: Gfx, op: Operation, paused: boolean): void {
    this.radial.draw(g, op.tool);
    if (paused && this.disconnectNotice) {
      g.rect(VIEW_W / 2 - 330, 92, 660, 44, hex('#1a0606', 0.9));
      g.text(t('hud.pad_disconnected'), VIEW_W / 2, 121, { size: 22, color: hex('#f0c060'), align: 'center' });
    }
  }
}
