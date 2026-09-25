import type { Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { Sigil, surfDisc } from '../entities';
import { FIELD, onBody, type Operation } from '../operation';
import { drawBossRing, TAU } from './common';
import { Voice } from './voices';
import { LaudsEcho, MatinsEcho, SilenceNode } from './compline';
import { burrowPath, BurrowSegment } from './none';
import { NameSigil, PRIME_NAMES } from './prime';
import { CrustPlate } from './sext';
import { FlameTongue } from './terce';
import { TallowClot } from './vespers';

export type HourId = 'matins' | 'lauds' | 'prime' | 'terce' | 'sext' | 'none' | 'vespers' | 'compline';

/** The eight canonical Hours, in the order they stand on the Office's clock-face. */
export const HOURS: readonly HourId[] = ['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline'];

/** The instrument each Hour's trial is mostly fought with. */
export const HOUR_TOOL: Record<HourId, 'brand' | 'lancet' | 'salve' | 'leech'> = {
  matins: 'brand',
  lauds: 'brand',
  prime: 'lancet',
  terce: 'salve',
  sext: 'lancet',
  none: 'brand',
  vespers: 'leech',
  compline: 'brand',
};

/**
 * Phase 2 "Unison" pairings: two Hours sung at once. Chosen so the pair never
 * leans on the same instrument (see HOUR_TOOL) — the surgeon alternates tools
 * rather than fighting two things with one.
 */
export const UNISON_PAIRS: readonly (readonly [HourId, HourId])[] = [
  ['matins', 'prime'],
  ['lauds', 'sext'],
  ['terce', 'compline'],
  ['none', 'vespers'],
];

/** The eight-stroke sigil of the whole Office (an eight-pointed star, drawn as four strokes of two lines each). */
export const OFFICE_SIGIL: Vec[][] = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI;
  const b = a + Math.PI * 0.75;
  return [
    { x: Math.cos(a), y: Math.sin(a) * 0.8 },
    { x: Math.cos(b), y: Math.sin(b) * 0.8 },
    { x: Math.cos(b + Math.PI * 0.75), y: Math.sin(b + Math.PI * 0.75) * 0.8 },
  ];
});

/** One Hour's mini-trial: the entities it spawns and whether it has been cleared. */
export interface HourTrial {
  hour: HourId;
  ents: Entity[];
  /** Keeps the trial going (a Prime name that got written starts again). */
  tick(op: Operation): void;
  readonly done: boolean;
}

/** Spawn a short trial of one Hour's mechanic at `at` (onto the body). */
export function hourTrial(op: Operation, hour: HourId, at: Vec, heart: Vec): HourTrial {
  const near = (dx: number, dy: number): Vec => {
    const p = { x: at.x + dx, y: at.y + dy };
    return onBody(p) ? p : { ...at };
  };
  const allDead = (es: Entity[]) => es.every((e) => !e.alive);
  const simple = (ents: Entity[]): HourTrial => {
    op.spawn(...ents);
    return { hour, ents, tick() {}, get done() { return allDead(ents); } };
  };
  switch (hour) {
    case 'matins':
      return simple([new MatinsEcho(at, op, 'matins', 25)]);
    case 'lauds':
      return simple([new LaudsEcho(at, op, 20, 0, true)]);
    case 'prime': {
      let erased = false;
      let ix = op.rng.int(0, PRIME_NAMES.length - 1);
      const make = () => {
        const n = new NameSigil({ x: at.x, y: at.y }, PRIME_NAMES[ix++ % PRIME_NAMES.length], op, 1.6, 4, 12);
        n.onErased = () => (erased = true);
        op.spawn(n);
        return n;
      };
      const trial: HourTrial = {
        hour,
        ents: [make()],
        tick(o) {
          if (!erased && !trial.ents[0].alive) trial.ents[0] = make();
          void o;
        },
        get done() {
          return erased;
        },
      };
      return trial;
    }
    case 'terce':
      return simple([new FlameTongue(near(-40, 0), null, 22), new FlameTongue(near(40, 10), null, 22)]);
    case 'sext':
      return simple([0, 1, 2, 3].map((i) => new CrustPlate(near(Math.cos((i / 4) * TAU) * 40, Math.sin((i / 4) * TAU) * 30), i)));
    case 'none':
      return simple([new BurrowSegment(burrowPath(op, at, 1, 16, 10, heart), 16, null, 20)]);
    case 'vespers':
      return simple([new TallowClot(near(-30, 0), 18), new TallowClot(near(30, 12), 18)]);
    case 'compline':
      return simple([new SilenceNode(near(-35, -10), null), new SilenceNode(near(35, 10), null)]);
  }
}

/**
 * The Office — the Malison's final form: the complete curse woven from all
 * eight Hours, a clock-face of hour-sigils around a central heart. Phase 1
 * "Dial": the hand sweeps to each Hour in a seeded order and that Hour's
 * trial must be cleared to extinguish its sigil. Phase 2 "Unison": two Hours
 * are sung at once. Phase 3 "The Choir's Heart": the conductor-sigil at the
 * centre must be traced out with the brand, stroke by stroke, while Sister Ilse
 * holds the patient's vitals with a tincture every ten seconds.
 */
export class OfficeMalison extends Entity {
  private voice = new Voice('office', 9, '#e0b0ff');
  stage: 1 | 2 | 3 = 1;
  order: HourId[];
  lit = new Set<HourId>(HOURS);
  trials: HourTrial[] = [];
  private step = 0;
  /** Seconds left in the dial-hand's sweep toward the next Hour (the tell). */
  handT = 1.5;
  private handFrom = 0;
  private handTo = 0;
  heartSigil: Sigil | null = null;
  private ilseT = 10;
  readonly heart: Vec = { x: FIELD.cx, y: FIELD.cy };

  constructor(
    op: Operation,
    public handSweep = 1.5,
  ) {
    super({ x: FIELD.cx, y: FIELD.cy });
    this.layer = 1;
    this.order = [...HOURS];
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = op.rng.int(0, i);
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    this.handT = handSweep;
    this.handTo = HOURS.indexOf(this.order[0]);
  }

  /** Where Hour `h` stands on the clock-face. */
  sigilPos(h: HourId): Vec {
    const a = -Math.PI / 2 + (HOURS.indexOf(h) / 8) * TAU;
    return { x: FIELD.cx + Math.cos(a) * FIELD.rx * 0.78, y: FIELD.cy + Math.sin(a) * FIELD.ry * 0.74 };
  }

  /** Where Hour `h`'s trial is fought: between its sigil and the heart. */
  trialPos(h: HourId): Vec {
    const s = this.sigilPos(h);
    return { x: FIELD.cx + (s.x - FIELD.cx) * 0.55, y: FIELD.cy + (s.y - FIELD.cy) * 0.5 };
  }

  /** Fraction of the Office unsung: 8 dial trials, then the unison pairs, then the heart. */
  get progress(): number {
    const total = HOURS.length + UNISON_PAIRS.length + 1;
    const done = this.stage === 1 ? HOURS.length - this.lit.size : this.stage === 2 ? HOURS.length + this.step : HOURS.length + UNISON_PAIRS.length;
    return done / total;
  }

  override drain(): number {
    return 0.1;
  }

  private begin(op: Operation, hours: HourId[]): void {
    this.trials = hours.map((h) => hourTrial(op, h, this.trialPos(h), this.heart));
    op.cues.push('bell');
    if (hours.length === 1) op.say(`The hand points to ${cap(hours[0])}!`);
    else op.say(`${cap(hours[0])} and ${cap(hours[1])} — sung together!`);
  }

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.pos);
    // Sister Ilse holds the patient throughout: a tincture every 12 s when he sinks
    // below 60 in the Dial and Unison, and every 10 s unconditionally at the Heart.
    this.ilseT -= dt;
    if (this.ilseT <= 0 && (this.stage === 3 || op.vitals < 60)) {
      const amt = this.stage === 3 ? 15 : 12;
      this.ilseT = this.stage === 3 ? 10 : 12;
      op.heal(amt);
      op.cues.push('inject');
      op.popup(`Ilse holds him: +${amt}`, { x: FIELD.cx + 300, y: FIELD.cy + 120 }, '#9fd3a8');
    }
    if (this.stage === 3) {
      if (this.heartSigil && !this.heartSigil.alive) this.die(op);
      return;
    }
    if (this.handT > 0) {
      this.handT -= dt;
      if (this.handT <= 0) this.begin(op, this.current());
      return;
    }
    for (const t of this.trials) t.tick(op);
    if (this.trials.length && this.trials.every((t) => t.done)) {
      for (const t of this.trials) {
        this.lit.delete(t.hour);
        op.rate('cool', this.sigilPos(t.hour), `${cap(t.hour)} extinguished`);
      }
      this.trials = [];
      this.step++;
      if (this.stage === 1 && this.step >= this.order.length) {
        this.stage = 2;
        this.step = 0;
        this.lit = new Set(HOURS);
        op.say('Every sigil is lighting again — two at a time now!');
      } else if (this.stage === 2 && this.step >= UNISON_PAIRS.length) {
        this.stage = 3;
        this.lit.clear();
        this.heartSigil = new Sigil({ ...this.heart }, OFFICE_SIGIL, 80, 6);
        op.spawn(this.heartSigil);
        op.say('The conductor’s sigil — the heart of the Choir. Burn out every stroke of it. I’ll hold him, Doctor.');
        op.shake = 10;
        return;
      }
      this.handFrom = this.handTo;
      this.handTo = HOURS.indexOf(this.current()[0]);
      this.handT = this.handSweep;
    }
  }

  private current(): HourId[] {
    return this.stage === 1 ? [this.order[this.step]] : [...UNISON_PAIRS[this.step]];
  }

  override kill(): void {
    super.kill();
    for (const t of this.trials) for (const e of t.ents) e.kill();
    this.heartSigil?.kill();
  }

  private die(op: Operation): void {
    this.kill();
    op.rate('cool', this.heart, 'The Office is unsung');
    op.shake = 18;
    op.emit('mote', this.heart, 90, undefined, undefined, 200);
    op.emit('gold', this.heart, 40);
    op.say('Silence. A true one, this time.');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.heart, 120, 0, 0.1, 0.2, 0.4);
  }

  draw(g: Gfx, op: Operation): void {
    const t = op.elapsed;
    // The clock-face of eight hour-sigils.
    for (const h of HOURS) {
      const p = this.sigilPos(h);
      const on = this.lit.has(h);
      const active = this.trials.some((tr) => tr.hour === h);
      g.glow(p.x, p.y, active ? 60 : 36, hex(active ? '#ff9050' : on ? '#b478ff' : '#303030', active ? 0.4 : on ? 0.25 : 0.1));
      g.circle(p.x, p.y, 14, hex(on ? '#3a2050' : '#1a1a1a'));
      g.arc(p.x, p.y, 14, 2, hex(on ? '#d8b0ff' : '#606060', 0.8));
      g.text(cap(h), p.x, p.y + 30, { size: 14, font: 'italic', color: hex(on ? '#e0d0f0' : '#707070', 0.8), align: 'center' });
    }
    // The dial hand sweeping to the next Hour.
    const a0 = -Math.PI / 2 + (this.handFrom / 8) * TAU;
    let a1 = -Math.PI / 2 + (this.handTo / 8) * TAU;
    if (a1 < a0) a1 += TAU;
    const f = this.handT > 0 ? 1 - this.handT / this.handSweep : 1;
    const a = a0 + (a1 - a0) * f;
    if (this.stage < 3) g.line(this.heart, { x: this.heart.x + Math.cos(a) * FIELD.rx * 0.6, y: this.heart.y + Math.sin(a) * FIELD.ry * 0.6 }, 4, hex('#e8c080', 0.7));
    g.circleGrad(this.heart.x, this.heart.y, 22, hex('#8a2040'), hex('#200810', 0.6));
    g.glow(this.heart.x, this.heart.y, 50, hex('#ff4060', 0.15 + 0.1 * Math.sin(t * 5)));
    drawBossRing(g, this.heart, 32, 1 - this.progress, [8 / 13, 12 / 13], '#e0b0ff');
  }
}

const cap = (h: string) => h[0].toUpperCase() + h.slice(1);
