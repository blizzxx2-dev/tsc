/**
 * QAT-0072: simulation micro-benchmarks, tracked nightly (scripts/qa/bench-compare.mjs opens an
 * issue on a > 20 % regression). `npm run bench` runs them locally.
 */
import { bench, describe } from 'vitest';
import { at } from '../../src/content/chapter1';
import { BloodPool, Bubo, Burn, Embedded, Grub, Laceration, Rot, Sigil, SIGILS, Venom } from '../../src/surgery/entities';
import type { Entity } from '../../src/surgery/entity';
import { EggSac, LaudsMalison, SpiderlingGrub } from '../../src/surgery/lauds';
import { Operation } from '../../src/surgery/operation';
import { defWith, drag, DT, press, start } from '../helpers/sim';

/** 150 live entities of every kind spread over the field (no-drain op so nothing dies mid-bench). */
function crowded(): Operation {
  const op = start(
    new Operation(
      defWith((o) => {
        const es: Entity[] = [];
        const makers: ((x: number, y: number) => Entity)[] = [
          (x, y) => new Laceration(at(x, y), 0.4, 60, 0),
          (x, y) => new BloodPool(at(x, y), 20),
          (x, y) => new Embedded(at(x, y), 'shot'),
          (x, y) => new Burn(at(x, y), 30, o),
          (x, y) => {
            const b = new Bubo(at(x, y), 18, 40);
            b.lanced = true; // lanced buboes stay put
            return b;
          },
          (x, y) => new Rot(at(x, y), 30, 0.3),
          (x, y) => new Venom(at(x, y), o, 0),
          (x, y) => new Grub(at(x, y), o, 30),
          (x, y) => new SpiderlingGrub(at(x, y), o),
          (x, y) => new Sigil(at(x, y), SIGILS.eye, 30, 1e9),
          (x, y) => new EggSac(at(x, y), 2, 1e9),
        ];
        for (let i = 0; es.length < 146; i++) {
          const x = -360 + (i % 15) * 50;
          const y = -200 + Math.floor(i / 15) * 45;
          es.push(makers[i % makers.length](x, y));
        }
        es.push(new LaudsMalison(at(0, 0), o)); // + 4 Voices = 151 with the core
        return es;
      }),
    ),
  );
  op.vitals = 99;
  return op;
}

/** Rebuild the crowd every simulated minute so hymn-spawned wounds don't grow the entity count. */
const REBUILD = 3600;

describe('simulation', () => {
  let op = crowded();
  let n = 0;
  let t = 0;
  bench(
    'Operation.update with 150 live entities',
    () => {
      if (++n % REBUILD === 0) op = crowded();
      op.vitals = 99;
      op.timeLeft = 999;
      op.update(DT);
    },
    { time: 1000 },
  );

  let op2 = crowded();
  let n2 = 0;
  bench(
    'handlePointer (brand sweep) + update with 150 live entities',
    () => {
      if (++n2 % REBUILD === 0) op2 = crowded();
      op2.vitals = 99;
      op2.timeLeft = 999;
      op2.setTool('brand');
      const p = at(Math.sin(t) * 300, Math.cos(t * 0.7) * 180);
      t += 0.05;
      op2.handlePointer(t < 0.06 ? press(p) : drag(p, p), DT);
      op2.update(DT);
    },
    { time: 1000 },
  );
});
