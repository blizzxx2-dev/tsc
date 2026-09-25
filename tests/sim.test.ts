import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { Laceration } from '../src/surgery/entities';
import { Operation, STEP } from '../src/surgery/operation';
import { replay, takeLog } from '../src/surgery/replay';
import { playWithBot } from './bot';
import { Anchor, at, Hand, running, testDef, wait, zig } from './harness';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|json|md)$/.test(f)) out.push(p);
  }
  return out;
}

/** Bodies of every `update(op, dt)` method in a source file. */
function updateBodies(src: string): string[] {
  const out: string[] = [];
  const re = /override update\([^)]*\): void \{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (depth > 0 && i < src.length) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

describe('GAM-B simulation hygiene', () => {
  it('GAM-0009: the old shard id is gone from code, content and tests', () => {
    const banned = ['warp', 'shard'].join('');
    const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))];
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes(banned));
    expect(hits).toEqual([]);
  });

  it('GAM-0010: no tuning literals (other than 0/1) inside ailment update() bodies', () => {
    const files = [join(ROOT, 'src/surgery/entities.ts')];
    try {
      for (const f of readdirSync(join(ROOT, 'src/surgery/ailments'))) files.push(join(ROOT, 'src/surgery/ailments', f));
    } catch {
      // no Alpha ailments yet
    }
    const offenders: string[] = [];
    for (const f of files) {
      for (const body of updateBodies(readFileSync(f, 'utf8'))) {
        const code = body.replace(/\/\/.*$/gm, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
        for (const lit of code.match(/(?<![\w.$])\d+(?:\.\d+)?(?![\w.])/g) ?? []) if (lit !== '0' && lit !== '1') offenders.push(`${f.split('/').pop()}: ${lit}`);
      }
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('GAM-0011: a per-op tuning override changes Laceration drain in that op only', () => {
    const lac = () => [new Laceration(at(0, 0), 0, 60, 1), new Anchor()];
    const plain = running(lac);
    const tuned = running(lac, { tuning: { laceration: { drainPerPx: 0.02 } } });
    const d = (op: Operation) => op.entities.find((e) => e instanceof Laceration)!.drain(op);
    expect(d(plain)).toBeCloseTo(0.05 + 60 * 0.01);
    expect(d(tuned)).toBeCloseTo(0.05 + 60 * 0.02);
    // The shared defaults were not mutated.
    expect(d(running(lac))).toBeCloseTo(d(plain));
  });

  it('GAM-0013: entity ids are per operation, so replays produce identical ids', () => {
    const def = allOperations().find((d) => d.id === 'op1-5')!;
    const ids = () => {
      const op = new Operation(def);
      wait(op, 3);
      return op.entities.map((e) => e.id);
    };
    const a = ids();
    new Operation(allOperations()[0]); // another op in between
    const b = ids();
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(Math.min(...a)).toBe(1);
  });

  it('GAM-0014: fixed-step sim — same step-indexed input gives the same result at 30/60/144 fps', () => {
    const lacA = at(-100, 0);
    const lacB = at(100, 0);
    const path = zig(lacA, lacB, 12);
    // Input as a function of the fixed step index: rest, then zig-zag at 400 px/s, then rest.
    const pts: { x: number; y: number }[] = [];
    for (let i = 1; i < path.length; i++) {
      const n = Math.ceil(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) / (400 * STEP));
      for (let k = 1; k <= n; k++) pts.push({ x: path[i - 1].x + ((path[i].x - path[i - 1].x) * k) / n, y: path[i - 1].y + ((path[i].y - path[i - 1].y) * k) / n });
    }
    const startStep = 300;
    const run = (fps: number) => {
      const op = new Operation(testDef(() => [new Laceration(at(0, 0), 0, 200, 1), new Anchor()], { tools: ['thread'] }));
      let step = 0;
      let prev = pts[0];
      let wasDown = false;
      let snap: object | null = null;
      while (!snap) {
        op.advance(1 / fps, () => {
          if (step === 1400) snap = { score: op.score, vitals: op.vitals, elapsed: Math.round(op.elapsed * 1000), lac: op.entities.filter((e) => e instanceof Laceration).length };
          const i = step - startStep;
          const down = i >= 0 && i < pts.length;
          const pos = down ? pts[i] : prev;
          op.handlePointer({ pos, prev, down, pressed: down && !wasDown, released: !down && wasDown }, STEP);
          prev = pos;
          wasDown = down;
          step++;
        });
      }
      return snap as unknown as { lac: number };
    };
    const r60 = run(60);
    expect(r60.lac).toBe(0);
    expect(run(30)).toEqual(r60);
    expect(run(144)).toEqual(r60);
  });

  it('GAM-0015: recorded input replays to the exact same score and rank on all 10 demo ops', () => {
    for (const def of allOperations()) {
      const orig = playWithBot(def, { profile: 'steady', record: true }).op;
      const again = replay(def, JSON.parse(JSON.stringify(takeLog(orig))));
      expect([again.status, again.score, again.rank(), Math.round(again.vitals * 1000)], def.id).toEqual([orig.status, orig.score, orig.rank(), Math.round(orig.vitals * 1000)]);
    }
  });

  it('GAM-0016: sim publishes typed events (rated, spawned, phaseStart, cue)', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 60, 0.2)]);
    const kinds = new Set(op.events.map((e) => e.kind));
    expect(kinds.has('phaseStart')).toBe(true);
    expect(kinds.has('spawned')).toBe(true);
    const h = new Hand(op);
    h.drag('thread', zig(at(-30, 0), at(30, 0), 4), 300);
    const rated = op.events.filter((e) => e.kind === 'rated');
    expect(rated.length).toBe(1);
    expect(op.events.some((e) => e.kind === 'cue' && e.cue === 'stitch')).toBe(true);
  });

  it('GAM-0017: telemetry summary per op', () => {
    const def = allOperations().find((d) => d.id === 'op1-3')!;
    const op = playWithBot(def, { profile: 'steady' }).op;
    const t = op.telemetry();
    expect(t.won).toBe(true);
    expect(t.phaseTimes.length).toBe(def.phases.length);
    expect(t.phaseTimes.every((x) => x > 0)).toBe(true);
    expect(t.ratings.cool + t.ratings.good).toBeGreaterThan(5);
    expect(t.toolsUsed).toContain('lancet');
    expect(t.minVitals).toBeLessThanOrEqual(Math.round(op.vitals));
    expect(t.litanyAt).toEqual([]);
  });
});
