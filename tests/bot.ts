/**
 * A scripted "bot surgeon" that plays an operation through the same pointer API
 * the game uses. It is deliberately competent but not superhuman in timing, and
 * is used to prove every operation is completable and to calibrate rank thresholds.
 */
import type { Vec } from '../src/core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, SALVE_MAX, Sigil, Venom } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../src/surgery/lauds';
import { Malison, MalisonShard } from '../src/surgery/malison';
import { FIELD, Operation, type OperationDef } from '../src/surgery/operation';
import type { Pointer, ToolId } from '../src/surgery/types';
import { DT, pointerFrame, raster, release, samplePath, zigzagAlong as zigzag } from './helpers/sim';

interface Frame {
  tool: ToolId;
  pos: Vec;
  down: boolean;
}

type Action = Generator<Frame, void, void>;

function* hold(tool: ToolId, target: () => Vec | null, seconds: number): Action {
  for (let t = 0; t < seconds; t += DT) {
    const p = target();
    if (!p) return;
    yield { tool, pos: p, down: true };
  }
}

function* chain(...as: Action[]): Action {
  for (const a of as) yield* a;
}

function* tap(tool: ToolId, p: Vec): Action {
  yield { tool, pos: p, down: true };
  yield { tool, pos: p, down: false };
}

/** Grab a moving target where it is *now*, then drag it to a destination. */
function* grabTo(tool: ToolId, target: () => Vec | null, dest: Vec, speed = 600): Action {
  const start = target();
  if (!start) return;
  yield* drag(tool, [start, dest], speed);
}

/** Drag along a polyline at a human-ish speed. */
function* drag(tool: ToolId, pts: Vec[], speed = 420): Action {
  const path = samplePath(pts, speed);
  for (const pos of path) yield { tool, pos, down: true };
  yield { tool, pos: pts[pts.length - 1], down: false };
}

const OFF_BODY: Vec = { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 60 };
const alive = (e: Entity) => () => (e.alive && !e.hidden ? e.pos : null);

function plan(op: Operation, invokeLitany: () => void): Action | null {
  const ents = op.entities.filter((e) => e.alive);
  const vis = ents.filter((e) => !e.hidden);
  const has = (t: ToolId) => op.def.tools.includes(t);
  const find = <T extends Entity>(cls: new (...a: never[]) => T, pred: (e: T) => boolean = () => true) =>
    vis.find((e): e is T => e instanceof cls && pred(e as T));

  if (op.vitals < 40 && op.injectCooldown === 0 && has('tincture')) return hold('tincture', () => ({ x: FIELD.cx + 330, y: FIELD.cy + 20 }), 0.8);

  const venom = find(Venom);
  if (venom) return hold('tincture', alive(venom), 1.0);

  const sac = find(EggSac);
  if (sac) return tap('lancet', sac.pos);

  const bubo = find(Bubo, (b) => !b.lanced);
  if (bubo) return tap('lancet', bubo.pos);

  // A player invokes the Litany when a Malison shows itself.
  if (op.canInvokeLitany() && vis.some((e) => e instanceof Malison || e instanceof LaudsMalison)) invokeLitany();

  const shard = find(MalisonShard);
  if (shard) return grabTo('tongs', alive(shard), OFF_BODY);

  for (const cls of [SpiderlingGrub, Grub] as const) {
    const g = find(cls as new (...a: never[]) => Entity);
    if (g) return hold('brand', alive(g), 2);
  }

  const voice = find(ChoirVoice);
  if (voice) return hold('brand', alive(voice), 2);
  const lauds = ents.find((e): e is LaudsMalison => e instanceof LaudsMalison);
  if (lauds?.submerged) return hold('lens', () => (lauds.alive && lauds.submerged ? lauds.pos : null), 1.5);
  if (lauds && lauds.livingVoices.length === 0) return hold('brand', () => (lauds.alive && !lauds.submerged && lauds.livingVoices.length === 0 ? lauds.pos : null), 5);

  const matins = find(Malison, (m) => m.open);
  if (matins) return hold('brand', () => (matins.alive && matins.open ? matins.pos : null), 3);

  // Drain big pools before anything they cover.
  const pool = find(BloodPool, (p) => p.ichor !== 'blood' || p.r > 28);
  if (pool) return hold('leech', alive(pool), 3);

  const emb = find(Embedded, (e) => !e.grabbed);
  if (emb) {
    if (emb.barbed && emb.nicks < 2) return tap('lancet', { x: emb.origin.x + 4, y: emb.origin.y + 4 });
    const grip = emb.spec.len > 0 ? { x: emb.origin.x + (emb.handle.x - emb.origin.x) * 0.7, y: emb.origin.y + (emb.handle.y - emb.origin.y) * 0.7 } : emb.pos;
    const dir = emb.spec.len > 0 ? { x: emb.handle.x - emb.origin.x, y: emb.handle.y - emb.origin.y } : { x: 0, y: -1 };
    const l = Math.hypot(dir.x, dir.y) || 1;
    return drag('tongs', [grip, { x: grip.x + (dir.x / l) * 110, y: grip.y + (dir.y / l) * 110 }], 500);
  }

  const burn = find(Burn);
  if (burn) {
    if (burn.flakes.length) return tap('tongs', burn.flakes[0]);
    return drag('salve', raster(burn.pos, burn.radius), 900);
  }

  const lac = find(Laceration);
  if (lac) {
    if (lac.length <= SALVE_MAX && has('salve')) return drag('salve', raster(lac.pos, lac.length / 2 + 6), 900);
    return drag('thread', zigzag([lac.a, lac.b], lac.stitch.needed - lac.stitch.count + 1), 380);
  }

  const lanced = find(Bubo, (b) => b.lanced);
  if (lanced) return drag('salve', raster(lanced.cov.center, lanced.cov.radius), 900);

  const sigil = find(Sigil);
  if (sigil) {
    const seg = sigil.segs.find((s) => s.burned.some((b) => !b));
    if (seg) return drag('brand', [seg.a, seg.b], 300);
  }

  const rot = find(Rot);
  if (rot) return drag('salve', raster(rot.pos, rot.r), 1100);

  const inc = find(Incision, (i) => i.state === 'mark' || i.state === 'closing');
  if (inc?.state === 'mark') return drag('lancet', [inc.pointAt(inc.progress), ...inc.points.filter((_, i) => i > 0)], 350);
  if (inc?.state === 'closing' && inc.stitch) return drag('thread', zigzag(inc.points, inc.stitch.needed - inc.stitch.count + 1), 380);

  // Anything left is hidden: sweep the lens over it.
  const hidden = ents.find((e) => e.hidden && !(e instanceof LaudsMalison));
  if (hidden && has('lens')) return hold('lens', () => (hidden.alive && hidden.hidden ? hidden.pos : null), 0.8);

  return null;
}

export interface BotResult {
  op: Operation;
  frames: number;
}

export interface BotOptions {
  /** Seconds of "look, pick tool, aim" before each gesture — models human pacing. */
  think?: number;
  maxSeconds?: number;
  /**
   * Emit the release that ends a gesture on its own frame and plan the next gesture on the
   * following frame. Real mouse input can deliver only one button transition per frame, so the
   * E2E mirror uses this; the headless suites keep the default (release + next press in one frame).
   */
  splitRelease?: boolean;
}

/** Idle frames at the current pointer (pointer up). */
function* pause(pos: Vec, tool: ToolId, seconds: number): Action {
  for (let t = 0; t < seconds; t += DT) yield { tool, pos, down: false };
}

/** One input event the bot wants applied this frame, in order. */
export type BotEvent = { kind: 'pointer'; tool: ToolId; ptr: Pointer; select: boolean } | { kind: 'litany' };

/**
 * Frame-by-frame bot surgeon. Call `tick(op)` once per frame while the operation is running and
 * apply the returned events in order (`select` pointer events call `setTool` first), then `op.update`.
 */
export class BotDriver {
  prev: Vec = { x: FIELD.cx, y: FIELD.cy };
  wasDown = false;
  private action: Action | null = null;

  constructor(private opts: BotOptions = {}) {}

  tick(op: Operation): BotEvent[] {
    const out: BotEvent[] = [];
    const think = this.opts.think ?? 0;
    let f = this.action?.next();
    if (!f || f.done) {
      // Finish the previous gesture cleanly before planning the next.
      if (this.wasDown) {
        out.push({ kind: 'pointer', tool: op.tool, ptr: release(this.prev), select: false });
        this.wasDown = false;
        if (this.opts.splitRelease) {
          this.action = null;
          return out;
        }
      }
      const next = plan(op, () => out.push({ kind: 'litany' }));
      this.action = next && think > 0 ? chain(pause(this.prev, op.tool, think), next) : next;
      f = this.action?.next();
    }
    if (f && !f.done) {
      const fr = f.value;
      out.push({ kind: 'pointer', tool: fr.tool, ptr: pointerFrame(fr.pos, this.prev, fr.down, this.wasDown), select: true });
      this.wasDown = fr.down;
      this.prev = fr.pos;
    }
    return out;
  }
}

/** Apply bot events straight to the simulation (the headless equivalent of the operation scene). */
export function applyBotEvents(op: Operation, events: BotEvent[]): void {
  for (const ev of events) {
    if (ev.kind === 'litany') op.invokeLitany();
    else {
      if (ev.select) op.setTool(ev.tool);
      op.handlePointer(ev.ptr, DT);
    }
  }
}

/** Play an operation to completion (or failure) with the bot. */
export function playWithBot(def: OperationDef, opts: BotOptions = {}): BotResult {
  const maxSeconds = opts.maxSeconds ?? 900;
  const op = new Operation(def);
  const bot = new BotDriver(opts);
  let frames = 0;
  while ((op.status === 'intro' || op.status === 'running') && frames < maxSeconds * 60) {
    frames++;
    if (op.status === 'running') applyBotEvents(op, bot.tick(op));
    op.update(DT);
    op.cues.length = 0;
  }
  return { op, frames };
}
