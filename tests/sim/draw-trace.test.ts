/**
 * GAM-0012: the draw-call trace of every campaign operation, pinned. Moving the drawing out of the
 * simulation must not change a single call: every 15th frame of a steady bot's run, every live
 * entity draws (body, surface and fluid layers) into a recording Gfx, and the trace is hashed.
 * Re-record with UPDATE_GOLDEN=1 only for an intended change in drawing.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { allCampaignOperations } from '../../src/content/campaign';
import type { Entity } from '../../src/surgery/entity';
import type { Operation, OperationDef } from '../../src/surgery/operation';
import type { Gfx } from '../../src/render/gfx';
import { playWithBot } from '../bot';
import { recorder } from '../helpers/drawTrace';
import { at, DT, start } from '../harness';
import { X_OPS, xOpDef, loomOp } from '../../src/content/challenge';
import { LATER_X_BASES } from '../../src/content/challengeLater';
import { SHOWCASE, SHOWCASE_BOSS } from '../../src/content/dev';
import { TRIALS } from '../../src/content/trials';
import { AlchemicalAcid, CompoundPoison, GasPocket } from '../../src/surgery/ailments/alchemy';
import { Arrhythmia, CollapsedLung, LarynxFold, StomachLock, Trepanation, WaxClot } from '../../src/surgery/ailments/organs';
import { ChoirMagus, DeadPulse, FrostWight, GhoulClaw, Sellsword, WormMatriarch } from '../../src/surgery/bosses/alphaElites';
import { DonorBowl } from '../../src/surgery/ailments/vampire';
import { DressedBud } from '../../src/surgery/ailments/kilnrows';
import { DungZone, InfectionLine, SporeCrust } from '../../src/surgery/ailments/infection';
import { Gangrene } from '../../src/surgery/ailments/gangrene';
import { GlassCluster, WoodSplinter } from '../../src/surgery/ailments/splinters';
import { Larvae, TickNest } from '../../src/surgery/ailments/parasites';
import { MalisonAsh } from '../../src/surgery/malison';
import { MutationBud } from '../../src/surgery/ailments/growth';
import { Petrification } from '../../src/surgery/ailments/petrification';
import { Remnant } from '../../src/surgery/ailments/hollownight';
import { Reopened, SimpleBurn } from '../../src/surgery/operation';
import { Spill, Ulcer } from '../../src/surgery/ailments/ulcer';
import { TunnelScar } from '../../src/surgery/bosses/none';

const GOLDEN = 'tests/golden/draw-trace.json';

/** The three layers an entity draws into (one place to change when the drawing moves). */
function drawLayers(g: Gfx, e: Entity, op: Operation): void {
  e.drawSurface(g, op);
  e.drawFluid(g, op);
  e.draw(g, op);
}

const group = (x: Entity): Entity[] => (x as Entity & { all?: Entity[] }).all ?? [x];

/** Entities only hand-built content reaches (trials, challenges, dev): each drawn on its own for 4 s. */
const ZOO: Record<string, (op: Operation) => Entity[]> = {
  AlchemicalAcid: () => [new AlchemicalAcid(at(0, 0))],
  CompoundPoison: (op) => [new CompoundPoison(at(0, 0), op)],
  GasPocket: () => [new GasPocket(at(0, 0))],
  Arrhythmia: () => [new Arrhythmia(at(0, 0))],
  CollapsedLung: () => [new CollapsedLung(at(0, 0))],
  LarynxFold: () => [new LarynxFold(at(0, 0), 0.4)],
  StomachLock: (op) => [new StomachLock(at(0, 0), op)],
  Trepanation: () => [new Trepanation(at(0, 0))],
  WaxClot: () => [new WaxClot(at(0, 0))],
  ChoirMagus: (op) => group(new ChoirMagus(at(0, 0), op)),
  DeadPulse: (op) => group(new DeadPulse(op, [at(-120, 0), at(0, 40), at(120, 0)], at(0, -60))),
  FrostWight: (op) => group(new FrostWight(at(0, 0), op)),
  GhoulClaw: (op) => group(new GhoulClaw(at(0, 0), op, at(-80, -60))),
  Sellsword: (op) => group(new Sellsword(op, [at(-100, 0), at(0, 50), at(100, 0)])),
  WormMatriarch: (op) => group(new WormMatriarch(at(0, 0), op)),
  DonorBowl: () => [new DonorBowl()],
  DressedBud: () => [new DressedBud(at(0, 0))],
  DungZone: () => [new DungZone(at(0, 0))],
  InfectionLine: () => [new InfectionLine([at(-120, 0), at(0, 30), at(120, 0)])],
  SporeCrust: () => [new SporeCrust(at(0, 0))],
  Gangrene: () => [new Gangrene(at(-150, 0), at(150, 0))],
  GlassCluster: (op) => [new GlassCluster(at(0, 0), op)],
  WoodSplinter: () => [new WoodSplinter(at(0, 0), 0.6)],
  Larvae: () => [new Larvae(at(0, 0))],
  TickNest: () => [new TickNest(at(0, 0))],
  MalisonAsh: () => [new MalisonAsh(at(0, 0), 40, 1)],
  MutationBud: () => [new MutationBud(at(0, 0))],
  Petrification: (op) => [new Petrification(at(-60, 0), op, at(80, 20))],
  Remnant: () => [new Remnant(at(0, 0))],
  Reopened: () => [new Reopened(at(0, 0), 0.3, 80)],
  SimpleBurn: () => [new SimpleBurn(at(0, 0))],
  Spill: () => [new Spill(at(0, 0))],
  Ulcer: () => [new Ulcer(at(0, 0))],
  TunnelScar: () => [new TunnelScar(at(0, 0), 0.5)],
};

/** Operations beyond the campaign: the challenge bases, the Loom, the dev showcases and the trials. */
const extraOps = (): OperationDef[] => [
  ...X_OPS.flatMap((x) => (x.base ? [xOpDef(x)] : [])),
  ...Object.values(LATER_X_BASES),
  SHOWCASE,
  SHOWCASE_BOSS,
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({ ...loomOp(s), id: `loom-${s}` })),
  ...TRIALS.flatMap((t) => {
    const d = typeof t.op === 'function' ? t.op(true) : null;
    return d ? [{ ...d, id: `trial-${t.id}` }] : [];
  }),
];

it('every campaign operation draws exactly as recorded', { timeout: 600_000 }, () => {
  const out: Record<string, string> = {};
  for (const [name, make] of Object.entries(ZOO)) {
    const { g, log } = recorder();
    const op = start((o) => make(o));
    const zoo = new Set(op.entities);
    for (let frame = 0; frame < 240; frame++) {
      op.update(DT);
      if (frame % 15) continue;
      for (const e of op.entities) {
        if (!e.alive || !zoo.has(e)) continue;
        log.push(`# ${e.constructor.name}`);
        drawLayers(g, e, op);
      }
    }
    out[`zoo:${name}`] = `${log.length}:${createHash('sha1').update(log.join('\n')).digest('hex').slice(0, 16)}`;
  }
  for (const def of [...allCampaignOperations(), ...extraOps()]) {
    const { g, log } = recorder();
    let frame = 0;
    try {
      playWithBot(def, {
        profile: 'steady',
        seed: def.seed ?? 1,
        botSeed: 1,
        onFrame: (op) => {
          if (frame++ % 15) return;
          for (const e of op.entities) {
            if (!e.alive) continue;
            log.push(`# ${e.constructor.name}`);
            drawLayers(g, e, op);
          }
        },
      });
    } catch (err) {
      // The bot has no plan for some trial kinds: the trace simply ends where it gave up.
      log.push(`! ${String(err).slice(0, 60)}`);
    }
    out[def.id] = `${log.length}:${createHash('sha1').update(log.join('\n')).digest('hex').slice(0, 16)}`;
  }
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(out, null, 1) + '\n');
  expect(out).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
});
