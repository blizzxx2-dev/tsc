/**
 * Bot counterplay for Chapters III–V: the six remaining Hours, the Office and
 * the new ailments. Called from `plan()` in bot.ts; returns null to fall back
 * to the generic planner (lacerations, pools, burns, incisions…).
 */
import { dist, type Vec } from '../src/core/math';
import type { Entity } from '../src/surgery/entity';
import { FIELD, type Operation } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';
import { InkBlot, NameSigil, PrimeMalison } from '../src/surgery/bosses/prime';
import { FlameTongue, TerceMalison } from '../src/surgery/bosses/terce';
import { CrustPlate, SextMalison, SunDial } from '../src/surgery/bosses/sext';
import { currentLag } from '../src/surgery/bosses/common';
import { BurrowSegment, NoneMalison } from '../src/surgery/bosses/none';
import { TallowClot, VespersMalison, WickFilament } from '../src/surgery/bosses/vespers';
import { ComplineMalison, SilenceNode } from '../src/surgery/bosses/compline';

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
    return k.drag('lancet', [{ x: wick.pos.x + (n.x / l) * 14, y: wick.pos.y + (n.y / l) * 14 }, { x: wick.pos.x - (n.x / l) * 24, y: wick.pos.y - (n.y / l) * 24 }], 300);
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
          ? k.chain(k.tap('lancet', comp.pos), k.pause(comp.pos, 'lancet', lag > 0 ? lag + 0.05 : 0), k.hold('brand', () => (comp.alive ? comp.pos : null), 0.25 + lag))
          : null,
      );
    }
  }

  void dist;
  return null;
}
