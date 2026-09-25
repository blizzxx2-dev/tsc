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
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, SALVE_MAX, Sigil, Venom, Wadding } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../src/surgery/lauds';
import { Malison, MalisonShard } from '../src/surgery/malison';
import { FIELD, LEAD_DISH, Operation, Reopened, SimpleBurn, TRAY_DISH, type OperationDef, type OperationOptions } from '../src/surgery/operation';
import type { Pointer, ToolId } from '../src/surgery/types';
import { botPlanAlpha, isAlphaEntity } from './botAlpha';

export const DT = 1 / 60;

export interface Frame {
  tool: ToolId;
  pos: Vec;
  down: boolean;
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
  /** Roll for a sloppy mistake. */
  slip(): boolean;
  has(t: ToolId): boolean;
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
  if (emb.kind === 'bolt' && !(ctx.sloppy && ctx.slip())) {
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

  for (const e of ents) if (!isKnown(e)) throw new Error(`bot: unknown entity kind ${e.constructor.name}`);

  if (op.vitals < 40 && op.injectCooldown === 0 && has('tincture')) return hold('tincture', () => ({ x: FIELD.cx + 330, y: FIELD.cy + 20 }), 0.8);

  const alpha = botPlanAlpha(ctx);
  if (alpha) return alpha;

  // Venom motes about to reach the heart.
  const mv = vis.find((e): e is Venom => e instanceof Venom && e.motes.some((m) => m.s > e.veinLen * 0.35));
  const catcher: ToolId | null = has('brand') ? 'brand' : has('leech') ? 'leech' : null;
  if (mv && catcher) {
    const m = mv.motes.find((mm) => mm.s > mv.veinLen * 0.35)!;
    return hold(catcher, () => (mv.alive && m.alive ? mv.motePos(m) : null), 1.2);
  }

  const venom = find(Venom);
  if (venom) return hold('tincture', alive(venom), 1.1);

  const sac = find(EggSac);
  if (sac) return tap('lancet', ctx.jitter(sac.pos));

  const bubo = find(Bubo, (b) => !b.lanced);
  if (bubo) {
    const c = ctx.jitter(bubo.pos);
    const half = ctx.sloppy && ctx.slip() ? bubo.r * 1.3 : bubo.r * 0.7;
    return drag('lancet', [{ x: c.x - half, y: c.y }, { x: c.x + half, y: c.y }], 300);
  }

  const bosses = vis.filter((e) => e.boss);
  if (bosses.length && ctx.bossSeen < 0) ctx.bossSeen = op.elapsed;
  const stalling = ctx.farm > 0 && ctx.bossSeen >= 0 && op.elapsed - ctx.bossSeen < ctx.farm;

  // A player invokes the Litany when a Malison shows itself (an expert waits for the worst moment).
  if (op.canInvokeLitany() && bosses.length && !stalling) {
    if (!ctx.expert || op.entities.filter((e) => e.alive && !e.hidden).length >= 4 || op.vitals < 60) op.invokeLitany();
  }

  const shard = find(MalisonShard);
  if (shard) return grabTo('tongs', alive(shard), OFF_BODY);

  for (const cls of [SpiderlingGrub, Grub] as const) {
    const g = find(cls as new (...a: never[]) => Entity);
    if (g && has('brand')) return hold('brand', alive(g), 2);
    if (g) return grabTo('tongs', alive(g), OFF_BODY);
  }

  if (!stalling) {
    const voice = find(ChoirVoice);
    if (voice) return hold('brand', alive(voice), 2);
  }
  const lauds = ents.find((e): e is LaudsMalison => e instanceof LaudsMalison);
  if (lauds?.submerged) return hold('lens', () => (lauds.alive && lauds.submerged ? lauds.pos : null), 1.5);
  if (lauds && lauds.livingVoices.length === 0 && !stalling) return hold('brand', () => (lauds.alive && !lauds.submerged && lauds.livingVoices.length === 0 ? lauds.pos : null), 4);

  const matins = find(Malison, (m) => m.open);
  if (matins && !stalling) return hold('brand', () => (matins.alive && matins.open ? matins.pos : null), 3);

  // Drain big pools before anything they cover.
  const pool = find(BloodPool, (p) => p.ichor !== 'blood' || p.r > 28);
  if (pool) return hold('leech', alive(pool), 3);

  const emb = find(Embedded, (e) => !e.grabbed);
  if (emb) {
    if (emb.barbed && emb.nicks < 2 && !(ctx.sloppy && ctx.slip())) return tap('lancet', ctx.jitter({ x: emb.origin.x + 4, y: emb.origin.y + 4 }));
    if (!emb.calmed && has('brand')) return hold('brand', () => (emb.alive && !emb.calmed ? emb.pos : null), 0.8);
    return extract(ctx, emb);
  }
  const wad = find(Wadding);
  if (wad) return drag('tongs', [ctx.jitter(wad.pos), TRAY_DISH], 480, 0.1);

  const burn = find(Burn);
  if (burn) {
    if (burn.charCore) {
      const r = burn.radius * 0.4;
      return drag('lancet', [{ x: burn.pos.x - r, y: burn.pos.y }, { x: burn.pos.x + r, y: burn.pos.y }, { x: burn.pos.x - r, y: burn.pos.y + 6 }], 300);
    }
    if (burn.acidLive) {
      if (ctx.sloppy && ctx.slip()) return salveOr(ctx, () => drag('salve', raster(burn.pos, burn.radiusNow), 900));
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
    return drag('thread', zigzag([lac.a, lac.b], Math.max(1, lac.stitch.needed - lac.stitch.count) + 1), 380);
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
    const seg = sigil.segs.find((s) => s.stroke === cur && s.burned.some((b) => !b));
    if (seg) return drag('brand', [seg.a, seg.b], 300);
  }

  const rot = find(Rot);
  if (rot) return salveOr(ctx, () => drag('salve', raster(rot.pos, rot.r), 1100));

  const inc = find(Incision, (i) => i.state === 'mark' || i.state === 'closing');
  if (inc?.state === 'mark') return drag('lancet', [inc.pointAt(inc.progress), ...inc.points.filter((_, i) => i > 0)], 350);
  if (inc?.state === 'closing' && inc.stitch) return drag('thread', zigzag(inc.points, Math.max(1, inc.stitch.needed - inc.stitch.count) + 1), 380);

  // Anything left is hidden: sweep the lens over it.
  const hidden = ents.find((e) => e.hidden && !(e instanceof LaudsMalison));
  if (hidden && has('lens')) return hold('lens', () => (hidden.alive && hidden.hidden ? hidden.pos : null), 0.8);

  return null;
}

const KNOWN = [BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom, Wadding, ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub, Malison, MalisonShard, Reopened, SimpleBurn];
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
}

/** Idle frames at the current pointer (pointer up). */
function* pause(pos: Vec, tool: ToolId, seconds: number): Action {
  for (let t = 0; t < seconds; t += DT) yield { tool, pos, down: false };
}

/** Play an operation to completion (or failure) with the bot. */
export function playWithBot(def: OperationDef, opts: BotOptions = {}): BotResult {
  const maxSeconds = opts.maxSeconds ?? 900;
  const prof = opts.profile ? PROFILES[opts.profile] : null;
  const think = opts.think ?? prof?.think ?? 0;
  const op = new Operation(def, opts);
  const rng = new Rng(opts.botSeed ?? 7);
  let aimOff: Vec = { x: 0, y: 0 };
  const aim = prof?.aim ?? 0;
  const ctx: BotContext = {
    op,
    rng,
    aim,
    sloppy: prof?.sloppy ?? 0,
    farm: prof?.farm ?? 0,
    bossSeen: -1,
    expert: opts.profile === 'expert',
    jitter: (p) => ({ x: p.x + aimOff.x, y: p.y + aimOff.y }),
    slip: () => rng.next() < (prof?.sloppy ?? 0),
    has: (t) => op.def.tools.includes(t),
  };
  let prev: Vec = { x: FIELD.cx, y: FIELD.cy };
  let wasDown = false;
  let action: Action | null = null;
  let frames = 0;
  while ((op.status === 'intro' || op.status === 'running') && frames < maxSeconds * 60) {
    frames++;
    if (op.status === 'running') {
      let f = action?.next();
      if (!f || f.done) {
        // Finish the previous gesture cleanly before planning the next.
        if (wasDown) {
          op.handlePointer({ pos: prev, prev, down: false, pressed: false, released: true }, DT);
          wasDown = false;
        }
        const a = rng.range(0, Math.PI * 2);
        const r = aim * Math.sqrt(rng.next());
        aimOff = { x: Math.cos(a) * r, y: Math.sin(a) * r };
        const next = plan(ctx);
        action = next && think > 0 ? chain(pause(prev, op.tool, think), next) : next;
        f = action?.next();
      }
      if (f && !f.done) {
        const fr = f.value;
        op.setTool(fr.tool);
        const ptr: Pointer = { pos: fr.pos, prev, down: fr.down, pressed: fr.down && !wasDown, released: !fr.down && wasDown };
        op.handlePointer(ptr, DT);
        wasDown = fr.down;
        prev = fr.pos;
      }
    }
    op.update(DT);
    op.cues.length = 0;
    op.events.length = 0;
  }
  return { op, frames };
}
