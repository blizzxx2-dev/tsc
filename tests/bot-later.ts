/**
 * Bot counterplay for Chapters III–V: the six remaining Hours, the Office and
 * the new ailments. Called from `plan()` in bot.ts; returns null to fall back
 * to the generic planner (lacerations, pools, burns, incisions…).
 */
import { dist, type Vec } from '../src/core/math';
import type { Entity } from '../src/surgery/entity';
import { FIELD, type Operation } from '../src/surgery/operation';
import { BloodPool, Incision, Laceration } from '../src/surgery/entities';
import type { ToolId } from '../src/surgery/types';
import { InkBlot, NameSigil, PrimeMalison } from '../src/surgery/bosses/prime';
import { FlameTongue, TerceMalison } from '../src/surgery/bosses/terce';
import { CrustPlate, SextMalison, SunDial } from '../src/surgery/bosses/sext';
import { currentLag } from '../src/surgery/bosses/common';
import { BurrowSegment, NoneMalison } from '../src/surgery/bosses/none';
import { TallowClot, VespersMalison, WickFilament } from '../src/surgery/bosses/vespers';
import { ComplineMalison, SilenceNode } from '../src/surgery/bosses/compline';
import { OfficeMalison } from '../src/surgery/bosses/office';
import { Agitation, Amputation, ClothFragment, HornBud, Molar, TinctureSite, Vessel, WoundFever, Worm } from '../src/surgery/ailments/kilnrows';
import { Artery, BiteChannel, Contamination, Lockbox, Nodule, PetrifyFront, Retractor, StilledHeart, Tick } from '../src/surgery/ailments/vennmark';
import { Bud, Cyst, HexBall, Infant, LEAD_DISH, Remnant, VocalFold } from '../src/surgery/ailments/hollownight';

interface Frame {
  tool: ToolId;
  pos: Vec;
  down: boolean;
}
type Action = Generator<Frame, void, void>;

export interface BotKit {
  hold(tool: ToolId, target: () => Vec | null, seconds: number): Action;
  tap(tool: ToolId, p: Vec): Action;
  drag(tool: ToolId, pts: Vec[], speed?: number): Action;
  grabTo(tool: ToolId, target: () => Vec | null, dest: Vec, speed?: number): Action;
  chain(...as: Action[]): Action;
  pause(pos: Vec, tool: ToolId, seconds: number): Action;
  zigzag(line: Vec[], crossings: number, amp?: number): Vec[];
  raster(c: Vec, r: number): Vec[];
  OFF_BODY: Vec;
}

/** Decide at the moment the gesture starts (after the bot's think pause), not when planned. */
function* lazy(f: () => Action | null): Action {
  const a = f();
  if (a) yield* a;
}

/** A loop of `turns` around c at radius r. */
function circle(c: Vec, r: number, turns: number): Vec[] {
  const n = Math.ceil(36 * turns);
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

const SIDE: Vec = { x: FIELD.cx + 330, y: FIELD.cy + 20 };

export function planLater(op: Operation, k: BotKit): Action | null {
  const ents = op.entities.filter((e) => e.alive);
  const vis = ents.filter((e) => !e.hidden);

  // Under torpor, let delayed input land before changing instruments.
  const lag = currentLag(op);
  const settle = (a: Action | null): Action | null => (a && lag > 0 ? k.chain(a, k.pause(SIDE, op.tool, lag + 0.1)) : a);
  const r = planBosses(op, k, ents, vis, lag);
  return settle(r);
}

function planBosses(op: Operation, k: BotKit, ents: Entity[], vis: Entity[], lag: number): Action | null {
  const find = <T extends Entity>(cls: abstract new (...a: never[]) => T, pred: (e: T) => boolean = () => true): T | undefined =>
    vis.find((e): e is T => e instanceof cls && pred(e as T));
  const all = <T extends Entity>(cls: abstract new (...a: never[]) => T): T[] => vis.filter((e): e is T => e instanceof cls);
  const live = (e: Entity) => () => (e.alive && !e.hidden ? e.pos : null);
  const inject = (secs = 0.8) => k.hold('tincture', () => SIDE, secs + lag + 0.1);

  // Triage: when wounds pile up in a long fight, close them before chasing the curse.
  if (!/^op[12]-/.test(op.def.id)) {
    const lacs = vis.filter((e): e is Laceration => e instanceof Laceration).sort((a, b) => b.drain(op) - a.drain(op));
    if (lacs.length >= 3 || (lacs.length && op.vitals < 45)) {
      const t = tendWound(k, ents, lacs[0], op.def.tools.includes('salve'));
      if (t) return t;
    }
    // Many small pools add up: draw off the largest.
    const pools = vis.filter((e): e is BloodPool => e instanceof BloodPool).sort((a, b) => b.r - a.r);
    if (pools.length >= 5) return k.hold('leech', () => (pools[0].alive ? pools[0].pos : null), 1.5);
  }

  // ------------------------------------------------------------ The Office: the Final Litany at the Heart
  const office = ents.find((e): e is OfficeMalison => e instanceof OfficeMalison);
  if (office?.stage === 3 && op.canInvokeLitany()) {
    op.invokeLitany();
    if (office.prayerT > 0 && op.canInvokeLitany()) op.invokeLitany();
  }

  // ------------------------------------------------------------ Sext
  const sext = ents.find((e): e is SextMalison => e instanceof SextMalison);
  if (sext) {
    const known = sext.trueVitals !== null ? sext.lastSeen : op.vitals;
    if (op.injectCooldown === 0 && (lag > 0.15 || known < 45)) return inject();
    if (sext.trueVitals !== null && op.elapsed - sext.lastSeenAt > 6) return k.hold('lens', () => sext.heart, 0.5 + lag);
    if (sext.stillborn && op.canInvokeLitany()) op.invokeLitany();
    const dial = find(SunDial);
    if (dial) return k.hold('brand', live(dial), 1.0 + lag);
    const plate = find(CrustPlate);
    if (plate) return k.tap('lancet', plate.pos);
    if (sext.exposed) return k.hold('brand', () => (sext.alive && sext.exposed ? sext.pos : null), 3);
  }

  // ------------------------------------------------------------ Vespers
  const ves = ents.find((e): e is VespersMalison => e instanceof VespersMalison);
  if (ves) {
    const lamps = ves.lamps.filter((l) => l.alive);
    const dim = lamps.filter((l) => l.light < (ves.stage === 3 ? 0.5 : 0.3) || l.gutterT > 0).sort((a, b) => a.light - b.light)[0];
    if (dim) return k.hold('brand', live(dim), ves.tune.relight + 0.25);
  }
  const clot = find(TallowClot);
  if (clot) return clot.softened ? k.hold('leech', live(clot), 1.1) : k.hold('brand', live(clot), 0.45);
  const wick = find(WickFilament);
  if (wick) {
    const n = { x: -(wick.b.y - wick.a.y), y: wick.b.x - wick.a.x };
    const l = Math.hypot(n.x, n.y) || 1;
    return k.drag(
      'lancet',
      [
        { x: wick.pos.x + (n.x / l) * 14, y: wick.pos.y + (n.y / l) * 14 },
        { x: wick.pos.x - (n.x / l) * 24, y: wick.pos.y - (n.y / l) * 24 },
      ],
      300,
    );
  }
  if (ves?.stage === 2) {
    if (ves.bodyLit) return k.hold('brand', () => (ves.alive && ves.stage === 2 && ves.bodyLit ? ves.pos : null), 3);
    return null;
  }
  if (ves?.stage === 3) {
    if (ves.rootBare) return k.tap('lancet', ves.root);
    return k.drag('lancet', ves.wick, 300);
  }

  // ------------------------------------------------------------ None
  const none = ents.find((e): e is NoneMalison => e instanceof NoneMalison);
  const segs = all(BurrowSegment).sort((a, b) => a.eta - b.eta);
  if (op.canInvokeLitany() && ((none && none.stage !== 2 && !none.exposed && none.eta < 5) || (segs[0] && segs[0].eta < 3))) op.invokeLitany();
  if (segs.length) return k.hold('brand', live(segs[0]), 1.0);
  if (none?.stage === 1) {
    if (none.exposed) return k.hold('brand', () => (none.alive && none.exposed ? none.pos : null), 3);
    if (none.hidden) return k.hold('lens', () => (none.alive && none.hidden ? none.pos : null), 0.7);
    return lazy(() => (none.alive && !none.hidden ? k.tap('lancet', none.pos) : null));
  }
  if (none?.stage === 3) {
    // Wait out the surfacing bulge.
    if (none.hidden) return k.pause(none.pos, 'lancet', Math.max(0.1, none.surfacingT));
    if (none.size > 0) return lazy(() => (none.alive ? k.tap('lancet', none.pos) : null));
    return k.grabTo('tongs', () => (none.alive ? none.pos : null), k.OFF_BODY);
  }

  // ------------------------------------------------------------ Prime
  const prime = ents.find((e): e is PrimeMalison => e instanceof PrimeMalison);
  const names = all(NameSigil);
  if (prime || names.length) {
    if (prime?.exposed) return k.hold('brand', () => (prime.alive && prime.exposed ? prime.pos : null), 3);
    const urgent = names.filter((n) => n.written > 0).sort((a, b) => Number(b.red) - Number(a.red) || b.written / b.count - a.written / a.count);
    if (op.canInvokeLitany() && urgent.some((n) => n.written >= n.count - 1) && urgent.length > 1) op.invokeLitany();
    const blot = find(InkBlot, (b) => b.age > 3);
    if (blot) return k.hold('leech', live(blot), 3);
    const n = urgent[0];
    const strike = (n: NameSigil) => lazy(() => (n.alive && n.written > 0 ? k.drag('lancet', n.strokes[n.written - 1], 320) : null));
    if (n && (n.written >= 2 || n.red || !prime)) return strike(n);
    if (n && prime && !ents.some((e) => e.required && !(e instanceof NameSigil) && !(e instanceof PrimeMalison))) return strike(n);
    const anyBlot = find(InkBlot);
    if (anyBlot) return k.hold('leech', live(anyBlot), 3);
    if (n) return null;
  }

  // ------------------------------------------------------------ Terce
  const terce = ents.find((e): e is TerceMalison => e instanceof TerceMalison);
  const tongues = all(FlameTongue);
  if (terce?.phaseNo === 3) {
    if (terce.hazed) return k.hold('leech', () => (terce.alive && terce.hazed ? terce.pos : null), 1.2);
    return lazy(() => (terce.alive ? k.drag('lancet', circle(terce.pos, 70, 1.08), 520) : null));
  }
  const root = tongues.find((t) => t.state === 'root' && !t.pentecost);
  if (root) return k.tap('lancet', root.pos);
  const flame = tongues.find((t) => t.state === 'flame');
  if (flame) return k.drag('salve', k.raster(flame.pos, flame.radius), 900);

  // ------------------------------------------------------------ Compline
  const loosePlate = find(CrustPlate);
  if (loosePlate) return k.tap('lancet', loosePlate.pos);
  const comp = ents.find((e): e is ComplineMalison => e instanceof ComplineMalison);
  // Tend what is killing the patient before pressing the attack.
  const others = vis.some((e) => e.required && !(e instanceof ComplineMalison) && !(e instanceof SilenceNode));
  const node = find(SilenceNode);
  if (node && (!comp || !others || op.vitals > 55)) return k.hold('brand', live(node), 1.0 + lag);
  if (comp && (!others || op.vitals > 55)) {
    if (comp.stage === 3 || (comp.stage === 2 && comp.tune.noNodes)) {
      // Lancet opens, brand follows within the window; under the stolen Litany, wait for the lag first.
      return lazy(() =>
        comp.alive
          ? k.chain(
              k.tap('lancet', comp.pos),
              k.pause(comp.pos, 'lancet', lag > 0 ? lag + 0.05 : 0),
              k.hold('brand', () => (comp.alive ? comp.pos : null), 0.25 + lag),
            )
          : null,
      );
    }
  }

  return planAilments(op, k, ents, vis);
}

/** A path crossing the segment ab at the given offsets (-1..1 along it), alternating sides. */
function crossings(line: Vec[], at: number[], amp: number): Vec[] {
  const [a, b] = line;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const h = { x: (b.x - a.x) / 2, y: (b.y - a.y) / 2 };
  const l = Math.hypot(h.x, h.y) || 1;
  const n = { x: -h.y / l, y: h.x / l };
  const pts: Vec[] = [];
  at.forEach((f, i) => {
    const p = { x: c.x + h.x * f, y: c.y + h.y * f };
    const sgn = i % 2 ? -1 : 1;
    // Asymmetric, so no sampled frame lands exactly on the wound line (a touch is not a crossing).
    pts.push({ x: p.x + n.x * amp * sgn, y: p.y + n.y * amp * sgn }, { x: p.x - n.x * (amp - 3.3) * sgn, y: p.y - n.y * (amp - 3.3) * sgn });
  });
  return pts;
}

/** Close one laceration: draw off the pool drowning it, salve a nick, or stitch it. */
function tendWound(k: BotKit, ents: Entity[], lac: Laceration, salve: boolean): Action | null {
  const pool = ents.find((e): e is BloodPool => e instanceof BloodPool && e.alive && e.r > 28 && dist(e.pos, lac.pos) < e.r * 0.8 + 6);
  if (pool) return k.hold('leech', () => (pool.alive ? pool.pos : null), 3);
  if (lac.small && salve) return k.drag('salve', k.raster(lac.pos, lac.length / 2 + 6), 900);
  const left = Math.max(1, lac.stitch.needed - lac.stitch.count);
  if (lac.stitch.count > 0) {
    const pts = gapStitches(lac.stitch.points, lac.stitch.marks, left);
    return pts ? k.drag('thread', pts, 300) : null;
  }
  const at = Array.from({ length: left }, (_, i) => -0.85 + (1.7 * (i + 0.5)) / left);
  return k.drag('thread', crossings([lac.a, lac.b], at, 24), 380);
}

/** Seconds until pin i's notch comes round to the top. */
function pinWait(box: Lockbox, i: number): number {
  const p = box.pins[i];
  const TAU = Math.PI * 2;
  const mod = (a: number) => ((a % TAU) + TAU) % TAU;
  return p.speed > 0 ? mod(-Math.PI / 2 - p.angle) / p.speed : mod(p.angle + Math.PI / 2) / -p.speed;
}

/**
 * Finish a part-stitched wound: short crossings at the spots farthest from the
 * stitches already placed (the generic zig-zag can land on old stitches and stall).
 */
function gapStitches(line: Vec[], marks: Vec[], want: number): Vec[] | null {
  const spots: { p: Vec; n: Vec }[] = [];
  const samples: { p: Vec; n: Vec; d: number }[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const l = dist(a, b) || 1;
    const n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    for (let s = 6; s < l - 6; s += 6) {
      const p = { x: a.x + ((b.x - a.x) * s) / l, y: a.y + ((b.y - a.y) * s) / l };
      samples.push({ p, n, d: Math.min(...marks.map((m) => dist(m, p)), Infinity) });
    }
  }
  samples.sort((x, y) => y.d - x.d);
  for (const c of samples) {
    if (c.d < 16) break;
    if (spots.every((o) => dist(o.p, c.p) > 22)) spots.push(c);
    if (spots.length >= want) break;
  }
  if (!spots.length) return null;
  const pts: Vec[] = [];
  spots.forEach((sp, i) => {
    const sgn = i % 2 ? -1 : 1;
    pts.push({ x: sp.p.x + sp.n.x * 18 * sgn, y: sp.p.y + sp.n.y * 18 * sgn }, { x: sp.p.x - sp.n.x * 14.7 * sgn, y: sp.p.y - sp.n.y * 14.7 * sgn });
  });
  return pts;
}

function planAilments(op: Operation, k: BotKit, ents: Entity[], vis: Entity[]): Action | null {
  const find = <T extends Entity>(cls: abstract new (...a: never[]) => T, pred: (e: T) => boolean = () => true): T | undefined =>
    vis.find((e): e is T => e instanceof cls && pred(e as T));
  const live = (e: Entity) => () => (e.alive && !e.hidden ? e.pos : null);
  const up = (p: Vec, dy: number): Vec => ({ x: p.x, y: p.y + dy });

  // Things that punish delay first.
  const agit = find(Agitation, (a) => a.level > 0.5 && ents.some((e) => e.alive && e.required));
  if (agit) return k.hold('tincture', () => agit.pos, 0.8);
  const infant = find(Infant);
  if (infant)
    return k.chain(
      k.hold('tongs', () => infant.pos, 0.8),
      k.drag('tongs', [infant.pos, k.OFF_BODY], 200),
    );
  const remnant = find(Remnant);
  if (remnant) return k.hold('brand', live(remnant), 1.3);
  const tick = find(Tick);
  if (tick) return lazy(() => (tick.alive && !tick.hidden ? k.tap('tongs', tick.pos) : null));
  const bud = find(Bud);
  if (bud) return bud.rooted ? k.hold('brand', live(bud), 1.0) : k.tap('lancet', bud.pos);
  const front = find(PetrifyFront);
  if (front) {
    if (op.canInvokeLitany() && front.eta < 8) op.invokeLitany();
    if (front.margin) return k.drag('salve', k.raster(front.margin.center, 30), 900);
    return k.tap('lancet', front.plates[front.next].pos);
  }
  const artery = find(Artery);
  if (artery && !artery.clamped && !artery.boltOut && !artery.spraying) return k.tap('tongs', artery.pos);
  if (artery?.boltOut) return k.drag('thread', crossings(artery.stitch.points, [-0.6, 0, 0.6], 22), 300);

  // Horn-buds: drill, lift the disc, excise.
  const hb = find(HornBud);
  if (hb) {
    if (hb.state === 'drill') return k.hold('lancet', () => hb.pos, 2.0);
    if (hb.state === 'disc') return k.drag('tongs', [hb.pos, up(hb.pos, -100)], 300);
    return k.tap('lancet', hb.pos);
  }
  const cloth = ents.find((e): e is ClothFragment => e instanceof ClothFragment && e.alive);
  if (cloth?.hidden && op.def.tools.includes('lens')) return k.hold('lens', () => (cloth.alive && cloth.hidden ? cloth.pos : null), 0.8);
  if (cloth) return k.drag('tongs', [cloth.pos, up(cloth.pos, -90)], 300);
  const site = find(TinctureSite);
  if (site) return k.hold('tincture', () => (site.alive ? site.pos : null), site instanceof WoundFever ? 2.4 : site.holdTime + 0.25);
  const amp = find(Amputation);
  if (amp) return k.drag('lancet', [amp.a, amp.b, amp.a, amp.b, amp.a, amp.b, amp.a, amp.b], 500);
  const vessel = find(Vessel);
  if (vessel) return k.drag('thread', crossings(vessel.stitch.points, [-0.4, 0.4], 20), 300);
  const worm = find(Worm, (w) => !w.torn);
  if (worm) return k.drag('tongs', [worm.pos, { x: worm.pos.x + worm.dir.x * 175, y: worm.pos.y + worm.dir.y * 175 }], 150);
  const molar = find(Molar);
  if (molar) {
    const p = molar.pos;
    return k.drag('tongs', [p, { x: p.x + 20, y: p.y }, { x: p.x - 20, y: p.y }, { x: p.x + 20, y: p.y }, { x: p.x - 20, y: p.y }, p, up(p, -80)], 200);
  }
  const contam = find(Contamination);
  if (contam) return k.hold('leech', live(contam), 1.8);
  const nod = find(Nodule);
  if (nod) return nod.stage >= 3 && !nod.cracked ? k.hold('brand', live(nod), 0.8) : k.tap('lancet', nod.pos);
  const retr = find(Retractor, (r) => !r.open);
  if (retr) return k.drag('tongs', [retr.pos, { x: retr.pos.x - 120, y: retr.pos.y }], 300);
  const box = find(Lockbox);
  if (box) {
    if (box.open) return k.drag('tongs', [box.pos, up(box.pos, -130)], 300);
    return lazy(() => {
      const idx = box.pins.map((_, i) => i).filter((i) => !box.pins[i].set);
      if (!idx.length) return null;
      const i = idx.sort((a, b) => pinWait(box, a) - pinWait(box, b))[0];
      const w = pinWait(box, i);
      return k.chain(k.pause(box.pinPos(i), 'tongs', w > Math.PI * 2 - 0.2 ? 0 : w), k.tap('tongs', box.pinPos(i)));
    });
  }
  const heart = find(StilledHeart);
  if (heart)
    return lazy(() => {
      const wait = heart.inBeat && heart.window - heart.beatT > 0.85 ? 0 : heart.nextBeatIn || heart.every - heart.beatT;
      return k.chain(
        k.pause(heart.pos, 'tincture', wait + 0.02),
        k.hold('tincture', () => heart.pos, 0.9),
      );
    });
  const bite = find(BiteChannel);
  if (bite) return k.drag('salve', k.raster(bite.pos, 22), 900);
  const fold = find(VocalFold);
  if (fold)
    return lazy(() => {
      if (!fold.alive) return null;
      if (!fold.singing && fold.restLeft > 0.2) return k.tap('lancet', fold.pos);
      return k.chain(k.pause(fold.pos, 'lancet', fold.restIn + 0.05), k.tap('lancet', fold.pos));
    });
  const cyst = find(Cyst);
  if (cyst) return cyst.freed ? k.grabTo('tongs', live(cyst), k.OFF_BODY) : k.drag('lancet', circle(cyst.pos, cyst.r + 22, 1.1), 400);
  const hex = find(HexBall);
  if (hex) return k.drag('tongs', [hex.pos, LEAD_DISH], 400);

  // Part-stitched wounds (Chapters III–V only; the demo bot is left exactly as tuned).
  if (!/^op[12]-/.test(op.def.id)) {
    const inc = find(Incision, (i) => i.state === 'closing' && !!i.stitch && i.stitch.count > 0);
    const flooded = (p: Vec) => ents.some((e) => e instanceof BloodPool && e.r > 28 && dist(e.pos, p) < e.r + 20);
    const lac = find(Laceration, (l) => l.stitch.count > 0 && !(l.small && op.def.tools.includes('salve')) && !flooded(l.pos));
    const part = inc?.stitch ?? lac?.stitch;
    if (part) {
      const pts = gapStitches(part.points, part.marks, part.needed - part.count);
      if (pts) return k.drag('thread', pts, 300);
    }
  }

  void dist;
  return null;
}
