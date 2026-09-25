/**
 * A scripted "bot surgeon" that plays an operation through the same pointer API
 * the game uses. It is deliberately competent but not superhuman in timing, and
 * is used to prove every operation is completable and to calibrate rank thresholds.
 *
 * Skill profiles (seeded, deterministic):
 * - `novice`  think 1.5 s, ±10 px aim
 * - `steady`  think 1.0 s, ±5 px aim
 * - `expert`  think 0.6 s, ±2 px aim, uses the Litany at the moment of greatest drain
 * - `farm`    steady, but stalls every boss for 120 s to milk its adds
 * - `sloppy`  steady, but 30 % of order-sensitive steps are done wrong (no barb nick, no bolt pause, overcut buboes…)
 */
import { dist, Rng, type Vec } from '../src/core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, projectAlong, Rot, SALVE_MAX, Sigil, Venom, Wadding } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { ChoirVoice, DawnOverlay, EggSac, LaudsBody, LaudsMalison, LightThread, SpiderlingGrub } from '../src/surgery/lauds';
import { Malison, MalisonAsh, MalisonShard } from '../src/surgery/malison';
import { FIELD, LEAD_DISH, Operation, Reopened, SimpleBurn, TRAY_DISH, type OperationDef, type OperationOptions } from '../src/surgery/operation';
import type { Pointer, ToolId } from '../src/surgery/types';
import { planLater } from './bot-later';
import { hoursUrgent, planHours } from './bot-hours';
import { BossDeath, MalisonBase } from '../src/surgery/bosses/base';
import { MatinsHerald } from '../src/surgery/bosses/elites';
import type { JournalEvent } from '../src/surgery/events';
import type { Input } from '../src/core/input';
import type { Game } from '../src/core/scene';
import { OperationScene } from '../src/scenes/operation';
import { CHATTER_MS, CHATTER_PX } from '../src/input/opinput';
import type { TinctureColor } from '../src/surgery/progress';
import { botPlanAlpha, isAlphaEntity } from './botAlpha';

export const DT = 1 / 60;

export interface Frame {
  tool: ToolId;
  pos: Vec;
  down: boolean;
  /** Mouse-wheel notches this frame (rotating what the tongs hold). */
  wheel?: number;
  /** Tincture colour to load before this frame. */
  tincture?: TinctureColor;
}

export type Action = Generator<Frame, void, void>;

export function* hold(tool: ToolId, target: () => Vec | null, seconds: number): Action {
  for (let t = 0; t < seconds; t += DT) {
    const p = target();
    if (!p) return;
    yield { tool, pos: p, down: true };
  }
}

export function* chain(...as: Action[]): Action {
  for (const a of as) yield* a;
}

export function* tap(tool: ToolId, p: Vec): Action {
  yield { tool, pos: p, down: true };
  yield { tool, pos: p, down: false };
}

/** Grab a moving target where it is *now*, then drag it to a destination. */
export function* grabTo(tool: ToolId, target: () => Vec | null, dest: Vec, speed = 600): Action {
  const start = target();
  if (!start) return;
  yield* drag(tool, [start, dest], speed, 0.15);
}

/** Drag along a polyline at a human-ish speed, optionally lingering at the end before letting go. */
export function* drag(tool: ToolId, pts: Vec[], speed = 420, linger = 0): Action {
  const step = speed * DT;
  yield { tool, pos: pts[0], down: true };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) yield { tool, pos: { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, down: true };
  }
  const end = pts[pts.length - 1];
  for (let t = 0; t < linger; t += DT) yield { tool, pos: end, down: true };
  yield { tool, pos: end, down: false };
}

/** Hold still (button down) at a point. */
export function* still(tool: ToolId, p: Vec, seconds: number): Action {
  for (let t = 0; t < seconds; t += DT) yield { tool, pos: p, down: true };
}

/** Zig-zag across a polyline, crossing it `crossings` times. */
export function zigzag(line: Vec[], crossings: number, amp = 26): Vec[] {
  const lens: number[] = [0];
  for (let i = 1; i < line.length; i++) lens.push(lens[i - 1] + dist(line[i - 1], line[i]));
  const total = lens[lens.length - 1];
  const at = (s: number): { p: Vec; n: Vec } => {
    let i = 1;
    while (i < line.length - 1 && lens[i] < s) i++;
    const a = line[i - 1];
    const b = line[i];
    const seg = lens[i] - lens[i - 1] || 1;
    const t = (s - lens[i - 1]) / seg;
    const d = { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg };
    return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, n: { x: -d.y, y: d.x } };
  };
  const pts: Vec[] = [];
  for (let i = 0; i <= crossings; i++) {
    const s = total * (0.04 + (0.92 * i) / crossings);
    const { p, n } = at(s);
    const side = i % 2 ? -amp : amp;
    pts.push({ x: p.x + n.x * side, y: p.y + n.y * side });
  }
  return pts;
}

/**
 * Stitch a wound that already carries stitches: one stab through each remaining gap (a repeat of
 * the first zig-zag lands beside the old stitches and is refused). Each stab lands 4.5 px past the
 * wound, so the stitch sits where it was aimed along it; a gap too narrow to fit one cleanly is
 * stabbed from the side the neighbouring stitches lean away from.
 */
export function* restitch(lac: Laceration): Action {
  const line = [lac.a, lac.b];
  const st = lac.stitch;
  const total = st.length;
  const d = { x: (lac.b.x - lac.a.x) / (total || 1), y: (lac.b.y - lac.a.y) / (total || 1) };
  const n = { x: -d.y, y: d.x };
  const at = st.marks.map((m) => ({ s: projectAlong(line, m).at, o: (m.x - lac.a.x) * n.x + (m.y - lac.a.y) * n.y })).sort((a, b) => a.s - b.s);
  const edges = [0, ...at.map((m) => m.s), total];
  const gaps = edges.slice(1).map((b, i) => ({ a: edges[i], b, lean: (at[i - 1]?.o ?? 0) + (at[i]?.o ?? 0) }));
  const stabs: { s: number; side: number }[] = [];
  for (const g of gaps) {
    const len = g.b - g.a;
    // Room for a stitch at least `minSpacing` (10 px) from both neighbours.
    if (len < 21) continue;
    const k = Math.max(1, Math.ceil(len / 40) - 1);
    for (let i = 1; i <= k; i++) stabs.push({ s: g.a + (len * i) / (k + 1), side: 0 });
  }
  if (!stabs.length) {
    const g = gaps.reduce((w, x) => (x.b - x.a > w.b - w.a ? x : w));
    stabs.push({ s: (g.a + g.b) / 2, side: g.lean >= 0 ? -1 : 1 });
  }
  const P = (s: number, o: number): Vec => ({ x: lac.a.x + d.x * s + n.x * o, y: lac.a.y + d.y * s + n.y * o });
  let side = stabs[0].side || 1;
  let p = P(stabs[0].s, -8 * side);
  yield { tool: 'thread', pos: p, down: true };
  for (const stab of stabs) {
    if (stab.side) side = stab.side;
    // Approach along the wound on this side, then stab across it in one frame.
    const from = P(stab.s, -8 * side);
    for (let i = 1, k = Math.max(1, Math.ceil(dist(p, from) / 4)); i <= k; i++) yield { tool: 'thread', pos: { x: p.x + ((from.x - p.x) * i) / k, y: p.y + ((from.y - p.y) * i) / k }, down: true };
    p = P(stab.s, 4.5 * side);
    yield { tool: 'thread', pos: p, down: true };
    side = -side;
  }
  yield { tool: 'thread', pos: p, down: false };
}

/** The thread stroke for a wound: a fresh zig-zag, or one stab through each remaining gap. */
export function stitchWound(lac: Laceration): Action {
  if (lac.stitch.count === 0) {
    // One spare crossing, unless that would pack the stitches too close to the 10 px minimum
    // spacing (short wounds): rejected stitches leave gaps no later stitch can fill.
    const needed = Math.max(1, lac.stitch.needed);
    const spare = (0.92 * lac.length) / (needed + 1) >= 13 ? 1 : 0;
    return drag('thread', zigzag([lac.a, lac.b], needed + spare), 380);
  }
  return restitch(lac);
}

/** Brush raster over a disc. */
export function raster(c: Vec, r: number): Vec[] {
  const pts: Vec[] = [];
  let flip = false;
  for (let y = -r; y <= r; y += 16) {
    const w = Math.sqrt(Math.max(0, r * r - y * y)) + 6;
    const row = [
      { x: c.x - w, y: c.y + y },
      { x: c.x + w, y: c.y + y },
    ];
    pts.push(...(flip ? row.reverse() : row));
    flip = !flip;
  }
  return pts;
}

export const OFF_BODY: Vec = { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 60 };
export const alive = (e: Entity) => () => (e.alive && !e.hidden ? e.pos : null);
const along = (o: Vec, a: number, d: number): Vec => ({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d });

export type Profile = 'novice' | 'steady' | 'expert' | 'farm' | 'sloppy';
/** Order-sensitive mistakes a bot can be told (or roll) to make. */
export type Mistake = 'nick' | 'bolt' | 'bubo' | 'acid' | 'wadding';

export const PROFILES: Record<Profile, { think: number; aim: number; sloppy: number; farm: number }> = {
  novice: { think: 1.5, aim: 10, sloppy: 0, farm: 0 },
  steady: { think: 1.0, aim: 5, sloppy: 0, farm: 0 },
  expert: { think: 0.6, aim: 2, sloppy: 0, farm: 0 },
  farm: { think: 1.0, aim: 5, sloppy: 0, farm: 120 },
  sloppy: { think: 1.0, aim: 5, sloppy: 0.3, farm: 0 },
};

export interface BotContext {
  op: Operation;
  rng: Rng;
  aim: number;
  sloppy: number;
  farm: number;
  bossSeen: number;
  expert: boolean;
  /** Offset a target point by this action's aim error. */
  jitter(p: Vec): Vec;
  /** Should the bot make this (order-sensitive) mistake now? Forced ones always happen; sloppy bots roll. */
  mistake(kind: Mistake): boolean;
  has(t: ToolId): boolean;
  forced: ReadonlySet<Mistake>;
  /** Speak the Litany (recorded as a bot event so input-path mirrors can replay it). */
  litany(): void;
}

/** Leftover salve too thin to finish the job: wait for the pot to refill. */
function* waitSalve(): Action {
  for (let t = 0; t < 3.2; t += DT) yield { tool: 'salve', pos: OFF_BODY, down: false };
}

function salveOr(ctx: BotContext, a: () => Action): Action {
  if (ctx.op.salve < 6) return waitSalve();
  return a();
}

/** Pull an embedded object out along its axis and off the body (into the right dish). */
function extract(ctx: BotContext, emb: Embedded): Action {
  const grip = emb.spec.len > 0 ? { x: emb.origin.x + (emb.handle.x - emb.origin.x) * 0.7, y: emb.origin.y + (emb.handle.y - emb.origin.y) * 0.7 } : emb.pos;
  const ax = emb.spec.len > 0 ? emb.axis : -Math.PI / 2;
  const dest = emb.kind === 'hexstone' ? LEAD_DISH : TRAY_DISH;
  const speed = emb.kind === 'glass' ? 320 : 480;
  const g = ctx.jitter(grip);
  if (emb.kind === 'bolt' && !ctx.mistake('bolt')) {
    const mid = along(g, ax, emb.spec.len * 0.5);
    return chain(dragNoRelease('tongs', [g, mid], 300), still('tongs', mid, 0.45), drag('tongs', [mid, along(mid, ax, 30), dest], speed, 0.2));
  }
  return drag('tongs', [g, along(g, ax, 40), dest], speed, 0.2);
}

function* dragNoRelease(tool: ToolId, pts: Vec[], speed: number): Action {
  const step = speed * DT;
  yield { tool, pos: pts[0], down: true };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) yield { tool, pos: { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, down: true };
  }
}

function plan(ctx: BotContext): Action | null {
  const op = ctx.op;
  const ents = op.entities.filter((e) => e.alive);
  const vis = ents.filter((e) => !e.hidden);
  const has = ctx.has;
  const find = <T extends Entity>(cls: new (...a: never[]) => T, pred: (e: T) => boolean = () => true) =>
    vis.find((e): e is T => e instanceof cls && pred(e as T));

  // Chapters III–V: bosses and ailments with their own counterplay (tests/bot-later.ts).
  const kit = { hold, tap, drag: (t: ToolId, pts: Vec[], sp: number) => drag(t, pts, sp), grabTo, chain, pause, zigzag, raster, OFF_BODY };
  const later = planLater(op, kit);
  if (later) return later;

  // Chapters III–V have their own entity kinds, planned by tests/bot-later.ts.
  const laterOp = /^op[345]-/.test(op.def.id);
  if (!laterOp) for (const e of ents) if (!isKnown(e)) throw new Error(`bot: unknown entity kind ${e.constructor.name}`);

  if (op.vitals < (ctx.expert ? 60 : 40) && op.injectCooldown === 0 && has('tincture')) return hold('tincture', () => ({ x: FIELD.cx + 330, y: FIELD.cy + 20 }), 0.8);

  // Let a hot brand cool rather than have it lock mid-searing.
  if (op.brandHeat > 4 && has('brand')) return pause(OFF_BODY, op.tool, 1.2);

  const alpha = botPlanAlpha(ctx);
  if (alpha) return alpha;

  // Venom motes about to reach the heart.
  const mv = vis.find((e): e is Venom => e instanceof Venom && e.motes.some((m) => m.s > e.veinLen * 0.35));
  const catcher: ToolId | null = has('brand') ? 'brand' : has('leech') ? 'leech' : null;
  if (mv && catcher) {
    const m = mv.motes.find((mm) => mm.s > mv.veinLen * 0.35)!;
    return hold(catcher, () => (mv.alive && m.alive ? mv.motePos(m) : null), 1.2);
  }

  const bosses = vis.filter((e) => e.boss);
  if (bosses.length && ctx.bossSeen < 0) ctx.bossSeen = op.elapsed;
  const stalling = ctx.farm > 0 && ctx.bossSeen >= 0 && op.elapsed - ctx.bossSeen < ctx.farm;

  // The Hours on MalisonBase (Matins, Lauds): their own strategies, unless wounds are piling up
  // (a farming bot only dodges while it stalls).
  const lacs = vis.filter((e): e is Laceration => e instanceof Laceration);
  // An expert keeps the table clean (and the vitals up) rather than pressing on with wounds open.
  const piling = ctx.expert ? lacs.length >= 2 || (lacs.length > 0 && op.vitals < 60) : lacs.length >= 3 || (lacs.length > 0 && op.vitals < 45);
  if (!stalling && (hoursUrgent(op) || !(piling || find(BloodPool, (p) => p.r > 34)))) {
    const hours = planHours(op, kit);
    if (hours) return hours;
  } else if (lacs.length && ents.some((e) => e instanceof MalisonBase)) {
    // In a boss fight, close the bleeding wound before mopping up what it bleeds.
    const big = find(BloodPool, (p) => p.r > 40);
    if (big) return hold('leech', alive(big), 3);
    const worst = lacs.sort((a, b) => b.drain(op) - a.drain(op))[0];
    // A flooded wound cannot be stitched: draw off the pool that covers it first.
    const over = find(BloodPool, (p) => dist(p.pos, worst.pos) < p.r + 12);
    if (over) return hold('leech', alive(over), 2.5);
    return tendLaceration(worst, has('salve'));
  }
  const venom = find(Venom);
  if (venom) return hold('tincture', alive(venom), 1.1);

  const sac = find(EggSac);
  if (sac) return tap('lancet', ctx.jitter(sac.pos));

  const bubo = find(Bubo, (b) => !b.lanced);
  if (bubo) {
    const c = ctx.jitter(bubo.pos);
    const half = ctx.mistake('bubo') ? bubo.r * 1.3 : bubo.r * 0.7;
    return drag('lancet', [{ x: c.x - half, y: c.y }, { x: c.x + half, y: c.y }], 300);
  }

  // A player invokes the Litany when the Malison lays itself open (the phased Hours pick their own moment).
  if (op.canInvokeLitany() && bosses.length && !stalling) {
    const opening = bosses.some((b) => (b instanceof Malison && !b.tune.phased && b.open) || (b instanceof LaudsMalison && !b.tune.phased && b.livingVoices.length <= 2));
    if (opening) ctx.litany();
  }

  // An expert spends the Litany on the Malison itself, not on its hexlings.
  if (ctx.expert && op.litanyTime > 0) {
    const m = find(Malison, (mm) => mm.open);
    if (m) return hold('brand', () => (m.alive && m.open ? m.pos : null), 3);
  }
  const shard = find(MalisonShard);
  if (shard) return grabTo('tongs', alive(shard), OFF_BODY);

  for (const cls of [SpiderlingGrub, Grub] as const) {
    const g = find(cls as new (...a: never[]) => Entity);
    if (g && has('brand')) return hold('brand', alive(g), 2);
    if (g) return grabTo('tongs', alive(g), OFF_BODY);
  }

  // With wounds tended, press the Hour again.
  const hours = stalling ? null : planHours(op, kit);
  if (hours && !find(Laceration) && !find(BloodPool, (p) => p.ichor !== 'blood' || p.r > 28)) return hours;

  // Drain big pools before anything they cover.
  const pool = find(BloodPool, (p) => p.ichor !== 'blood' || p.r > 28);
  if (pool) return hold('leech', alive(pool), 3);

  const emb = find(Embedded, (e) => !e.grabbed);
  if (emb) {
    if (emb.barbed && emb.nicks < 2 && !ctx.mistake('nick')) return tap('lancet', ctx.jitter({ x: emb.origin.x + 4, y: emb.origin.y + 4 }));
    if (!emb.calmed && has('brand')) return hold('brand', () => (emb.alive && !emb.calmed ? emb.pos : null), 0.8);
    return extract(ctx, emb);
  }
  const wad = ctx.forced.has('wadding') ? undefined : find(Wadding);
  if (wad) return drag('tongs', [ctx.jitter(wad.pos), TRAY_DISH], 480, 0.1);

  const burn = find(Burn);
  if (burn) {
    if (burn.charCore) {
      const r = burn.radius * 0.4;
      return drag('lancet', [{ x: burn.pos.x - r, y: burn.pos.y }, { x: burn.pos.x + r, y: burn.pos.y }, { x: burn.pos.x - r, y: burn.pos.y + 6 }], 300);
    }
    if (burn.acidLive) {
      if (ctx.mistake('acid')) return salveOr(ctx, () => drag('salve', raster(burn.pos, burn.radiusNow), 900));
      return hold('leech', alive(burn), 1.2);
    }
    if (burn.flakes.length) return tap('tongs', burn.flakes[0]);
    if (burn.ember && has('brand')) {
      const em = burn.ember;
      return hold('brand', () => (burn.alive && burn.ember ? em : null), 0.7);
    }
    return salveOr(ctx, () => drag('salve', raster(burn.pos, burn.radiusNow), 900));
  }

  const scorch = find(SimpleBurn);
  if (scorch && has('salve')) return salveOr(ctx, () => drag('salve', raster(scorch.pos, 16), 700));

  const lac = find(Laceration);
  if (lac) {
    if (lac.length <= SALVE_MAX && has('salve')) return salveOr(ctx, () => drag('salve', raster(lac.pos, lac.length / 2 + 6), 900));
    return stitchWound(lac);
  }
  const re = find(Reopened);
  if (re) return drag('thread', zigzag([re.a, re.b], re.needed + 1), 380);

  const lanced = find(Bubo, (b) => b.lanced);
  if (lanced) return salveOr(ctx, () => drag('salve', raster(lanced.cov.center, lanced.cov.radius), 900));

  const sigil = find(Sigil);
  if (sigil) {
    const cur = sigil.current;
    if (!sigil.ignited[cur]) {
      const node = ctx.jitter(sigil.nodes[cur]);
      return hold('brand', () => (sigil.alive && !sigil.ignited[cur] ? node : null), 1.3);
    }
    // Trace the rest of the stroke in one motion.
    const segs = sigil.segs.filter((s) => s.stroke === cur);
    const from = segs.findIndex((s) => s.burned.some((b) => !b));
    if (from >= 0) return drag('brand', [segs[from].a, ...segs.slice(from).map((s) => s.b)], 300);
  }

  const rot = find(Rot);
  if (rot) return salveOr(ctx, () => drag('salve', raster(rot.pos, rot.r), 1100));

  const inc = find(Incision, (i) => i.state === 'mark' || i.state === 'closing');
  if (inc?.state === 'mark') return drag('lancet', [inc.pointAt(inc.progress), ...inc.points.filter((_, i) => i > 0)], 350);
  if (inc?.state === 'closing' && inc.stitch) return drag('thread', zigzag(inc.points, Math.max(1, inc.stitch.needed - inc.stitch.count) + 1), 380);

  // Tidy up the smaller pools while there's a moment.
  const small = find(BloodPool, (p) => p.r > 14);
  if (small) return hold('leech', alive(small), 2);

  // Anything left is hidden: sweep the lens over it.
  const hidden = ents.find((e) => e.hidden && !(e instanceof LaudsMalison));
  if (hidden && has('lens')) return hold('lens', () => (hidden.alive && hidden.hidden ? hidden.pos : null), 0.8);

  return null;
}

function tendLaceration(lac: Laceration, salve: boolean): Action {
  if (lac.length <= SALVE_MAX && salve) return drag('salve', raster(lac.pos, lac.length / 2 + 6), 900);
  return stitchWound(lac);
}

// Boss-framework kinds (MalisonBase cores and elites, their wounds and overlays) are planned by tests/bot-hours.ts.
const KNOWN = [BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom, Wadding, ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub, Malison, MalisonShard, MalisonAsh, Reopened, SimpleBurn, MalisonBase, BossDeath, DawnOverlay, LaudsBody, LightThread, MatinsHerald];
const WOUND_FEVER = 'WoundFever';

function isKnown(e: Entity): boolean {
  return KNOWN.some((k) => e instanceof k) || e.constructor.name === WOUND_FEVER || isAlphaEntity(e);
}
export interface BotResult {
  op: Operation;
  frames: number;
}

export interface BotOptions extends OperationOptions {
  /** Seconds of "look, pick tool, aim" before each gesture — models human pacing. */
  think?: number;
  maxSeconds?: number;
  profile?: Profile;
  /** Seed for the bot's own aim noise and mistakes. */
  botSeed?: number;
  /** Receives every journal event (the bot otherwise discards them). */
  collect?: (e: JournalEvent) => void;
  /** Called with the fresh operation before play starts (subscribe to its events). */
  onOp?: (op: Operation) => void;
  /** Called after every simulated frame with the pointer the bot sent (audio replay tests). */
  onFrame?: (op: Operation, ptr: Pointer | null, dt: number) => void;
  /**
   * Emit the release that ends a gesture on its own frame and plan the next gesture on the
   * following frame. Real mouse input can deliver only one button transition per frame, so the
   * E2E mirror uses this; the headless suites keep the default (release + next press in one frame).
   */
  splitRelease?: boolean;
  /** Mistakes this bot always makes. */
  mistakes?: readonly Mistake[];
}

/** Idle frames at the current pointer (pointer up). */
function* pause(pos: Vec, tool: ToolId, seconds: number): Action {
  for (let t = 0; t < seconds; t += DT) yield { tool, pos, down: false };
}

/**
 * Drives one operation frame by frame. `input()` feeds this frame's pointer
 * and tool choice; the caller advances the simulation (headless loop below, or
 * the real OperationScene in the dev playback view).
 */
export class BotDriver {
  readonly ctx: BotContext;
  private prev: Vec = { x: FIELD.cx, y: FIELD.cy };
  private wasDown = false;
  private action: Action | null = null;
  private aimOff: Vec = { x: 0, y: 0 };
  private readonly think: number;
  private out: BotEvent[] = [];
  /** Where the bot's hand is (for drawing a cursor during playback). */
  get hand(): Vec {
    return this.prev;
  }

  constructor(
    readonly op: Operation,
    private readonly opts: BotOptions = {},
  ) {
    const prof = opts.profile ? PROFILES[opts.profile] : null;
    this.think = opts.think ?? prof?.think ?? 0;
    const rng = new Rng(opts.botSeed ?? 7);
    const sloppy = prof?.sloppy ?? 0;
    const forced = new Set<Mistake>(opts.mistakes ?? []);
    this.ctx = {
      op,
      rng,
      aim: prof?.aim ?? 0,
      sloppy,
      farm: prof?.farm ?? 0,
      bossSeen: -1,
      expert: opts.profile === 'expert',
      jitter: (p) => ({ x: p.x + this.aimOff.x, y: p.y + this.aimOff.y }),
      mistake: (k) => forced.has(k) || (sloppy > 0 && rng.next() < sloppy),
      has: (t) => op.def.tools.includes(t),
      forced,
      litany: () => this.out.push({ kind: 'litany' }),
    };
  }

  /** Feed one frame of input straight to the operation. */
  input(): void {
    applyBotEvents(this.op, this.tick());
  }

  /** Decide this frame's input as events (applied in order by `applyBotEvents` or an input-path mirror). */
  tick(): BotEvent[] {
    const op = this.op;
    const out: BotEvent[] = [];
    if (op.status !== 'running' || op.paused) return out;
    if (op.dialogue.length) {
      out.push({ kind: 'advance' });
      return out;
    }
    this.out = out;
    let f = this.action?.next();
    if (!f || f.done) {
      // Finish the previous gesture cleanly before planning the next.
      if (this.wasDown) {
        out.push({ kind: 'pointer', tool: op.tool, ptr: { pos: this.prev, prev: this.prev, down: false, pressed: false, released: true }, select: false });
        this.wasDown = false;
        if (this.opts.splitRelease) {
          this.action = null;
          return out;
        }
      }
      const { rng, aim } = this.ctx;
      const a = rng.range(0, Math.PI * 2);
      const r = aim * Math.sqrt(rng.next());
      this.aimOff = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      const next = plan(this.ctx);
      this.action = next && this.think > 0 ? chain(pause(this.prev, op.tool, this.think), next) : next;
      f = this.action?.next();
    }
    if (f && !f.done) {
      const fr = f.value;
      const ptr: Pointer = { pos: fr.pos, prev: this.prev, down: fr.down, pressed: fr.down && !this.wasDown, released: !fr.down && this.wasDown };
      out.push({ kind: 'pointer', tool: fr.tool, ptr, select: true, tincture: fr.tincture, wheel: fr.wheel });
      this.wasDown = fr.down;
      this.prev = fr.pos;
    }
    return out;
  }
}

/** One input event the bot wants applied this frame, in order. */
export type BotEvent =
  | { kind: 'pointer'; tool: ToolId; ptr: Pointer; select: boolean; tincture?: TinctureColor; wheel?: number }
  | { kind: 'litany' }
  | { kind: 'advance' };

/** Apply bot events straight to the simulation (the headless equivalent of the operation scene). */
export function applyBotEvents(op: Operation, events: readonly BotEvent[]): void {
  for (const ev of events) {
    if (ev.kind === 'litany') op.invokeLitany();
    else if (ev.kind === 'advance') op.advanceDialogue();
    else {
      if (ev.select) op.setTool(ev.tool);
      if (ev.tincture) for (let i = 0; i < 4 && op.tinctureColor !== ev.tincture; i++) op.cycleTincture();
      op.handlePointer(ev.ptr, DT);
      if (ev.wheel) op.wheel(ev.wheel);
    }
  }
}

/** A bot playthrough driven one frame at a time (offline audio renders interleave it with rendering). */
export interface BotStepper extends BotResult {
  /** Simulate one frame; false once the operation is over (or the time cap is reached). */
  step(): boolean;
  /** Run to the end. */
  finish(): BotResult;
}

export function botStepper(def: OperationDef, opts: BotOptions = {}): BotStepper {
  const maxSeconds = opts.maxSeconds ?? 900;
  const op = new Operation(def, opts);
  opts.onOp?.(op);
  const bot = new BotDriver(op, opts);
  let last: Pointer | null = null;
  const s: BotStepper = {
    op,
    frames: 0,
    step() {
      if (!(op.status === 'intro' || op.status === 'running') || s.frames >= maxSeconds * 60) return false;
      s.frames++;
      const j0 = op.journal.length;
      const evs = bot.tick();
      applyBotEvents(op, evs);
      for (const ev of evs) if (ev.kind === 'pointer') last = ev.ptr;
      op.update(DT);
      if (opts.collect) for (const e of op.journal.slice(Math.min(j0, op.journal.length))) opts.collect(e);
      opts.onFrame?.(op, last, DT);
      return true;
    },
    finish() {
      while (s.step());
      return { op, frames: s.frames };
    },
  };
  return s;
}

/** Play an operation to completion (or failure) with the bot. */
export function playWithBot(def: OperationDef, opts: BotOptions = {}): BotResult {
  return botStepper(def, opts).finish();
}

/**
 * The same bot, but driving the real input pipeline: every bot frame becomes
 * timestamped device events (tool hotkey, pointer move, button down/up) fed to a
 * DOM-free `Input`, and the real `OperationScene.update` consumes them. Used by
 * the record/replay regression test and to prove the input layer can still win.
 */
export function playWithBotThroughInput(def: OperationDef, input: Input, opts: BotOptions = {}): { scene: OperationScene; frames: number } {
  const maxSeconds = opts.maxSeconds ?? 900;
  const scene = new OperationScene(
    def,
    () => undefined,
    () => undefined,
    opts.record ? { record: true } : {},
  );
  const game: Game = { input, audio: { play: () => undefined } as unknown as Game['audio'], gfx: null as unknown as Game['gfx'], go: () => undefined };
  scene.enter();
  const op = scene.op;
  const bot = new BotDriver(op, opts);
  let t = 1000;
  let prev: Vec = { x: FIELD.cx, y: FIELD.cy };
  let wasDown = false;
  let frames = 0;
  // The bot ends one hold and starts the next in the same instant. A real re-click at the same spot is slower
  // than a switch bounce, so a press that would otherwise read as chatter (INP-0034) waits the window out.
  let lastUp: { t: number; pos: Vec } | null = null;
  const TOOLS: ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];
  while ((op.status === 'intro' || op.status === 'running') && frames < maxSeconds * 60) {
    frames++;
    for (const ev of bot.tick()) {
      if (ev.kind === 'litany') op.invokeLitany();
      else if (ev.kind === 'advance') op.advanceDialogue();
      else {
        if (ev.select && ev.tool !== op.tool) {
          const code = `key:Digit${TOOLS.indexOf(ev.tool) + 1}`;
          input.push({ t: t + 2, type: 'down', code });
          input.push({ t: t + 2.5, type: 'up', code });
        }
        if (ev.tincture) for (let i = 0; i < 4 && op.tinctureColor !== ev.tincture; i++) op.cycleTincture();
        const p = ev.ptr.pos;
        if (p.x !== prev.x || p.y !== prev.y) input.push({ t: t + 3, type: 'move', x: p.x, y: p.y, src: 'kbm' });
        if (ev.ptr.down && !wasDown) {
          const bounce = lastUp && t + 4 - lastUp.t <= CHATTER_MS && Math.hypot(p.x - lastUp.pos.x, p.y - lastUp.pos.y) <= CHATTER_PX;
          input.push({ t: bounce ? lastUp!.t + CHATTER_MS + 2 : t + 4, type: 'down', code: 'mouse:0' });
        }
        if (!ev.ptr.down && wasDown) {
          input.push({ t: t + 4, type: 'up', code: 'mouse:0' });
          lastUp = { t: t + 4, pos: p };
        }
        if (ev.wheel) op.wheel(ev.wheel);
        wasDown = ev.ptr.down;
        prev = p;
      }
    }
    t += DT * 1000;
    input.beginFrame(t, DT);
    scene.update(DT, game);
    input.endFrame();
  }
  return { scene, frames };
}
