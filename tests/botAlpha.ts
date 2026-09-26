/** Bot plans for the Alpha ailments (src/surgery/ailments/*). */
import { dist, type Vec } from '../src/core/math';

import type { Entity } from '../src/surgery/entity';
import { circlePath } from '../src/surgery/gesture';
import { FIELD, TRAY_DISH } from '../src/surgery/operation';
import type { TinctureColor } from '../src/surgery/progress';
import type { ToolId } from '../src/surgery/types';
import { AlchemicalAcid, CompoundPoison, GasPocket } from '../src/surgery/ailments/alchemy';
import { BoneSplinter, Fracture, FRACTURE, Splint, SplintWrap } from '../src/surgery/ailments/fracture';
import { FrostPatch, IceCrystal } from '../src/surgery/ailments/frost';
import { Amputation, Gangrene } from '../src/surgery/ailments/gangrene';
import { Growth, GROWTH, MutationBud } from '../src/surgery/ailments/growth';
import { DungZone, InfectionLine, INFECTION, SporeCrust } from '../src/surgery/ailments/infection';
import { Arrhythmia, Artery, CollapsedLung, humming, LarynxFold, ORGAN, StomachLock, Trepanation, WaxClot } from '../src/surgery/ailments/organs';
import { GutWorm, Larvae, Tick, TickNest } from '../src/surgery/ailments/parasites';
import { Petrification, STONE } from '../src/surgery/ailments/petrification';
import { RegenWound, REGEN } from '../src/surgery/ailments/regen';
import { GlassCluster, WoodSplinter } from '../src/surgery/ailments/splinters';
import { Spill, Ulcer, ULCER } from '../src/surgery/ailments/ulcer';
import { BiteChannel, DonorBowl } from '../src/surgery/ailments/vampire';
import { MudSmear, RainDrips } from '../src/surgery/ailments/environment';
import { WebSilk } from '../src/surgery/ailments/silk';
import { GraveDirt } from '../src/surgery/ailments/graveDirt';
import { Embedded, Incision, SearedWord } from '../src/surgery/entities';
import { DT, drag, hold, raster, still, tap, zigzag, type Action, type BotContext, type Frame } from './bot';

const ALPHA = [
  WebSilk,
  GraveDirt,
  // A pinned bone's splint: presentation only, nothing to do.
  Splint,
  AlchemicalAcid,
  CompoundPoison,
  GasPocket,
  BoneSplinter,
  Fracture,
  SplintWrap,
  MudSmear,
  SearedWord,
  FrostPatch,
  IceCrystal,
  Amputation,
  Gangrene,
  Growth,
  MutationBud,
  DungZone,
  InfectionLine,
  SporeCrust,
  Arrhythmia,
  Artery,
  CollapsedLung,
  LarynxFold,
  StomachLock,
  Trepanation,
  WaxClot,
  GutWorm,
  Larvae,
  Tick,
  TickNest,
  Petrification,
  RegenWound,
  GlassCluster,
  WoodSplinter,
  Spill,
  Ulcer,
  BiteChannel,
  DonorBowl,
  RainDrips,
];

export function isAlphaEntity(e: Entity): boolean {
  return ALPHA.some((k) => e instanceof k);
}

/** Idle (button up) until a condition holds, then run the action. */
function* waitThen(cond: () => boolean, then: () => Action, maxS = 10): Action {
  for (let t = 0; t < maxS && !cond(); t += DT) yield { tool: 'lancet', pos: { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 60 }, down: false };
  yield* then();
}

/** Press, then run frames with the button held (no release) — for wheel turning. */
function* turn(tool: ToolId, at: Vec, notches: number): Action {
  yield { tool, pos: at, down: true };
  const dir = Math.sign(notches);
  for (let i = 0; i < Math.abs(notches); i++) yield { tool, pos: at, down: true, wheel: dir };
  yield { tool, pos: at, down: false };
}

function* dragTurn(tool: ToolId, from: Vec, to: Vec, notches: number, speed = 300): Action {
  const n = Math.max(1, Math.ceil(dist(from, to) / (speed * DT)));
  yield { tool, pos: from, down: true };
  for (let k = 1; k <= n; k++) yield { tool, pos: { x: from.x + ((to.x - from.x) * k) / n, y: from.y + ((to.y - from.y) * k) / n }, down: true };
  const dir = Math.sign(notches);
  for (let i = 0; i < Math.abs(notches); i++) yield { tool, pos: to, down: true, wheel: dir };
  yield { tool, pos: to, down: false };
}

function* taps(tool: ToolId, at: Vec, n: number): Action {
  for (let i = 0; i < n; i++) {
    yield { tool, pos: at, down: true };
    yield { tool, pos: at, down: false };
    for (let k = 0; k < 6; k++) yield { tool, pos: at, down: false };
  }
}

function* withTincture(c: TinctureColor, a: Action): Action {
  let first = true;
  for (const f of a) {
    yield (first ? { ...f, tincture: c } : f) as Frame;
    first = false;
  }
}

/** Back-and-forth saw strokes along a line, each taking ~0.45 s. */
function saw(a: Vec, b: Vec, strokes: number): Action {
  const pts: Vec[] = [];
  for (let i = 0; i <= strokes; i++) pts.push(i % 2 ? b : a);
  return drag('lancet', pts, dist(a, b) / 0.45);
}

export function botPlanAlpha(ctx: BotContext): Action | null {
  const op = ctx.op;
  const vis = op.entities.filter((e) => e.alive && !e.hidden);
  const find = <T extends Entity>(cls: new (...a: never[]) => T, pred: (e: T) => boolean = () => true) =>
    vis.find((e): e is T => e instanceof cls && pred(e as T));
  const has = ctx.has;

  // A swallowed token (CON-0069): open the incision before reaching for it.
  const token = find(Embedded, (e) => e.kind === 'token' && !e.reachable(op));
  const cut = token && vis.find((e): e is Incision => e instanceof Incision && e.state === 'mark');
  if (cut) return drag('lancet', [cut.pointAt(cut.progress), ...cut.points.slice(1)], 350);

  // Grave-dirt: leech it out before anything touches the wound (CON-0058).
  const dirt = find(GraveDirt, (d) => d.sealed < 0);
  if (dirt && has('leech')) return hold('leech', () => (dirt.alive ? dirt.pos : null), 1.6);

  // Brood silk: one lancet stroke across the middle of each strand.
  const silk = find(WebSilk);
  if (silk) {
    const st = silk.strands.find((x) => x.cutAt < 0);
    if (st) {
      const m = { x: (st.a.x + st.b.x) / 2, y: (st.a.y + st.b.y) / 2 };
      const dx = st.b.x - st.a.x;
      const dy = st.b.y - st.a.y;
      const l = Math.hypot(dx, dy) || 1;
      const n = { x: (-dy / l) * 24, y: (dx / l) * 24 };
      return drag(
        'lancet',
        [
          { x: m.x - n.x, y: m.y - n.y },
          { x: m.x + n.x, y: m.y + n.y },
        ],
        300,
      );
    }
  }
  const artery = find(Artery, (a) => !a.clamped);
  if (artery) return still('tongs', artery.pos, 0.7);

  const bite = find(BiteChannel);
  if (bite) {
    const i = bite.seared.findIndex((s) => s < 0.8);
    if (i >= 0) return hold('brand', () => (bite.alive ? bite.punctures[i] : null), 1);
  }
  const bowl = find(DonorBowl, (b) => b.volume > 0);
  if (bowl && op.bloodVolume < 60) {
    if (!op.leechReverse) op.toggleLeechReverse();
    return hold('leech', () => (bowl.volume > 0 && op.bloodVolume < 99 ? bowl.pos : null), 3);
  }
  if (op.leechReverse && !find(DungZone)) op.toggleLeechReverse();

  const poison = find(CompoundPoison, (p) => p.motes.length > 0);
  if (poison && has('tincture')) {
    const m = poison.motes[0];
    return withTincture(m.colour, tap('tincture', poison.motePos(m)));
  }

  const acid = find(AlchemicalAcid);
  if (acid) {
    if (!acid.neutralised)
      return withTincture(
        'amber',
        hold('tincture', () => (acid.alive && !acid.neutralised ? acid.pos : null), 0.9),
      );
    return hold('leech', () => (acid.alive ? acid.pos : null), 1.3);
  }

  const gas = find(GasPocket);
  if (gas) return gas.vented ? tap('lancet', gas.pos) : hold('leech', () => (gas.alive && !gas.vented ? gas.pos : null), 1.2);

  const line = find(InfectionLine);
  const node = line?.nextNode;
  if (line && node) {
    const p = line.nodePos(node);
    if (node.leeched < INFECTION.nodeLeech) return hold('leech', () => (line.alive && node.leeched < INFECTION.nodeLeech ? p : null), 0.8);
    return hold('tincture', () => (line.alive && !node.treated ? p : null), 0.9);
  }

  const lung = find(CollapsedLung);
  if (lung) return lung.drawn ? drag('thread', zigzag([lung.a, lung.b], 4, 20), 300) : hold('leech', () => (lung.alive && !lung.drawn ? lung.pos : null), 1.7);

  const frost = find(FrostPatch, (f) => f.frozen);
  if (frost) return taps('brand', frost.pos, Math.ceil((1 - frost.thaw) / 0.2));
  const ice = find(IceCrystal);
  if (ice) return hold('leech', () => (ice.alive ? ice.pos : null), 1.2);

  const stone = find(Petrification);
  if (stone) {
    const lifted = stone.plates.find((p) => p.lifted && !p.healed);
    if (lifted) return drag('salve', raster(lifted.center, STONE.plateR), 900);
    const plate = stone.plates.find((p) => !p.lifted);
    if (plate) return tap('lancet', plate.nodes[plate.chipped]);
  }

  const frac = find(Fracture);
  if (frac) {
    if (frac.roughlyAligned) return tap('lancet', frac.pins[frac.pinned]);
    const f = frac.fragments.find((x) => !x.set)!;
    let d = f.targetRot - f.rot;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const notches = Math.round((d * 180) / Math.PI / FRACTURE.wheelDeg);
    return dragTurn('tongs', f.pos, f.target, notches);
  }

  const growth = find(Growth);
  if (growth) {
    const v = growth.vessels.find((x) => !x.tied);
    if (v) {
      const mid = { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 };
      const a = Math.atan2(v.b.y - v.a.y, v.b.x - v.a.x) + Math.PI / 2;
      return drag(
        'thread',
        [
          { x: mid.x - Math.cos(a) * 20, y: mid.y - Math.sin(a) * 20 },
          { x: mid.x + Math.cos(a) * 20, y: mid.y + Math.sin(a) * 20 },
        ],
        250,
      );
    }
    // Simplified gestures: tap-and-hold on the rim excises (GAM-0238).
    if (!growth.excised && ctx.op.assists.simpleGestures)
      return hold('lancet', () => (growth.alive && !growth.excised ? { x: growth.pos.x + growth.r + 12, y: growth.pos.y } : null), 1.3);
    if (!growth.excised) return drag('lancet', circlePath(growth.pos, growth.r + 12, 40), 400);
    return drag('tongs', [growth.pos, TRAY_DISH], 450, 0.1);
  }
  const bud = find(MutationBud);
  if (bud) return bud.looped ? hold('brand', () => (bud.alive ? bud.pos : null), 0.8) : drag('lancet', circlePath(bud.pos, GROWTH.budR + 12, 32), 350);

  const glass = find(GlassCluster);
  if (glass) {
    const seen = glass.left.filter((s) => s.seen);
    if (!seen.length) return drag('lens', circlePath(glass.pos, 26, 24), 120);
    const route: Vec[] = [seen[0].pos];
    for (const s of seen.slice(1, 3)) route.push(s.pos);
    route.push(TRAY_DISH);
    return drag('tongs', route, 250, 0.05);
  }
  const wood = find(WoodSplinter);
  if (wood) return drag('tongs', [wood.pos, { x: wood.pos.x + Math.cos(wood.grain) * 30, y: wood.pos.y + Math.sin(wood.grain) * 30 }, TRAY_DISH], 350, 0.05);

  const spill = find(Spill);
  if (spill) return hold('leech', () => (spill.alive ? spill.pos : null), 1.2);
  const ulcer = find(Ulcer);
  if (
    ulcer &&
    !op.entities.some(
      (e) =>
        e.alive && e.constructor.name === 'BloodPool' && (e as unknown as { ichor: string }).ichor === 'blackbile' && dist(e.pos, ulcer.pos) < ulcer.radius,
    )
  ) {
    const r = ulcer.radius - ulcer.healed * ULCER.ringW - ULCER.ringW / 2;
    return drag('salve', circlePath(ulcer.pos, r, 40), 400);
  }

  const regen = find(RegenWound);
  if (regen) {
    if (!regen.open)
      return drag(
        'lancet',
        [
          { x: regen.pos.x - 28, y: regen.pos.y },
          { x: regen.pos.x + 28, y: regen.pos.y },
        ],
        300,
      );
    if (!regen.sealed) return drag('brand', circlePath(regen.pos, REGEN.rimR, 36), 700);
  }

  const gang = find(Gangrene);
  if (gang) {
    if (!gang.debrided) return drag('lancet', [gang.tip, gang.frontPos, gang.tip, gang.frontPos], 400);
    const cov = (gang as unknown as { cov: { center: Vec; radius: number } | null }).cov;
    if (cov) return drag('salve', raster(cov.center, cov.radius), 900);
  }
  const amp = find(Amputation);
  if (amp) {
    if (!amp.sawn) return saw(amp.sawA, amp.sawB, 9);
    return drag('thread', zigzag([amp.sawA, amp.sawB], 3, 22), 250);
  }

  const worm = find(GutWorm, (w) => !w.headless);
  if (worm) return drag('tongs', [worm.pos, { x: worm.pos.x, y: worm.pos.y - 160 }, TRAY_DISH], 180, 0.05);
  const tick = find(Tick);
  if (tick) return tap('tongs', tick.pos);

  const trep = find(Trepanation);
  if (trep) {
    if (!trep.loose) {
      const r = (ORGAN.drillInner + ORGAN.drillOuter) / 2;
      const pts: Vec[] = [];
      for (let k = 0; k < 4; k++) pts.push(...circlePath(trep.pos, r, 32).slice(k ? 1 : 0));
      return drag('lancet', pts, 160);
    }
    return drag('tongs', [trep.pos, TRAY_DISH], 400, 0.05);
  }

  const fold = find(LarynxFold);
  if (fold) {
    const inGap = () => !humming(op) && (op.elapsed % (ORGAN.verse + ORGAN.silence)) - ORGAN.verse < ORGAN.silence - 0.5;
    return waitThen(inGap, () => drag('lancet', [fold.a, fold.b, fold.a], 500));
  }

  const lock = find(StomachLock);
  if (lock) {
    const t = lock.tumblers.find((x) => !x.locked)!;
    const off = ((t.target - t.angle + 540) % 360) - 180;
    return turn('tongs', t.pos, Math.round(off / ORGAN.tumblerStep));
  }

  const wax = find(WaxClot);
  if (wax) return wax.soft ? hold('leech', () => (wax.alive ? wax.pos : null), 1.2) : taps('brand', wax.pos, 3);

  const spore = find(SporeCrust);
  if (spore) return drag('lancet', circlePath(spore.pos, INFECTION.crustR + 14, 36), 350);

  const dung = find(DungZone);
  if (dung) {
    if (!op.leechReverse) op.toggleLeechReverse();
    return hold('leech', () => (dung.alive ? dung.pos : null), 1.8);
  }

  // The antiparasitic finish: once the rest is done, a green dose for the unseen larvae.
  const larvae = op.entities.some((e) => e.alive && e instanceof Larvae);
  const busy = op.entities.some((e) => e.alive && e.required && !e.hidden);
  if (larvae && !busy && has('tincture') && op.tinctures.includes('green') && op.injectCooldown === 0)
    return withTincture(
      'green',
      hold('tincture', () => ({ x: FIELD.cx + 330, y: FIELD.cy + 20 }), 0.8),
    );

  return null;
}
