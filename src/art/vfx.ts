/**
 * Operation VFX layer (ART-0275…0293): the procedural effects that sit on top of the particle pool —
 * decals, rings, the Litany star, gesture feedback and the low-vitals frame. It only *reads* the
 * simulation (events and entity state) and uses cosmetic `Math.random`, never `op.rng`.
 *
 * Every effect has a spec row in `VFX_SPECS` (sprite, frames, fps, blend, lifetime, max concurrent),
 * mirrored in docs/art/vfx/README.md (ART-0294); `maxConcurrent` is enforced here.
 */
import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';
import type { Particles } from '../render/particles';
import { Grub, Laceration, Sigil } from '../surgery/entities';
import { presentation } from '../render/presentation';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, LEAD_DISH, LITANY_DURATION, onBody, TRAY_DISH, type Operation } from '../surgery/operation';
import { EASE, FPS, frameOf } from './timing';

const TAU = Math.PI * 2;
const rnd = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

export type VfxBlend = 'alpha' | 'add';

export interface VfxSpec {
  id: string;
  task: string;
  /** Procedural sprite (function) that draws it. */
  sprite: string;
  frames: number;
  fps: number;
  blend: VfxBlend;
  /** Seconds (0 = lives while its condition holds). */
  lifetime: number;
  maxConcurrent: number;
}

/** The Demo effect specs (ART-0294). Keep docs/art/vfx/README.md in step (tests/unit/art/vfx.test.ts). */
export const VFX_SPECS: readonly VfxSpec[] = [
  { id: 'blood-droplet', task: 'ART-0275', sprite: 'particles.bloodDroplet ×6', frames: 1, fps: FPS.vfx, blend: 'alpha', lifetime: 0.55, maxConcurrent: 64 },
  { id: 'blood-splatter', task: 'ART-0275', sprite: 'vfx.splatter ×8', frames: 1, fps: FPS.vfx, blend: 'alpha', lifetime: 6, maxConcurrent: 24 },
  { id: 'lancet-spray', task: 'ART-0275', sprite: 'vfx.spray', frames: 6, fps: FPS.vfx, blend: 'alpha', lifetime: 0.25, maxConcurrent: 4 },
  { id: 'leech-swirl', task: 'ART-0275', sprite: 'vfx.swirl', frames: 0, fps: FPS.vfx, blend: 'alpha', lifetime: 0, maxConcurrent: 1 },
  { id: 'brand-sparks', task: 'ART-0276', sprite: 'particles.sparkSprite', frames: 8, fps: FPS.vfx, blend: 'add', lifetime: 0.35, maxConcurrent: 48 },
  { id: 'brand-smoke', task: 'ART-0276', sprite: 'vfx.smokePuff', frames: 12, fps: FPS.vfx, blend: 'alpha', lifetime: 0.5, maxConcurrent: 6 },
  { id: 'sear-glow', task: 'ART-0276', sprite: 'vfx.sear', frames: 48, fps: FPS.vfx, blend: 'add', lifetime: 2, maxConcurrent: 16 },
  { id: 'tincture-ripple', task: 'ART-0277', sprite: 'vfx.veinRipple', frames: 24, fps: FPS.vfx, blend: 'add', lifetime: 1, maxConcurrent: 3 },
  { id: 'tincture-calm', task: 'ART-0277', sprite: 'vfx.calmShimmer', frames: 36, fps: FPS.vfx, blend: 'add', lifetime: 1.5, maxConcurrent: 1 },
  { id: 'lens-ring', task: 'ART-0278', sprite: 'POST_FS lens + vfx.lensRing', frames: 0, fps: FPS.vfx, blend: 'add', lifetime: 0, maxConcurrent: 1 },
  { id: 'lens-wash', task: 'ART-0278', sprite: 'vfx.inkWash', frames: 0, fps: FPS.vfx, blend: 'alpha', lifetime: 0, maxConcurrent: 8 },
  { id: 'salve-smear', task: 'ART-0279', sprite: 'vfx.smear', frames: 1, fps: FPS.vfx, blend: 'alpha', lifetime: 1.5, maxConcurrent: 6 },
  { id: 'salve-glint', task: 'ART-0279', sprite: 'vfx.glint', frames: 8, fps: FPS.vfx, blend: 'add', lifetime: 0.35, maxConcurrent: 4 },
  { id: 'suture-glint', task: 'ART-0280', sprite: 'vfx.threadGlint', frames: 6, fps: FPS.vfx, blend: 'add', lifetime: 0.25, maxConcurrent: 4 },
  { id: 'suture-sealed', task: 'ART-0280', sprite: 'vfx.sealedFlash', frames: 12, fps: FPS.vfx, blend: 'add', lifetime: 0.5, maxConcurrent: 2 },
  { id: 'tongs-stretch', task: 'ART-0281', sprite: 'vfx.fleshPull', frames: 24, fps: FPS.vfx, blend: 'alpha', lifetime: 1, maxConcurrent: 3 },
  { id: 'tongs-clink', task: 'ART-0281', sprite: 'vfx.clink', frames: 6, fps: FPS.vfx, blend: 'add', lifetime: 0.25, maxConcurrent: 3 },
  { id: 'curse-mote', task: 'ART-0282', sprite: 'particles.curseMote ×4', frames: 1, fps: FPS.vfx, blend: 'add', lifetime: 2.2, maxConcurrent: 32 },
  { id: 'curse-spawn', task: 'ART-0282', sprite: 'vfx.curseBurst', frames: 12, fps: FPS.vfx, blend: 'add', lifetime: 0.5, maxConcurrent: 4 },
  { id: 'brand-kill-pop', task: 'ART-0282', sprite: 'vfx.killPop', frames: 8, fps: FPS.vfx, blend: 'add', lifetime: 0.35, maxConcurrent: 4 },
  { id: 'curse-crackle', task: 'ART-0283', sprite: 'vfx.crackle', frames: 18, fps: FPS.vfx, blend: 'add', lifetime: 0.75, maxConcurrent: 6 },
  { id: 'sigil-embers', task: 'ART-0284', sprite: 'particles.ember', frames: 1, fps: FPS.vfx, blend: 'add', lifetime: 1.1, maxConcurrent: 40 },
  { id: 'phase-shockwave', task: 'ART-0285', sprite: 'vfx.threadSnap', frames: 18, fps: FPS.vfx, blend: 'add', lifetime: 0.75, maxConcurrent: 1 },
  { id: 'phase-ink-bleed', task: 'ART-0285', sprite: 'vfx.inkBleed', frames: 48, fps: FPS.vfx, blend: 'alpha', lifetime: 2, maxConcurrent: 1 },
  { id: 'litany-star', task: 'ART-0286', sprite: 'vfx.litanyStar', frames: 30, fps: FPS.vfx, blend: 'add', lifetime: 1.25, maxConcurrent: 1 },
  { id: 'litany-dust', task: 'ART-0287', sprite: 'vfx.frozenDust', frames: 0, fps: FPS.vfx, blend: 'add', lifetime: LITANY_DURATION, maxConcurrent: 40 },
  { id: 'litany-marginalia', task: 'ART-0287', sprite: 'vfx.marginalia', frames: 0, fps: FPS.vfx, blend: 'alpha', lifetime: LITANY_DURATION, maxConcurrent: 8 },
  { id: 'litany-leaf', task: 'ART-0288', sprite: 'vfx.starFracture + particles.goldLeaf', frames: 12, fps: FPS.woodcut, blend: 'alpha', lifetime: 1, maxConcurrent: 40 },
  { id: 'star-trail', task: 'ART-0274', sprite: 'vfx.inkTrail', frames: 0, fps: FPS.vfx, blend: 'add', lifetime: 0.6, maxConcurrent: 1 },
  { id: 'gesture-fizzle', task: 'ART-0289', sprite: 'vfx.smudge', frames: 18, fps: FPS.vfx, blend: 'alpha', lifetime: 0.75, maxConcurrent: 1 },
  { id: 'low-vitals-glass', task: 'ART-0291', sprite: 'vfx.crackedGlass', frames: 0, fps: FPS.vfx, blend: 'alpha', lifetime: 0, maxConcurrent: 1 },
  { id: 'low-vitals-vessels', task: 'ART-0291', sprite: 'vfx.vesselCreep', frames: 0, fps: FPS.vfx, blend: 'alpha', lifetime: 0, maxConcurrent: 1 },
  { id: 'combo-ribbon', task: 'ART-0293', sprite: 'vfx.comboRibbon (gilt-edged)', frames: 12, fps: FPS.woodcut, blend: 'alpha', lifetime: 1.8, maxConcurrent: 1 },
];

export const specOf = (id: string): VfxSpec => VFX_SPECS.find((s) => s.id === id)!;

interface Fx {
  id: string;
  x: number;
  y: number;
  t: number;
  /** Direction / angle. */
  a: number;
  /** Variant. */
  v: number;
  pts?: Vec[];
  b?: Vec;
}

/** Eight splatter decal shapes (ART-0275): lobe count, satellite count, streak length. */
export const SPLATTERS: readonly { lobes: number; sats: number; streak: number; r: number }[] = [
  { lobes: 5, sats: 6, streak: 0, r: 9 },
  { lobes: 7, sats: 3, streak: 18, r: 11 },
  { lobes: 4, sats: 9, streak: 0, r: 7 },
  { lobes: 6, sats: 4, streak: 26, r: 8 },
  { lobes: 8, sats: 8, streak: 10, r: 12 },
  { lobes: 3, sats: 5, streak: 32, r: 6 },
  { lobes: 9, sats: 2, streak: 0, r: 14 },
  { lobes: 5, sats: 11, streak: 14, r: 10 },
];

/** Cracked-glass shards on the vitals gauge (fixed pattern so it reads as one pane). */
const CRACKS: readonly [number, number, number, number][] = [
  [0.5, 0.45, 0.08, 0.05],
  [0.5, 0.45, 0.93, 0.18],
  [0.5, 0.45, 0.71, 0.97],
  [0.5, 0.45, 0.22, 0.92],
  [0.5, 0.45, 0.02, 0.6],
  [0.71, 0.3, 0.84, 0.02],
  [0.3, 0.7, 0.44, 0.99],
  [0.78, 0.62, 0.99, 0.72],
];

/** Litany margin glyphs (manicule, pilcrow, section, fleuron, cross, asterism…). */
const MARGINALIA = ['☞', '¶', '§', '❦', '✠', '⁂', '℟', '℣'];

export interface VfxFrame {
  dt: number;
  /** Pointer in world space and whether the primary button is down. */
  pointer: Vec;
  down: boolean;
  pulse: number;
  reduceMotion: boolean;
  reduceFlashing: boolean;
  gore: number;
}

/** The patient's blood colour for the drawn blood effects (ENG-0096); set per operation. */
let vfxBlood = '#6a0208';
export function setVfxBlood(hexColor: string): void {
  vfxBlood = hexColor;
}

export class VfxLayer {
  private fx: Fx[] = [];
  private lastPointer: Vec = { x: 0, y: 0 };
  private vel: Vec = { x: 0, y: 0 };
  private swirl = 0;
  private sigilBurned = new WeakMap<Sigil, number>();
  private lastCombo = 0;
  private litanyWas = 0;
  private starPts: Vec[] | null = null;
  private starCenter: Vec = { x: FIELD.cx, y: FIELD.cy };
  private litanyAge = 99;
  private dust: { x: number; y: number; r: number; s: number }[] = [];
  private lowT = 0;
  private reduceMotion = false;
  private pulse = 0;
  gore = 1;

  constructor(private particles: Particles) {}

  /** Live effects of one id (for tests and the profiler). */
  count(id: string): number {
    return this.fx.filter((f) => f.id === id).length;
  }

  /** Add an effect, retiring the oldest of its kind past the spec's cap. */
  add(id: string, x: number, y: number, a = 0, v = 0, extra: Partial<Fx> = {}): Fx {
    const cap = specOf(id).maxConcurrent;
    const same = this.fx.filter((f) => f.id === id);
    if (same.length >= cap) this.fx.splice(this.fx.indexOf(same[0]), 1);
    const f: Fx = { id, x, y, t: 0, a, v, ...extra };
    this.fx.push(f);
    return f;
  }

  /** Subscribe to the operation's events. */
  listen(op: Operation): void {
    const ev = op.events;
    ev.on('cut', () => {
      const p = op.pointer;
      if (!onBody(p)) return;
      // Grubs the blade just missed flinch (ART-0299).
      for (const e of op.entities) if (e instanceof Grub && e.alive && !e.hidden && dist(e.pos, p) < 60) presentation.flinch.set(e, op.elapsed);
      const a = Math.atan2(this.vel.y, this.vel.x) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
      this.add('lancet-spray', p.x, p.y, a);
      if (this.gore > 0) this.add('blood-splatter', p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, a, Math.floor(Math.random() * SPLATTERS.length));
    });
    ev.on('burn', () => {
      const p = op.pointer;
      if (!onBody(p)) return;
      const near = this.fx.find((f) => f.id === 'sear-glow' && dist(f, p) < 10);
      if (near) near.t = Math.min(near.t, 0.2);
      else this.add('sear-glow', p.x, p.y, rnd(0, TAU), Math.floor(Math.random() * 4));
      if (Math.random() < 0.35) this.add('brand-smoke', p.x, p.y - 6);
    });
    ev.on('stitch', () => this.add('suture-glint', op.pointer.x, op.pointer.y, Math.atan2(this.vel.y, this.vel.x)));
    ev.on('extract', () => {
      const p = op.pointer;
      const dish = [TRAY_DISH, LEAD_DISH].find((d) => dist(p, d) <= d.r);
      this.add('tongs-clink', dish?.x ?? p.x, dish?.y ?? p.y);
      this.particles.spawn({ kind: 'spark', pos: dish ?? p, n: 5, speed: 140 });
    });
    ev.on('cue', (c) => {
      if (c === 'inject') {
        this.add('tincture-ripple', op.pointer.x, op.pointer.y);
        this.add('tincture-calm', FIELD.cx, FIELD.cy);
      }
    });
    ev.on('rate', ({ rating, pos }) => {
      if (rating === 'miss') return;
      if (op.tool === 'salve') this.add('salve-glint', pos.x, pos.y);
      if (op.tool === 'thread') this.add('suture-sealed', pos.x, pos.y);
    });
    ev.on('spawn', ({ entity }) => {
      if (entity instanceof Malison || entity instanceof MalisonShard) {
        this.add('curse-spawn', entity.pos.x, entity.pos.y);
        this.particles.spawn({ kind: 'mote', pos: entity.pos, n: 12, speed: 110 });
      }
      // Curse-hit (ART-0283): a laceration the Malison opens crackles violet along its length.
      if (entity instanceof Laceration && op.entities.some((e) => e.alive && e.boss)) this.add('curse-crackle', entity.a.x, entity.a.y, 0, 0, { b: { ...entity.b } });
    });
    ev.on('death', ({ entity }) => {
      if (op.tool !== 'brand') return;
      const curse = entity instanceof Malison || entity instanceof MalisonShard || entity instanceof Sigil;
      this.add('brand-kill-pop', entity.pos.x, entity.pos.y, 0, curse ? 1 : 0);
      if (curse) this.particles.spawn({ kind: 'mote', pos: entity.pos, n: 10, speed: 160 });
    });
    ev.on('phase', ({ index }) => {
      if (index === 0) return;
      this.add('phase-shockwave', FIELD.cx, FIELD.cy);
      this.add('phase-ink-bleed', 0, 0, 0, op.entities.some((e) => e.alive && e.boss) ? 1 : 0);
    });
  }

  /** The Litany was invoked from a traced star (view-space points) or a key (no points). */
  litanyStart(pts: Vec[] | null, center: Vec): void {
    this.starPts = pts && pts.length > 2 ? pts.slice() : starPath(center, 70);
    this.starCenter = center;
    this.litanyAge = 0;
    this.add('litany-star', center.x, center.y);
    this.dust = Array.from({ length: specOf('litany-dust').maxConcurrent }, () => ({ x: rnd(FIELD.cx - FIELD.rx, FIELD.cx + FIELD.rx), y: rnd(FIELD.cy - FIELD.ry, FIELD.cy + FIELD.ry), r: rnd(1, 2.6), s: rnd(0, TAU) }));
    for (let i = 0; i < specOf('litany-marginalia').maxConcurrent; i++) this.add('litany-marginalia', 0, 0, 0, i);
  }

  /** A star gesture that did not read: the ink smudges and fizzles (ART-0289). */
  gestureFailed(pts: Vec[]): void {
    if (pts.length > 1) this.add('gesture-fizzle', pts[0].x, pts[0].y, 0, 0, { pts: pts.slice() });
  }

  /** The trail left when the star is released fades over 0.6 s (ART-0274). */
  trailReleased(pts: Vec[]): void {
    if (pts.length > 1) this.add('star-trail', 0, 0, 0, 0, { pts: pts.slice() });
  }

  private trailRef: Vec[] | null = null;
  private trailAges: number[] = [];

  /**
   * The star being traced (ART-0274): a gilt ink stroke whose every stretch fades over 0.6 s from
   * when it was drawn, down to a faint residue so the whole gesture stays legible until released.
   */
  drawLiveTrail(g: Gfx, pts: Vec[], now: number): void {
    if (pts !== this.trailRef) {
      this.trailRef = pts;
      this.trailAges = [];
    }
    while (this.trailAges.length < pts.length) this.trailAges.push(now);
    if (pts.length < 2) return;
    g.setBlend('add');
    for (let i = 1; i < pts.length; i++) {
      const k = Math.max(0.15, 1 - (now - this.trailAges[i]) / specOf('star-trail').lifetime);
      g.line(pts[i - 1], pts[i], 8, hex(SWATCHES.gilt, 0.25 * k));
      g.line(pts[i - 1], pts[i], 3, hex('#fff0b0', 0.9 * k));
    }
    g.setBlend('alpha');
  }

  update(op: Operation, f: VfxFrame): void {
    const dt = f.dt;
    this.reduceMotion = f.reduceMotion;
    this.pulse = f.pulse;
    this.gore = f.gore;
    if (dt > 0) {
      const vx = (f.pointer.x - this.lastPointer.x) / dt;
      const vy = (f.pointer.y - this.lastPointer.y) / dt;
      this.vel = { x: this.vel.x * 0.7 + vx * 0.3, y: this.vel.y * 0.7 + vy * 0.3 };
    }
    this.lastPointer = { ...f.pointer };
    for (const x of this.fx) x.t += dt;
    this.fx = this.fx.filter((x) => {
      const life = specOf(x.id).lifetime;
      if (x.id === 'litany-marginalia') return op.litanyTime > 0;
      return life === 0 || x.t < life;
    });
    // Leech-Pipe suction swirl strength follows the held pipe over blood.
    const sucking = op.tool === 'leech' && f.down && onBody(f.pointer) && op.status === 'running';
    this.swirl = Math.max(0, Math.min(1, this.swirl + (sucking ? dt * 4 : -dt * 3)));
    // Salve: a waxy smear stroke behind the spatula.
    if (op.tool === 'salve' && f.down && onBody(f.pointer)) {
      const last = [...this.fx].reverse().find((x) => x.id === 'salve-smear');
      if (last && last.t < 0.15 && last.pts) {
        last.t = 0;
        const tail = last.pts[last.pts.length - 1];
        if (dist(tail, f.pointer) > 4) last.pts.push({ ...f.pointer });
        if (last.pts.length > 40) last.pts.shift();
      } else this.add('salve-smear', f.pointer.x, f.pointer.y, 0, 0, { pts: [{ ...f.pointer }] });
    }
    // Tongs pickup (ART-0281): the flesh pulls toward the seized object.
    if (op.tool === 'tongs' && op.held && !this.fx.some((x) => x.id === 'tongs-stretch' && x.t < 0.2 && dist(x, op.held!.pos) < 30)) {
      if (!this.heldBefore) this.add('tongs-stretch', op.held.pos.x, op.held.pos.y, Math.atan2(this.vel.y, this.vel.x));
    }
    this.heldBefore = !!op.held;
    // Sigil sear (ART-0284): newly burned cells throw gold embers upward.
    for (const e of op.entities) {
      if (!(e instanceof Sigil) || !e.alive) continue;
      let n = 0;
      for (const s of e.segs) for (const b of s.burned) if (b) n++;
      const was = this.sigilBurned.get(e) ?? 0;
      if (n > was)
        for (const s of e.segs)
          s.burned.forEach((b, i) => {
            if (!b || Math.random() > 0.6) return;
            const k = (i + 0.5) / s.burned.length;
            this.particles.spawn({ kind: 'ember', pos: { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k }, n: 1, dir: -Math.PI / 2, spread: 0.5, speed: 40 });
          });
      else if (n > 0 && Math.random() < dt * 6) {
        const s = e.segs[Math.floor(Math.random() * e.segs.length)];
        const i = s.burned.findIndex(Boolean);
        if (i >= 0) this.particles.spawn({ kind: 'ember', pos: { x: s.a.x + ((s.b.x - s.a.x) * i) / s.burned.length, y: s.a.y + ((s.b.y - s.a.y) * i) / s.burned.length }, n: 1, dir: -Math.PI / 2, spread: 0.4, speed: 25 });
      }
      this.sigilBurned.set(e, n);
    }
    // Combo milestones (ART-0293): a ribbon at ×5 and ×10.
    if (op.combo !== this.lastCombo) {
      if (op.combo > this.lastCombo && (op.combo === 5 || op.combo === 10)) this.add('combo-ribbon', 0, 0, 0, op.combo);
      this.lastCombo = op.combo;
    }
    // Litany end (ART-0288): the star fractures and falls as gold leaf.
    if (this.litanyWas > 0 && op.litanyTime <= 0) {
      this.add('litany-leaf', this.starCenter.x, this.starCenter.y);
      const pts = this.starPts ?? starPath(this.starCenter, 70);
      for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 20))) this.particles.spawn({ kind: 'leaf', pos: pts[i], n: 2, dir: -Math.PI / 2, spread: 1.2, speed: 60 });
    }
    this.litanyWas = op.litanyTime;
    this.litanyAge = op.litanyTime > 0 ? LITANY_DURATION - op.litanyTime : this.litanyAge + dt;
    // Low vitals creep in with hysteresis-free easing (the HUD owns the alarm latch).
    const low = op.status === 'running' && op.vitals <= 30 ? (30 - op.vitals) / 30 : op.status === 'lost' ? 1 : 0;
    this.lowT += (low - this.lowT) * Math.min(1, dt * 2);
  }

  private heldBefore = false;

  /** World-space effects: drawn after particles, before `endWorld`. */
  drawWorld(g: Gfx, op: Operation, pointer: Vec): void {
    for (const f of this.fx) if (f.id === 'blood-splatter') splatter(g, f, this.gore);
    for (const f of this.fx) if (f.id === 'salve-smear') smear(g, f);
    for (const f of this.fx) if (f.id === 'tongs-stretch') fleshPull(g, f);
    for (const f of this.fx) if (f.id === 'lancet-spray') spray(g, f);
    for (const f of this.fx) if (f.id === 'brand-smoke') smokePuff(g, f);
    if (op.tool === 'lens') {
      inkWash(g, op, pointer);
      lensRing(g, pointer, g.time);
    }
    if (this.swirl > 0) suctionSwirl(g, pointer, this.swirl, g.time);
    g.setBlend('add');
    for (const f of this.fx) {
      const k = f.t / specOf(f.id).lifetime;
      switch (f.id) {
        case 'sear-glow':
          searGlow(g, f, k);
          break;
        case 'tincture-ripple':
          veinRipple(g, f, k);
          break;
        case 'tincture-calm':
          g.arc(f.x, f.y, FIELD.rx * (0.4 + 0.6 * EASE.outCubic(k)), 3, hex(SWATCHES.mercy, 0.18 * (1 - k)));
          g.circleGrad(f.x, f.y, FIELD.ry * 1.2, hex(SWATCHES.mercy, 0.06 * Math.sin(k * Math.PI)), hex(SWATCHES.mercy, 0));
          break;
        case 'salve-glint':
        case 'tongs-clink':
          glint(g, f.x, f.y, k, f.id === 'salve-glint' ? SWATCHES.tallowHi : SWATCHES.brassHi, f.id === 'salve-glint' ? 18 : 12);
          break;
        case 'suture-glint': {
          const d = 10 * (1 - k);
          g.line({ x: f.x - Math.cos(f.a) * d, y: f.y - Math.sin(f.a) * d }, { x: f.x + Math.cos(f.a) * d, y: f.y + Math.sin(f.a) * d }, 2, hex(SWATCHES.linen, 0.9 * (1 - k)));
          g.circleGrad(f.x, f.y, 8, hex(SWATCHES.tallowHi, 0.5 * (1 - k)), hex(SWATCHES.tallowHi, 0));
          break;
        }
        case 'suture-sealed':
          g.circleGrad(f.x, f.y, 40 * EASE.outCubic(k), hex(SWATCHES.gilt, 0.55 * (1 - k)), hex(SWATCHES.gilt, 0));
          g.arc(f.x, f.y, 14 + 22 * EASE.outCubic(k), 2.5, hex(SWATCHES.gilt, 0.9 * (1 - k)));
          glint(g, f.x, f.y, k, SWATCHES.tallowHi, 22);
          break;
        case 'curse-spawn':
          g.arc(f.x, f.y, 10 + 70 * EASE.outCubic(k), 6 * (1 - k), hex(SWATCHES.curseViolet, 0.7 * (1 - k)));
          g.circleGrad(f.x, f.y, 60 * (1 - k * 0.5), hex(SWATCHES.curseViolet, 0.35 * (1 - k)), hex(SWATCHES.curseViolet, 0));
          break;
        case 'brand-kill-pop': {
          const c = f.v ? SWATCHES.curseViolet : SWATCHES.ember;
          g.circleGrad(f.x, f.y, 30 * (0.4 + k), hex(c, 0.8 * (1 - k)), hex(c, 0));
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + f.x;
            g.line({ x: f.x + Math.cos(a) * 10 * k, y: f.y + Math.sin(a) * 10 * k }, { x: f.x + Math.cos(a) * 34 * k, y: f.y + Math.sin(a) * 34 * k }, 2, hex(c, 0.9 * (1 - k)));
          }
          break;
        }
        case 'curse-crackle':
          crackle(g, f, k);
          break;
        case 'phase-shockwave':
          g.arc(f.x, f.y, 40 + FIELD.rx * 1.3 * EASE.outCubic(k), 10 * (1 - k) + 1, hex(SWATCHES.curseViolet, 0.6 * (1 - k)));
          g.arc(f.x, f.y, 30 + FIELD.rx * 1.1 * EASE.outCubic(k), 2, hex(SWATCHES.tallowHi, 0.5 * (1 - k)));
          // Snapped thread ends whipping outward.
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.3;
            const r0 = 30 + 200 * EASE.outCubic(k);
            g.quadCurve({ x: f.x + Math.cos(a) * r0, y: f.y + Math.sin(a) * r0 * 0.6 }, { x: f.x + Math.cos(a + 0.2) * (r0 + 30), y: f.y + Math.sin(a + 0.2) * (r0 + 30) * 0.6 }, { x: f.x + Math.cos(a + 0.1) * (r0 + 60), y: f.y + Math.sin(a + 0.1) * (r0 + 60) * 0.6 }, 1.5, hex(SWATCHES.linen, 0.6 * (1 - k)), 6);
          }
          break;
        default:
          break;
      }
    }
    // Litany (ART-0286/0287): the burning star, then the frozen dust.
    if (op.litanyTime > 0 || this.litanyAge < 1.25) this.drawStar(g);
    if (op.litanyTime > 0) {
      const fade = Math.min(1, op.litanyTime, (LITANY_DURATION - op.litanyTime) * 3);
      for (const d of this.dust) {
        const drift = this.reduceMotion ? 0 : Math.sin(g.time * 0.3 + d.s) * 2;
        g.circleGrad(d.x + drift, d.y + drift * 0.5, d.r * 3, hex('#fff0c0', 0.4 * fade), hex('#fff0c0', 0));
      }
    }
    for (const f of this.fx) {
      if (f.id === 'star-trail' && f.pts) {
        const a = 1 - f.t / 0.6;
        g.polyline(f.pts, 8, hex(SWATCHES.gilt, 0.25 * a));
        g.polyline(f.pts, 3, hex('#fff0b0', 0.9 * a * a));
      }
    }
    g.setBlend('alpha');
    for (const f of this.fx) if (f.id === 'gesture-fizzle') smudge(g, f);
  }

  private drawStar(g: Gfx): void {
    const pts = this.starPts;
    if (!pts) return;
    const age = this.litanyAge;
    // Burn-in along the traced path over 0.3 s, then the star expands with the post ripple
    // front (POST_FS: front = age × 0.9 of the view height) and fades with exp(−1.2·age).
    const burn = Math.min(1, age / 0.3);
    const n = Math.max(2, Math.floor(pts.length * burn));
    const grow = age > 0.3 ? 1 + ((age - 0.3) * 0.9 * 720) / 140 : 1;
    const fade = age > 0.3 ? Math.exp(-(age - 0.3) * 2.4) : 1;
    const c = this.starCenter;
    const seg = pts.slice(0, n).map((p) => ({ x: c.x + (p.x - c.x) * grow, y: c.y + (p.y - c.y) * grow }));
    g.polyline(seg, 14, hex(SWATCHES.ember, 0.25 * fade));
    g.polyline(seg, 5, hex(SWATCHES.gilt, 0.85 * fade));
    g.polyline(seg, 1.6, hex(SWATCHES.tallowHi, fade));
    const head = seg[seg.length - 1];
    if (burn < 1) g.circleGrad(head.x, head.y, 18, hex(SWATCHES.tallowHi, 0.9), hex(SWATCHES.gilt, 0));
  }

  /** Screen-space effects (after `endWorld`): ink bleed, low-vitals frame, marginalia, ribbons. */
  drawScreen(g: Gfx, op: Operation, view: { x: number; y: number; w: number; h: number }, gauge: { x: number; y: number; w: number; h: number }): void {
    for (const f of this.fx) {
      const k = f.t / specOf(f.id).lifetime;
      if (f.id === 'phase-ink-bleed') inkBleed(g, view, k, f.v === 1);
      if (f.id === 'litany-leaf') starFracture(g, this.starPts, this.starCenter, f.t);
      if (f.id === 'combo-ribbon') comboRibbon(g, view, f.v, f.t);
      if (f.id === 'litany-marginalia' && op.litanyTime > 0) marginalia(g, view, f.v, op.litanyTime / LITANY_DURATION, Math.min(1, f.t * 2));
    }
    if (this.lowT > 0.01) {
      vesselCreep(g, view, this.lowT, this.pulse);
      crackedGlass(g, gauge, this.lowT);
    }
  }
}

/** A five-pointed star path (used when the Litany is invoked by key rather than drawn). */
export function starPath(c: Vec, r: number): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + ((i * 2) % 5) * (TAU / 5);
    pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return pts;
}

// ------------------------------------------------------------------ sprites

function splatter(g: Gfx, f: Fx, gore: number): void {
  const s = SPLATTERS[f.v % SPLATTERS.length];
  const life = specOf('blood-splatter').lifetime;
  const a = Math.min(1, f.t * 12) * Math.min(1, (life - f.t) / 1.5) * Math.min(1, gore);
  const col = hex(SWATCHES.gore, 0.75 * a);
  const rim = hex('#3a0206', 0.8 * a);
  const lobes: Vec[] = [];
  for (let i = 0; i < s.lobes * 2; i++) {
    const ang = (i / (s.lobes * 2)) * TAU;
    const r = s.r * (i % 2 ? 0.85 + 0.1 * Math.sin(i * 3.3 + f.v) : 1.05 + 0.25 * Math.sin(i * 7.1 + f.v));
    lobes.push({ x: f.x + Math.cos(ang) * r, y: f.y + Math.sin(ang) * r });
  }
  g.poly(lobes, rim, col);
  for (let i = 0; i < s.sats; i++) {
    const ang = f.a + Math.sin(i * 3.7 + f.v) * 1.2;
    const d = s.r * (1.5 + ((i * 0.37 + f.v * 0.11) % 1) * 1.8);
    g.circle(f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d, 1 + ((i * 0.61) % 1) * 2, col);
  }
  if (s.streak) g.line({ x: f.x, y: f.y }, { x: f.x + Math.cos(f.a) * s.streak, y: f.y + Math.sin(f.a) * s.streak }, 2.5, col);
}

function spray(g: Gfx, f: Fx): void {
  const k = f.t / specOf('lancet-spray').lifetime;
  for (let i = 0; i < 7; i++) {
    const a = f.a + (i - 3) * 0.12;
    const r0 = 6 + 40 * EASE.outCubic(k) * (0.6 + (i % 3) * 0.2);
    g.line({ x: f.x + Math.cos(a) * r0 * 0.5, y: f.y + Math.sin(a) * r0 * 0.5 }, { x: f.x + Math.cos(a) * r0, y: f.y + Math.sin(a) * r0 }, 2.2 * (1 - k) + 0.6, hex(vfxBlood, 0.9 * (1 - k)));
  }
}

function suctionSwirl(g: Gfx, p: Vec, k: number, t: number): void {
  for (let arm = 0; arm < 3; arm++) {
    const pts: Vec[] = [];
    for (let i = 0; i < 14; i++) {
      const u = i / 13;
      const r = 36 * (1 - u) + 4;
      const a = arm * (TAU / 3) - t * 7 + u * 4;
      pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8 });
    }
    g.polyline(pts, 2.4, hex(vfxBlood, 0.55 * k));
  }
  g.circleGrad(p.x, p.y, 16, hex(SWATCHES.gore, 0.5 * k), hex(SWATCHES.gore, 0));
}

function smokePuff(g: Gfx, f: Fx): void {
  const k = f.t / specOf('brand-smoke').lifetime;
  const frame = frameOf(f.t, specOf('brand-smoke').fps, specOf('brand-smoke').frames);
  for (let i = 0; i < 3; i++) g.circleGrad(f.x + (i - 1) * 6 * (1 + k), f.y - 20 * k - i * 3, 8 + frame * 1.2, hex(SWATCHES.ash, 0.28 * (1 - k)), hex(SWATCHES.ash, 0));
}

/** Sear glow (ART-0276): orange → deep red → black char over 2 s. */
function searGlow(g: Gfx, f: Fx, k: number): void {
  const hot = Math.max(0, 1 - k * 1.6);
  const warm = Math.max(0, 1 - k);
  g.circleGrad(f.x, f.y, 12, hex('#ffa040', 0.75 * hot), hex('#ff5010', 0));
  g.circleGrad(f.x, f.y, 7, hex('#c02008', 0.6 * warm), hex('#c02008', 0));
  g.setBlend('alpha');
  g.circleGrad(f.x, f.y, 8, hex(SWATCHES.soot, 0.55 * Math.min(1, k * 1.5)), hex(SWATCHES.soot, 0));
  g.setBlend('add');
}

function veinRipple(g: Gfx, f: Fx, k: number): void {
  const col = SWATCHES.verdigris;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + f.x * 0.01;
    const pts: Vec[] = [{ x: f.x, y: f.y }];
    let x = f.x;
    let y = f.y;
    const len = 90 * EASE.outCubic(k);
    for (let j = 1; j <= 6; j++) {
      const aa = a + Math.sin(j * 1.7 + i) * 0.4;
      x += (Math.cos(aa) * len) / 6;
      y += (Math.sin(aa) * len) / 6;
      pts.push({ x, y });
    }
    g.polyline(pts, 3, hex(col, 0.5 * (1 - k)));
    g.polyline(pts, 1.2, hex(SWATCHES.mercy, 0.8 * (1 - k)));
  }
  g.arc(f.x, f.y, 8 + 50 * EASE.outCubic(k), 2, hex(SWATCHES.mercy, 0.5 * (1 - k)));
}

function inkWash(g: Gfx, op: Operation, p: Vec): void {
  for (const e of op.entities) {
    if (!e.alive || !e.hidden || dist(e.pos, p) > 110) continue;
    const a = 1 - dist(e.pos, p) / 110;
    g.circleGrad(e.pos.x, e.pos.y, 34, hex('#7a5a30', 0.45 * a), hex('#7a5a30', 0));
    for (let i = -3; i <= 3; i++) g.line({ x: e.pos.x - 20 + i * 5, y: e.pos.y + 16 }, { x: e.pos.x + 12 + i * 5, y: e.pos.y - 16 }, 1, hex(SWATCHES.inkDark, 0.35 * a));
  }
}

/**
 * The Scrying Lens rim (ART-0278): POST_FS bends the image inside the lens (radius 95 view px);
 * this draws the brass rim over that edge, with engraved ticks and a slow refraction shimmer band.
 */
function lensRing(g: Gfx, p: Vec, t: number): void {
  const R = 95;
  g.arc(p.x, p.y, R + 3, 7, hex(SWATCHES.soot, 0.55));
  g.arc(p.x, p.y, R + 3, 4, hex(SWATCHES.brass, 0.85));
  g.arc(p.x, p.y, R + 1.5, 1, hex(SWATCHES.brassHi, 0.8));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const r0 = R + (i % 6 ? 1 : -1);
    g.line({ x: p.x + Math.cos(a) * r0, y: p.y + Math.sin(a) * r0 }, { x: p.x + Math.cos(a) * (R + 5), y: p.y + Math.sin(a) * (R + 5) }, 1, hex(SWATCHES.brassLo, 0.9));
  }
  g.setBlend('add');
  g.arc(p.x, p.y, R - 6, 5, hex(SWATCHES.frost, 0.12), 0.3, t * 0.8);
  g.arc(p.x, p.y, R - 4, 2, hex(SWATCHES.frost, 0.18), 0.15, t * 0.8 + Math.PI);
  g.setBlend('alpha');
}

function smear(g: Gfx, f: Fx): void {
  if (!f.pts || f.pts.length < 2) return;
  const a = Math.min(1, 1 - f.t / specOf('salve-smear').lifetime + 0.3);
  g.polyline(f.pts, 18, hex('#e8dcb0', 0.16 * a));
  g.polyline(f.pts, 10, hex('#f4ecc8', 0.18 * a));
  // Spatula streaks along the stroke.
  for (const off of [-6, -2, 3, 7]) g.polyline(f.pts.map((q) => ({ x: q.x + off * 0.3, y: q.y + off })), 1, hex(SWATCHES.tallowHi, 0.22 * a));
}

function glint(g: Gfx, x: number, y: number, k: number, col: string, size: number): void {
  const s = size * Math.sin(Math.min(1, k) * Math.PI);
  g.line({ x: x - s, y }, { x: x + s, y }, 1.6, hex(col, 0.95));
  g.line({ x, y: y - s }, { x, y: y + s }, 1.6, hex(col, 0.95));
  g.line({ x: x - s * 0.4, y: y - s * 0.4 }, { x: x + s * 0.4, y: y + s * 0.4 }, 1, hex(col, 0.7));
  g.line({ x: x + s * 0.4, y: y - s * 0.4 }, { x: x - s * 0.4, y: y + s * 0.4 }, 1, hex(col, 0.7));
  g.circleGrad(x, y, s * 0.8, hex(col, 0.5), hex(col, 0));
}

function fleshPull(g: Gfx, f: Fx): void {
  const k = f.t / specOf('tongs-stretch').lifetime;
  const a = 1 - k;
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TAU;
    const r0 = 10;
    const r1 = 26 + 6 * Math.sin(i * 2.3);
    g.quadCurve({ x: f.x + Math.cos(ang) * r1, y: f.y + Math.sin(ang) * r1 }, { x: f.x + Math.cos(ang + 0.25) * (r0 + 8), y: f.y + Math.sin(ang + 0.25) * (r0 + 8) }, { x: f.x + Math.cos(ang) * r0, y: f.y + Math.sin(ang) * r0 }, 1.6, hex('#3a0a0c', 0.45 * a), 6);
  }
  g.circleGrad(f.x, f.y, 14, hex('#ffb0a0', 0.18 * a), hex('#ffb0a0', 0));
}

function crackle(g: Gfx, f: Fx, k: number): void {
  if (!f.b) return;
  const a = (1 - k) * (0.6 + 0.4 * Math.sin(f.t * 60));
  const n = 10;
  for (let pass = 0; pass < 2; pass++) {
    const pts: Vec[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const j = i === 0 || i === n ? 0 : rnd(-7, 7);
      const nx = -(f.b.y - f.y);
      const ny = f.b.x - f.x;
      const l = Math.hypot(nx, ny) || 1;
      pts.push({ x: f.x + (f.b.x - f.x) * u + (nx / l) * j, y: f.y + (f.b.y - f.y) * u + (ny / l) * j });
    }
    g.polyline(pts, pass ? 1.2 : 4, hex(pass ? '#e8d0ff' : SWATCHES.curseViolet, (pass ? 0.9 : 0.4) * a));
  }
}

function smudge(g: Gfx, f: Fx): void {
  if (!f.pts) return;
  const k = f.t / specOf('gesture-fizzle').lifetime;
  const a = 1 - k;
  // The stroke thickens and greys as the ink bleeds, then breaks into drying specks.
  const pts = f.pts.filter((_, i) => i % 2 === 0 || k < 0.3);
  g.polyline(pts, 3 + 9 * k, hex(SWATCHES.inkDark, 0.35 * a));
  g.polyline(pts, 2, hex(SWATCHES.ash, 0.6 * a * (1 - k)));
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    g.circle(p.x + Math.sin(i * 1.3) * 8 * k, p.y + Math.cos(i * 1.7) * 8 * k + 10 * k * k, 1.8 * a, hex(SWATCHES.inkDark, 0.6 * a));
  }
}

function inkBleed(g: Gfx, v: { x: number; y: number; w: number; h: number }, k: number, curse: boolean): void {
  const a = Math.sin(Math.min(1, k) * Math.PI) * 0.75;
  const col = curse ? SWATCHES.curseDeep : SWATCHES.inkDark;
  const d = 30 + 90 * EASE.outCubic(Math.min(1, k * 1.5));
  for (let i = 0; i < 18; i++) {
    const u = (i + 0.5) / 18;
    const bump = d * (0.6 + 0.4 * Math.sin(i * 2.7));
    g.circleGrad(v.x + u * v.w, v.y, bump, hex(col, a), hex(col, 0));
    g.circleGrad(v.x + u * v.w, v.y + v.h, bump, hex(col, a), hex(col, 0));
    g.circleGrad(v.x, v.y + u * v.h, bump, hex(col, a), hex(col, 0));
    g.circleGrad(v.x + v.w, v.y + u * v.h, bump, hex(col, a), hex(col, 0));
  }
  if (curse) g.rectLine(v.x + 3, v.y + 3, v.w - 6, v.h - 6, 6, hex(SWATCHES.curseViolet, a * 0.4));
}

function starFracture(g: Gfx, pts: Vec[] | null, c: Vec, t: number): void {
  if (!pts) return;
  // 12 woodcut frames: each segment breaks away, rotates and drops.
  const frame = frameOf(t, FPS.woodcut, 12);
  const k = frame / 11;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + 160 * k * k * (0.6 + (i % 3) * 0.2);
    const rot = (i % 2 ? 1 : -1) * k * 1.2;
    const hx = ((b.x - a.x) / 2) * Math.cos(rot) - ((b.y - a.y) / 2) * Math.sin(rot);
    const hy = ((b.x - a.x) / 2) * Math.sin(rot) + ((b.y - a.y) / 2) * Math.cos(rot);
    const drift = (mx - c.x) * 0.3 * k;
    g.line({ x: mx + drift - hx, y: my - hy }, { x: mx + drift + hx, y: my + hy }, 3.5, hex(SWATCHES.gilt, 0.9 * (1 - k)));
  }
}

function comboRibbon(g: Gfx, v: { x: number; y: number; w: number; h: number }, combo: number, t: number): void {
  const life = specOf('combo-ribbon').lifetime;
  const unfurl = EASE.outBack(Math.min(1, frameOf(t, FPS.woodcut, 12) / 11));
  const a = Math.min(1, (life - t) / 0.4);
  const w = 260 * unfurl;
  const y = v.y + 150;
  const cx = v.x + v.w / 2;
  const col = combo >= 10 ? SWATCHES.oxblood : SWATCHES.leather;
  g.poly([{ x: cx - w / 2 - 22, y: y - 4 }, { x: cx - w / 2, y: y - 16 }, { x: cx - w / 2, y: y + 16 }, { x: cx - w / 2 - 22, y: y + 22 }, { x: cx - w / 2 - 12, y: y + 8 }], hex(SWATCHES.gore, a));
  g.poly([{ x: cx + w / 2 + 22, y: y - 4 }, { x: cx + w / 2, y: y - 16 }, { x: cx + w / 2, y: y + 16 }, { x: cx + w / 2 + 22, y: y + 22 }, { x: cx + w / 2 + 12, y: y + 8 }], hex(SWATCHES.gore, a));
  g.rect(cx - w / 2, y - 16, w, 32, hex(col, 0.95 * a));
  g.rect(cx - w / 2, y - 16, w, 2.5, hex(SWATCHES.gilt, a));
  g.rect(cx - w / 2, y + 13.5, w, 2.5, hex(SWATCHES.gilt, a));
  if (unfurl > 0.7) g.text(`×${combo}`, cx, y + 9, { size: 26, font: 'display', color: hex(SWATCHES.tallowHi, a), color2: hex(SWATCHES.gilt, a), align: 'center', shadow: hex('#000000', 0.8 * a) });
}

function marginalia(g: Gfx, v: { x: number; y: number; w: number; h: number }, i: number, left: number, fadeIn: number): void {
  // Glyphs down both margins; each fades out in turn as the 8 s run down.
  const side = i % 2;
  const row = Math.floor(i / 2);
  const x = side ? v.x + v.w - 40 : v.x + 40;
  const y = v.y + 170 + row * 120;
  const own = Math.max(0, Math.min(1, (left - i / 8) * 8));
  const a = own * fadeIn * 0.75;
  if (a <= 0) return;
  g.text(MARGINALIA[i % MARGINALIA.length], x, y, { size: 34, font: 'display', color: hex('#5a3a18', a), align: 'center', shadow: hex(SWATCHES.gilt, 0.35 * a) });
}

function vesselCreep(g: Gfx, v: { x: number; y: number; w: number; h: number }, k: number, pulse: number): void {
  const a = k * (0.45 + 0.35 * pulse);
  const reach = 60 + 160 * k;
  const col = hex('#5a0610', a);
  for (let i = 0; i < 14; i++) {
    const edge = i % 4;
    const u = ((i * 0.618) % 1) * 0.9 + 0.05;
    let x = edge === 0 ? v.x : edge === 1 ? v.x + v.w : v.x + u * v.w;
    let y = edge === 2 ? v.y : edge === 3 ? v.y + v.h : v.y + u * v.h;
    const ang = edge === 0 ? 0 : edge === 1 ? Math.PI : edge === 2 ? Math.PI / 2 : -Math.PI / 2;
    const pts: Vec[] = [{ x, y }];
    for (let j = 1; j <= 8; j++) {
      const aa = ang + Math.sin(i * 3.1 + j * 1.3) * 0.6;
      x += (Math.cos(aa) * reach) / 8;
      y += (Math.sin(aa) * reach) / 8;
      pts.push({ x, y });
      if (j === 4) {
        const b = aa + (i % 2 ? 0.8 : -0.8);
        g.line({ x, y }, { x: x + Math.cos(b) * reach * 0.3, y: y + Math.sin(b) * reach * 0.3 }, 1.4, col);
      }
    }
    g.polyline(pts, 3 - 0.1 * i, col);
  }
}

function crackedGlass(g: Gfx, r: { x: number; y: number; w: number; h: number }, k: number): void {
  const a = Math.min(1, k * 1.5);
  const shown = Math.ceil(CRACKS.length * Math.min(1, k * 1.3));
  for (let i = 0; i < shown; i++) {
    const [x0, y0, x1, y1] = CRACKS[i];
    const a0 = { x: r.x + x0 * r.w, y: r.y + y0 * r.h };
    const a1 = { x: r.x + x1 * r.w, y: r.y + y1 * r.h };
    const mid = { x: (a0.x + a1.x) / 2 + Math.sin(i * 5.3) * 6, y: (a0.y + a1.y) / 2 + Math.cos(i * 3.1) * 4 };
    g.polyline([a0, mid, a1], 2.2, hex('#000000', 0.45 * a));
    g.polyline([a0, mid, a1], 1, hex('#f0f4ff', 0.6 * a));
  }
  g.circle(r.x + 0.5 * r.w, r.y + 0.45 * r.h, 2.5, hex('#f0f4ff', 0.5 * a));
}

/**
 * Draw one effect at (x, y), `t` seconds into its life, outside an operation (the `?scene=vfxlab`
 * board and screenshot reviews). Particle-driven effects are left to the caller's `Particles`.
 */
export function drawVfxSample(g: Gfx, id: string, x: number, y: number, t: number, box: { x: number; y: number; w: number; h: number }): void {
  const spec = specOf(id);
  const life = spec.lifetime || 1.5;
  const k = Math.min(1, t / life);
  const f: Fx = { id, x, y, t, a: -0.6, v: Math.floor(t * 3) % 8, b: { x: x + 70, y: y + 20 } };
  const path = (n: number): Vec[] => Array.from({ length: n }, (_, i) => ({ x: x - 60 + (i / (n - 1)) * 120, y: y + Math.sin(i * 0.5) * 18 }));
  g.setBlend(spec.blend);
  switch (id) {
    case 'blood-splatter':
      f.t = Math.min(t, 3);
      for (let i = 0; i < 8; i++) splatter(g, { ...f, x: box.x + 16 + (i % 4) * ((box.w - 32) / 3), y: box.y + 40 + Math.floor(i / 4) * 50, v: i }, 1);
      break;
    case 'lancet-spray':
      f.a = -0.4;
      spray(g, f);
      break;
    case 'leech-swirl':
      suctionSwirl(g, { x, y }, 1, t);
      break;
    case 'brand-smoke':
      smokePuff(g, f);
      break;
    case 'sear-glow':
      searGlow(g, f, k);
      break;
    case 'tincture-ripple':
      veinRipple(g, f, k);
      break;
    case 'tincture-calm':
      g.arc(x, y, 60 * (0.4 + 0.6 * EASE.outCubic(k)), 3, hex(SWATCHES.mercy, 0.4 * (1 - k)));
      break;
    case 'lens-ring':
      lensRing(g, { x, y: y + 60 }, t);
      break;
    case 'lens-wash':
      g.circleGrad(x, y, 34, hex('#7a5a30', 0.45), hex('#7a5a30', 0));
      for (let i = -3; i <= 3; i++) g.line({ x: x - 20 + i * 5, y: y + 16 }, { x: x + 12 + i * 5, y: y - 16 }, 1, hex(SWATCHES.inkDark, 0.35));
      break;
    case 'salve-smear':
      smear(g, { ...f, t: 0.2, pts: path(12) });
      break;
    case 'salve-glint':
    case 'tongs-clink':
      glint(g, x, y, k, id === 'salve-glint' ? SWATCHES.tallowHi : SWATCHES.brassHi, id === 'salve-glint' ? 18 : 12);
      break;
    case 'suture-sealed':
      g.circleGrad(x, y, 40 * EASE.outCubic(k), hex(SWATCHES.gilt, 0.55 * (1 - k)), hex(SWATCHES.gilt, 0));
      g.arc(x, y, 14 + 22 * EASE.outCubic(k), 2.5, hex(SWATCHES.gilt, 0.9 * (1 - k)));
      glint(g, x, y, k, SWATCHES.tallowHi, 22);
      break;
    case 'tongs-stretch':
      fleshPull(g, f);
      break;
    case 'curse-spawn':
      g.arc(x, y, 10 + 70 * EASE.outCubic(k), 6 * (1 - k), hex(SWATCHES.curseViolet, 0.7 * (1 - k)));
      break;
    case 'curse-crackle':
      f.x = x - 60;
      f.b = { x: x + 60, y: y + 10 };
      crackle(g, f, k);
      break;
    case 'gesture-fizzle':
      smudge(g, { ...f, pts: starPath({ x, y }, 50) });
      break;
    case 'litany-leaf':
      starFracture(g, starPath({ x, y: y - 20 }, 50), { x, y }, t);
      break;
    case 'litany-star': {
      const pts = starPath({ x, y }, 50);
      const n = Math.max(2, Math.floor(pts.length * Math.min(1, t / 0.3)));
      g.polyline(pts.slice(0, n), 5, hex(SWATCHES.gilt, 0.85));
      g.polyline(pts.slice(0, n), 1.6, hex(SWATCHES.tallowHi, 1));
      break;
    }
    case 'star-trail':
      g.polyline(path(20), 3, hex('#fff0b0', 0.9 * (1 - k)));
      break;
    case 'low-vitals-glass':
      crackedGlass(g, { x: x - 80, y: y - 30, w: 160, h: 60 }, 1);
      break;
    case 'low-vitals-vessels':
      g.pushClip(box);
      vesselCreep(g, { x: box.x, y: box.y, w: box.w, h: box.h }, 0.5, Math.exp(-(t % 1) * 8));
      g.popClip();
      break;
    case 'phase-shockwave':
      g.arc(x, y, 10 + 70 * EASE.outCubic(k), 8 * (1 - k) + 1, hex(SWATCHES.curseViolet, 0.6 * (1 - k)));
      break;
    case 'phase-ink-bleed':
      g.pushClip(box);
      inkBleed(g, box, k, true);
      g.popClip();
      break;
    case 'combo-ribbon':
      comboRibbon(g, { x: x - 640, y: y - 150, w: 1280, h: 720 }, 10, t);
      break;
    case 'litany-marginalia':
      for (let i = 0; i < 4; i++) g.text(MARGINALIA[i], x - 60 + i * 40, y + 10, { size: 34, font: 'display', color: hex('#5a3a18', 0.8), align: 'center' });
      break;
    default:
      break;
  }
  g.setBlend('alpha');
}
