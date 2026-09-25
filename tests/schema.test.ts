import { SPECIES } from '../src/surgery/species';
import { describe, expect, it } from 'vitest';
import { allCampaignOperations, FULL_CAMPAIGN } from '../src/content/campaign';
import { ENTITY_REGISTRY, makeEntity, opData, spawnAll, validateOp, validateSpec, type EntitySpec, type OperationData } from '../src/content/schema';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom } from '../src/surgery/entities';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../src/surgery/lauds';
import { Malison, MalisonShard } from '../src/surgery/malison';
import { Operation, type OperationDef } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';
import { playWithBot } from './bot';
import { ALL, start } from './harness';

const demoOps = FULL_CAMPAIGN.slice(0, 2).flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
const dataOf = (def: OperationDef): OperationData => {
  const d = opData(def);
  if (!d) throw new Error(`${def.id} is not a data op`);
  return d;
};

describe('entity registry (CON-0002)', () => {
  const samples: [EntitySpec, new (...a: never[]) => unknown][] = [
    [{ e: 'laceration', at: [0, 0], angle: 0, len: 60 }, Laceration],
    [
      {
        e: 'incision',
        path: [
          [-50, 0],
          [50, 0],
        ],
      },
      Incision,
    ],
    [{ e: 'embedded', at: [0, 0], kind: 'arrow' }, Embedded],
    [{ e: 'burn', at: [0, 0], r: 30 }, Burn],
    [{ e: 'bubo', at: [0, 0] }, Bubo],
    [{ e: 'rot', at: [0, 0], r: 30 }, Rot],
    [{ e: 'venom', at: [0, 0] }, Venom],
    [{ e: 'grub', at: [0, 0] }, Grub],
    [{ e: 'sigil', at: [0, 0], shape: 'eye' }, Sigil],
    [{ e: 'pool', at: [0, 0], r: 20 }, BloodPool],
    [{ e: 'eggsac', at: [0, 0] }, EggSac],
    [{ e: 'malison-matins', at: [0, 0] }, Malison],
    [{ e: 'malison-lauds', at: [0, 0] }, LaudsMalison],
  ];

  it('maps every string id to its constructor', () => {
    expect(Object.keys(ENTITY_REGISTRY).sort()).toEqual(samples.map(([s]) => s.e).sort());
    const op = start();
    for (const [spec, cls] of samples) expect(makeEntity(spec, op), spec.e).toBeInstanceOf(cls);
  });

  it('applies the common hidden/required parameters', () => {
    const e = makeEntity({ e: 'embedded', at: [10, 10], kind: 'hexstone', hidden: true, required: false }, start());
    expect([e.hidden, e.required]).toEqual([true, false]);
  });

  it('validates parameter types and ranges', () => {
    expect(validateSpec({ e: 'laceration', at: [0, 0], angle: 0, len: 60 }, ALL, 'x')).toEqual([]);
    expect(validateSpec({ e: 'laceration', at: [0, 0], angle: 0 }, ALL, 'x').join()).toMatch(/missing "len"/);
    expect(validateSpec({ e: 'laceration', at: [0, 0], angle: 'up', len: 60 }, ALL, 'x').join()).toMatch(/"angle" must be a number/);
    expect(validateSpec({ e: 'laceration', at: [0, 0], angle: 0, len: 4000 }, ALL, 'x').join()).toMatch(/outside/);
    expect(validateSpec({ e: 'embedded', at: [0, 0], kind: 'moonshard' }, ALL, 'x').join()).toMatch(/not one of/);
    expect(validateSpec({ e: 'sigil', at: [0, 0], shape: 'eye', colour: 'red' }, ALL, 'x').join()).toMatch(/unknown parameter "colour"/);
  });

  it('seeded picks choose the same entities for the same seed', () => {
    const list = [{ e: 'pick' as const, n: [2, 4] as const, of: [0, 1, 2, 3, 4].map((i): EntitySpec => ({ e: 'rot', at: [i * 40 - 80, 0], r: 20 })) }];
    const run = (seed: number) =>
      spawnAll(
        list,
        start(() => [], { seed }),
      ).map((e) => e.pos.x);
    expect(run(3)).toEqual(run(3));
    const n = run(3).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
  });
});

describe('operation data validation (CON-0003)', () => {
  it('every demo operation is written as data and validates cleanly', () => {
    expect(demoOps).toHaveLength(10);
    for (const def of demoOps) expect(validateOp(dataOf(def)), def.id).toEqual([]);
  });

  const base: OperationData = {
    id: 'bad',
    title: 'Bad',
    patient: 'P',
    diagnosis: 'D',
    organ: 'flesh',
    timeLimit: 60,
    tools: ['thread'],
    ranks: { S: 3, A: 2, B: 1 },
    phases: [],
  };

  it('rejects unknown entity ids', () => {
    expect(validateOp({ ...base, phases: [{ spawn: [{ e: 'wyrm', at: [0, 0] } as unknown as EntitySpec] }] }).join()).toMatch(/unknown entity id "wyrm"/);
  });

  it('rejects positions off the operating field', () => {
    expect(validateOp({ ...base, phases: [{ spawn: [{ e: 'laceration', at: [600, 0], angle: 0, len: 60 }] }] }).join()).toMatch(/off the operating field/);
    expect(
      validateOp({
        ...base,
        tools: ['lancet', 'thread'],
        phases: [
          {
            spawn: [
              {
                e: 'incision',
                path: [
                  [0, 0],
                  [0, 400],
                ],
              },
            ],
          },
        ],
      }).join(),
    ).toMatch(/leaves the operating field/);
  });

  it('rejects entities the op has no instrument for', () => {
    expect(validateOp({ ...base, phases: [{ spawn: [{ e: 'grub', at: [0, 0] }] }] }).join()).toMatch(/needs brand or tongs/);
    expect(validateOp({ ...base, tools: ['tongs'], phases: [{ spawn: [{ e: 'embedded', at: [0, 0], kind: 'arrow' }] }] }).join()).toMatch(/needs lancet/);
    expect(validateOp({ ...base, tools: ['tongs'], phases: [{ spawn: [{ e: 'embedded', at: [0, 0], kind: 'shot', hidden: true }] }] }).join()).toMatch(
      /needs lens/,
    );
  });

  it('rejects a closing phase with no incision, empty phases and inverted ranks', () => {
    expect(validateOp({ ...base, phases: [{ close: true }] }).join()).toMatch(/never opened/);
    expect(validateOp({ ...base, phases: [{ callout: ['…'] }] }).join()).toMatch(/spawns nothing/);
    expect(validateOp({ ...base, ranks: { S: 1, A: 2, B: 3 }, phases: [{ spawn: [{ e: 'laceration', at: [0, 0], angle: 0, len: 60 }] }] }).join()).toMatch(
      /S > A > B/,
    );
  });
});

/** Instruments that resolve each entity class a campaign op can spawn (any one of each inner list). */
const RESOLVES = new Map<unknown, (e: never) => ToolId[][]>([
  [Laceration, (e: Laceration) => [e.small ? ['thread', 'salve'] : ['thread']]],
  [Incision, () => [['lancet', 'thread']]],
  [Embedded, (e: Embedded) => (e.barbed && e.nicks < 2 ? [['tongs'], ['lancet']] : [['tongs']])],
  [Burn, () => [['tongs'], ['salve']]],
  [Bubo, () => [['lancet'], ['salve']]],
  [Rot, () => [['salve']]],
  [Venom, () => [['tincture']]],
  [Grub, () => [['brand', 'tongs']]],
  [SpiderlingGrub, () => [['brand']]],
  [Sigil, () => [['brand']]],
  [BloodPool, () => [['leech']]],
  [EggSac, () => [['lancet']]],
  [Malison, () => [['brand']]],
  [MalisonShard, () => [['tongs']]],
  [LaudsMalison, () => [['brand'], ['lens']]],
  [ChoirVoice, () => [['brand']]],
]);

describe('tool requirements (CON-0004)', () => {
  for (const def of allCampaignOperations()) {
    it(`${def.id}: every spawned entity can be resolved with the op's instruments`, () => {
      const problems = new Set<string>();
      playWithBot(def, {
        think: 1,
        onOp: (op: Operation) =>
          op.events.on('spawn', ({ entity }) => {
            const need = RESOLVES.get(entity.constructor);
            if (!need || !entity.required) return;
            for (const any of [...need(entity as never), ...(entity.hidden ? [['lens'] as ToolId[]] : [])])
              if (!any.some((t) => def.tools.includes(t))) problems.add(`${entity.constructor.name} needs ${any.join('/')}`);
          }),
      });
      expect([...problems]).toEqual([]);
    });
  }
});

describe('setting-only patient folk (CON-0005)', () => {
  it('no operation uses a non-setting race', () => {
    for (const def of allCampaignOperations()) expect([...SPECIES, undefined], def.id).toContain(def.race);
  });
});
