import { clamp, Rng, type Vec } from '../core/math';
import type { Cue } from '../core/audio';
import type { Entity } from './entity';
import type { Pointer, Rank, Rating, ToolId } from './types';

export type OrganKind = 'flesh' | 'heart' | 'lung' | 'gut' | 'liver' | 'brain' | 'bone';

export interface PhaseDef {
  /** Lines the assistant says when the phase begins. */
  callout?: string[];
  spawn(op: Operation): Entity[];
}

export interface OperationDef {
  id: string;
  title: string;
  patient: string;
  diagnosis: string;
  organ: OrganKind;
  /** Species of patient, for flesh tint. */
  race?: 'human' | 'dwarf' | 'elf' | 'halfling' | 'orc';
  timeLimit: number;
  vitals?: number;
  /** Passive vitals loss per second, independent of wounds. */
  baseDrain?: number;
  tools: readonly ToolId[];
  phases: readonly PhaseDef[];
  ranks: { S: number; A: number; B: number };
  seed?: number;
  litany?: boolean;
}

export interface Popup {
  text: string;
  pos: Vec;
  t: number;
  color: string;
}

export type Status = 'intro' | 'running' | 'won' | 'lost';

export const RATING_POINTS: Record<Rating, number> = { cool: 100, good: 60, bad: 15, miss: 0 };
const RATING_TEXT: Record<Rating, string> = { cool: 'COOL', good: 'GOOD', bad: 'BAD', miss: 'MISS' };
const RATING_COLOR: Record<Rating, string> = { cool: '#f5d76e', good: '#9fd3a8', bad: '#d98a5f', miss: '#c0392b' };

export const MAX_VITALS = 99;
export const LITANY_DURATION = 8;
export const LITANY_SCALE = 0.15;
export const TINCTURE_TIME = 0.7;
export const TINCTURE_HEAL = 25;
export const TINCTURE_COOLDOWN = 6;

/** The operating field: an elliptical body region in virtual screen space. */
export const FIELD = { cx: 660, cy: 410, rx: 430, ry: 250 };

export function onBody(p: Vec): boolean {
  const dx = (p.x - FIELD.cx) / FIELD.rx;
  const dy = (p.y - FIELD.cy) / FIELD.ry;
  return dx * dx + dy * dy <= 1;
}

export class Operation {
  readonly rng: Rng;
  entities: Entity[] = [];
  vitals: number;
  timeLeft: number;
  elapsed = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Rating, number> = { cool: 0, good: 0, bad: 0, miss: 0 };
  tool: ToolId;
  status: Status = 'intro';
  lostReason = '';
  phase = -1;
  private phaseDelay = 1.2;
  popups: Popup[] = [];
  callouts: string[] = [];
  calloutT = 0;
  litanyTime = 0;
  litanyUsed = false;
  injectT = 0;
  injectCooldown = 0;
  private captured: Entity | null = null;
  /** Increments on every press, so entities can tell one stroke from the next. */
  pressId = 0;
  /** Sounds requested by the simulation; the scene drains and plays them. */
  cues: Cue[] = [];
  /** One-shot tutorial/story flags any entity may set. */
  flags = new Set<string>();
  /** Screen shake intensity, decays over time. */
  shake = 0;
  /** Final bonus breakdown, filled on victory. */
  bonus = { vitals: 0, time: 0 };

  constructor(readonly def: OperationDef) {
    this.rng = new Rng(def.seed ?? 1);
    this.vitals = def.vitals ?? MAX_VITALS;
    this.timeLeft = def.timeLimit;
    this.tool = def.tools[0];
  }

  get timeScale(): number {
    return this.litanyTime > 0 ? LITANY_SCALE : 1;
  }

  get phaseCount(): number {
    return this.def.phases.length;
  }

  // ------------------------------------------------------------------ scoring

  rate(r: Rating, pos: Vec, label?: string): void {
    this.counts[r]++;
    if (r === 'cool' || r === 'good') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      this.combo = 0;
    }
    this.score += Math.round(RATING_POINTS[r] * (1 + Math.min(this.combo, 20) * 0.05));
    const text = label ? `${label} ${RATING_TEXT[r]}` : RATING_TEXT[r];
    this.popup(this.combo > 1 && r !== 'bad' && r !== 'miss' ? `${text} x${this.combo}` : text, pos, RATING_COLOR[r]);
    this.cues.push(r);
  }

  popup(text: string, pos: Vec, color = '#e8dcc0'): void {
    this.popups.push({ text, pos: { ...pos }, t: 0, color });
  }

  say(...lines: string[]): void {
    if (this.callouts.length === 0) this.calloutT = 0;
    this.callouts.push(...lines);
  }

  /** Say something only once per operation. */
  sayOnce(flag: string, line: string): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    this.say(line);
  }

  hurt(amount: number, pos?: Vec): void {
    if (this.status !== 'running') return;
    this.vitals = Math.max(0, this.vitals - amount);
    this.shake = Math.min(12, this.shake + amount * 1.5);
    if (pos && amount >= 1) this.popup(`-${Math.round(amount)}`, pos, '#c0392b');
  }

  heal(amount: number): void {
    this.vitals = Math.min(MAX_VITALS, this.vitals + amount);
  }

  spawn(...es: Entity[]): void {
    this.entities.push(...es);
  }

  // ------------------------------------------------------------------ powers

  canInvokeLitany(): boolean {
    return (this.def.litany ?? true) && !this.litanyUsed && this.status === 'running';
  }

  invokeLitany(): boolean {
    if (!this.canInvokeLitany()) return false;
    this.litanyUsed = true;
    this.litanyTime = LITANY_DURATION;
    this.cues.push('litany');
    this.popup('THE LITANY OF STILLNESS', { x: FIELD.cx, y: FIELD.cy - 120 }, '#f5d76e');
    return true;
  }

  setTool(t: ToolId): void {
    if (!this.def.tools.includes(t) || this.tool === t) return;
    this.tool = t;
    this.cues.push('select');
    this.releaseCapture();
  }

  cycleTool(dir: number): void {
    const tools = this.def.tools;
    const i = tools.indexOf(this.tool);
    this.setTool(tools[(i + dir + tools.length) % tools.length]);
  }

  // ------------------------------------------------------------------ frame

  private releaseCapture(): void {
    this.captured = null;
    this.injectT = 0;
  }

  /** Player input: uses real time so the Litany does not slow the surgeon. */
  handlePointer(ptr: Pointer, dt: number): void {
    if (this.status !== 'running') return;
    const tool = this.tool;
    const live = this.visibleEntities().sort((a, b) => b.layer - a.layer);

    if (ptr.pressed) {
      this.pressId++;
      this.captured = null;
      for (const e of live) {
        if (e.onPress(this, ptr, tool)) {
          this.captured = e;
          break;
        }
      }
      if (!this.captured && onBody(ptr.pos)) this.emptyPress(ptr);
    }

    if (ptr.down) {
      if (this.captured) {
        if (this.captured.alive) this.captured.onDrag(this, ptr, tool, dt);
      } else {
        for (const e of live) e.onSweep(this, ptr, tool, dt);
        this.emptyHold(ptr, dt, live);
      }
    }

    if (tool === 'lens') {
      for (const e of this.entities) if (e.alive && e.hidden) e.onReveal(this, ptr.pos, dt);
    }

    if (ptr.released) {
      if (this.captured?.alive) this.captured.onRelease(this, ptr, tool);
      this.releaseCapture();
    }
  }

  private emptyPress(ptr: Pointer): void {
    if (this.tool === 'lancet') {
      this.rate('miss', ptr.pos);
      this.hurt(3, ptr.pos);
      this.cues.push('cut');
    }
  }

  private emptyHold(ptr: Pointer, dt: number, live: Entity[]): void {
    if (this.tool === 'tincture') {
      if (this.injectCooldown > 0 || !onBody(ptr.pos)) return;
      this.injectT += dt;
      if (this.injectT >= TINCTURE_TIME) {
        this.injectT = 0;
        this.injectCooldown = TINCTURE_COOLDOWN;
        this.heal(TINCTURE_HEAL);
        this.cues.push('inject');
        this.popup(`+${TINCTURE_HEAL}`, ptr.pos, '#9fd3a8');
      }
    } else if (this.tool === 'brand' && onBody(ptr.pos)) {
      // Searing healthy flesh hurts; entities that absorb the brand set this flag.
      if (!live.some((e) => e.alive && e.branded)) {
        this.hurt(4 * dt);
        this.sayOnce('brand-flesh', 'Careful! The brand is searing healthy flesh!');
      }
    }
  }

  visibleEntities(): Entity[] {
    return this.entities.filter((e) => e.alive && !e.hidden);
  }

  update(dt: number): void {
    // Presentation timers run in real time.
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.1);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.callouts.length) {
      this.calloutT += dt;
      if (this.calloutT > Math.max(2.4, this.callouts[0].length * 0.055)) {
        this.callouts.shift();
        this.calloutT = 0;
      }
    }
    if (this.status === 'won' || this.status === 'lost') return;

    this.injectCooldown = Math.max(0, this.injectCooldown - dt);
    if (this.litanyTime > 0) this.litanyTime = Math.max(0, this.litanyTime - dt);

    const wdt = dt * this.timeScale;
    this.elapsed += dt;

    if (this.status === 'intro') {
      this.phaseDelay -= dt;
      if (this.phaseDelay <= 0) {
        this.status = 'running';
        this.nextPhase();
      }
      return;
    }

    // The clock stands still while the Litany holds.
    if (this.litanyTime <= 0) this.timeLeft -= dt;

    let drain = this.def.baseDrain ?? 0;
    for (const e of this.entities) {
      if (!e.alive) continue;
      e.update(this, wdt);
      if (e.alive && !e.hidden) drain += e.drain(this);
    }
    this.hurt(drain * wdt);
    this.entities = this.entities.filter((e) => e.alive);

    if (this.vitals <= 0) return this.lose('The patient has died.');
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      return this.lose('Time has run out.');
    }
    if (this.vitals < 30) this.sayOnce('low-vitals', 'Vitals are failing! Use the tincture, Doctor!');

    if (!this.entities.some((e) => e.required)) {
      this.phaseDelay -= dt;
      if (this.phaseDelay <= 0) this.nextPhase();
    }
  }

  private nextPhase(): void {
    this.phase++;
    this.phaseDelay = 0.8;
    const def = this.def.phases[this.phase];
    if (!def) return this.win();
    if (def.callout) this.say(...def.callout);
    this.spawn(...def.spawn(this));
  }

  private win(): void {
    this.status = 'won';
    this.bonus = { vitals: Math.round(this.vitals) * 20, time: Math.round(this.timeLeft) * 10 };
    this.score += this.bonus.vitals + this.bonus.time;
    this.cues.push('bell');
    this.say('The operation is complete.');
  }

  lose(reason: string): void {
    this.status = 'lost';
    this.lostReason = reason;
    this.cues.push('flatline');
  }

  rank(): Rank {
    const r = this.def.ranks;
    if (this.score >= r.S && this.counts.bad + this.counts.miss === 0) return 'XS';
    if (this.score >= r.S) return 'S';
    if (this.score >= r.A) return 'A';
    if (this.score >= r.B) return 'B';
    return 'C';
  }
}

export const clampVitals = (v: number): number => clamp(v, 0, MAX_VITALS);
