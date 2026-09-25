/**
 * QAT-0049: tool × entity matrix. Every one of the eight tools is pressed, dragged, held and
 * released on every entity type. Each cell's response (acts / hint callout / penalty / ignored)
 * is classified against a no-input baseline of the same deterministic op, and the whole matrix is
 * kept as the documented table in docs/qa/tool-entity-matrix.md — a change to any response
 * shows up as a diff of that file.
 */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import type { Vec } from '../../src/core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS, Venom } from '../../src/surgery/entities';
import type { Entity } from '../../src/surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../../src/surgery/lauds';
import { Malison, MalisonShard } from '../../src/surgery/malison';
import type { Operation } from '../../src/surgery/operation';
import { TOOL_INFO, type ToolId } from '../../src/surgery/types';
import { ALL_TOOLS, DT, drag, isolate, press, release } from '../helpers/sim';
import { Probe } from '../helpers/probe';

interface Subject {
  name: string;
  make: (op: Operation) => Entity[];
  /** The entity under test (the first spawned unless stated). */
  pick?: (op: Operation, spawned: Entity[]) => Entity;
  /** Where the gesture starts. */
  aim?: (e: Entity) => Vec;
  /** The entity moves on its own: the pointer tracks it (as a player would) instead of dragging away. */
  follow?: boolean;
}

const C = at(0, 0);
const SUBJECTS: Subject[] = [
  { name: 'Incision (marked)', make: () => [new Incision([at(-120, 0), at(0, -10), at(120, 0)])], aim: (e) => (e as Incision).points[0] },
  {
    name: 'Incision (closing)',
    make: () => {
      const i = new Incision([at(-120, 0), at(0, -10), at(120, 0)]);
      i.beginClosing();
      return [i];
    },
    aim: (e) => ({ x: (e as Incision).points[0].x + 20, y: (e as Incision).points[0].y - 26 }),
  },
  { name: 'Laceration', make: () => [new Laceration(C, 0.3, 100, 0)], aim: (e) => ({ x: e.pos.x - 10, y: e.pos.y - 26 }) },
  { name: 'Laceration (nick)', make: () => [new Laceration(C, 0.3, 36, 0)] },
  { name: 'BloodPool', make: () => [new BloodPool(C, 30)] },
  { name: 'Embedded arrow (barbed)', make: () => [new Embedded(C, 'arrow', -0.5)] },
  { name: 'Embedded shot', make: () => [new Embedded(C, 'shot')] },
  {
    name: 'Embedded hexstone (hidden)',
    make: () => {
      const e = new Embedded(C, 'hexstone', 0.3, false);
      e.hidden = true;
      return [e];
    },
  },
  { name: 'Burn', make: (op) => [new Burn(C, 44, op)], aim: (e) => (e as Burn).flakes[0] },
  { name: 'Bubo', make: () => [new Bubo(C, 22)] },
  { name: 'Rot', make: () => [new Rot(C, 50, 0.4)] },
  { name: 'Venom', make: (op) => [new Venom(C, op, 6)] },
  { name: 'Grub', make: (op) => [new Grub(C, op, 30)], follow: true },
  { name: 'SpiderlingGrub', make: (op) => [new SpiderlingGrub(C, op)], follow: true },
  { name: 'Sigil', make: () => [new Sigil(C, SIGILS.trident, 60, 999)], aim: (e) => (e as Sigil).segs[0].a },
  { name: 'EggSac', make: () => [new EggSac(C, 3, 30)] },
  { name: 'Malison (veiled)', make: (op) => [new Malison(C, op)], follow: true },
  {
    name: 'Malison (open)',
    follow: true,
    make: (op) => {
      const m = new Malison(C, op);
      m.open = true;
      return [m];
    },
  },
  { name: 'MalisonShard', make: (op) => [new MalisonShard(C, op)] },
  { name: 'LaudsMalison (shielded)', make: (op) => [new LaudsMalison(C, op)], follow: true },
  { name: 'ChoirVoice', make: (op) => [new LaudsMalison(C, op)], pick: (op) => op.entities.find((e) => e instanceof ChoirVoice)!, follow: true },
];

/** Primitive state of an entity (numbers rounded), for before/after comparison. */
function stateOf(e: Entity): string {
  const o = e as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { alive: e.alive, hidden: e.hidden };
  for (const [k, v] of Object.entries(o)) {
    if (k === 'id' || k === 'branded' || k === 'core' || k === 'voices') continue;
    if (typeof v === 'number') out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.length;
    else if (v && typeof v === 'object' && 'fraction' in v) out[k] = (v as { fraction: number }).fraction;
    else if (v && typeof v === 'object' && 'count' in v) out[k] = (v as { count: number }).count;
  }
  return JSON.stringify(out);
}

interface Outcome {
  state: string;
  counts: string;
  vitals: number;
  flags: string[];
}

function run(s: Subject, tool: ToolId | null): Outcome {
  let spawned: Entity[] = [];
  const { op } = isolate((o) => {
    spawned = s.make(o);
    return [...spawned, new Probe({ x: 1060, y: 410 })];
  });
  const e = s.pick ? s.pick(op, spawned) : spawned[0];
  const flags0 = new Set(op.flags);
  if (tool) {
    op.setTool(tool);
    const start = s.aim ? s.aim(e) : { ...e.pos };
    let prev = start;
    op.handlePointer(press(start), DT);
    op.update(DT);
    for (let i = 1; i <= 30; i++) {
      const from = s.follow && e.alive ? e.pos : start;
      const d = s.follow ? 0 : i;
      const p = { x: from.x + d, y: from.y + d * 0.3 };
      op.handlePointer(drag(p, prev), DT);
      op.update(DT);
      prev = p;
    }
    for (let i = 0; i < 30; i++) {
      const p = s.follow && e.alive ? { ...e.pos } : prev;
      op.handlePointer(drag(p, prev), DT);
      op.update(DT);
      prev = p;
    }
    op.handlePointer(release(prev), DT);
    op.update(DT);
  } else {
    for (let i = 0; i < 62; i++) op.update(DT);
  }
  return {
    state: stateOf(e),
    counts: JSON.stringify(op.counts),
    vitals: op.vitals,
    flags: [...op.flags].filter((f) => !flags0.has(f)),
  };
}

function classify(s: Subject, tool: ToolId): string {
  const base = run(s, null);
  const got = run(s, tool);
  const counts = JSON.parse(got.counts) as Record<string, number>;
  const baseCounts = JSON.parse(base.counts) as Record<string, number>;
  const tags: string[] = [];
  const good = counts.cool - baseCounts.cool + counts.good - baseCounts.good;
  if (good > 0 || got.state !== base.state) tags.push('acts');
  const newFlags = got.flags.filter((f) => !base.flags.includes(f));
  if (newFlags.length) tags.push(`hint(${newFlags.join(',')})`);
  const badNews = counts.bad - baseCounts.bad + counts.miss - baseCounts.miss;
  // Extra vitals loss only counts as a penalty when the tool did nothing useful (acting can spawn draining things).
  const acted = tags.includes('acts');
  if (badNews > 0 || (!acted && base.vitals - got.vitals > 0.5))
    tags.push(`penalty(${badNews > 0 ? (counts.miss > baseCounts.miss ? 'MISS' : 'BAD') : `-${Math.round(base.vitals - got.vitals)}`})`);
  return tags.length ? tags.join(' ') : '·';
}

describe('tool × entity matrix', () => {
  it('no tool/entity pair throws, and every response matches the documented table', async () => {
    const header = `| Entity | ${TOOL_INFO.map((t) => t.name).join(' | ')} |`;
    const rule = `|---|${ALL_TOOLS.map(() => '---').join('|')}|`;
    const rows: string[] = [];
    for (const s of SUBJECTS) {
      const cells = ALL_TOOLS.map((tool) => {
        let cell = '';
        expect(() => (cell = classify(s, tool)), `${s.name} × ${tool}`).not.toThrow();
        return cell;
      });
      rows.push(`| ${s.name} | ${cells.join(' | ')} |`);
    }
    const doc = [
      '# Tool × entity response matrix',
      '',
      'Generated and enforced by `tests/characterisation/tool-matrix.test.ts` (QAT-0049). Each cell is the',
      'response to pressing, dragging ~30 px, holding and releasing that tool on the entity, compared with',
      'the same op left alone: **acts** (rating or state change), **hint(flag)** (a callout flag was set),',
      '**penalty(…)** (BAD/MISS rating or extra vitals lost), **·** (ignored). Regenerate with',
      '`npx vitest run tests/characterisation/tool-matrix.test.ts -u` and review the diff.',
      '',
      header,
      rule,
      ...rows,
      '',
    ].join('\n');
    await expect(doc).toMatchFileSnapshot('../../docs/qa/tool-entity-matrix.md');
  });
});
