/**
 * The demo op checklist: no softlocks (CON-0020), seeded determinism (CON-0021) and the tool
 * introduction schedule (GAM-0205) for Chapters I–II.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../src/content/campaign';
import { Operation } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';
import { playWithBot } from './bot';
import { AFTERMATH } from '../src/content/aftermath';
import { RANK_TABLE } from '../src/surgery/ranks';

const DEMO_OPS = CAMPAIGN.slice(0, 2).flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));

/**
 * Each instrument arrives once, in campaign order, with its tutorial phase in that op.
 * (The shipped order; the original plan introduced the Lancet and Tincture in op1-1 and the Lens in op1-3.)
 */
const SCHEDULE: Record<string, readonly ToolId[]> = {
  'op1-1': ['thread', 'leech', 'salve'],
  'op1-2': ['lancet', 'tongs'],
  'op1-3': ['tincture'],
  'op1-4': ['brand'],
  'op1-5': [],
  'op2-1': [],
  'op2-2': ['lens'],
  'op2-3': [],
  'op2-4': [],
  'op2-5': [],
};

describe('demo op checklist', () => {
  it('GAM-0205: tools are introduced on schedule and no op hands over an instrument it has not introduced', () => {
    const known = new Set<ToolId>();
    for (const def of DEMO_OPS) {
      const fresh = def.tools.filter((t) => !known.has(t));
      expect(fresh.sort(), def.id).toEqual([...(SCHEDULE[def.id] ?? [])].sort());
      for (const t of fresh) known.add(t);
    }
    // The Litany is first taught at the Matins fight.
    expect(DEMO_OPS.find((d) => d.litany !== false)?.id).toBe('op1-5');
  });

  it('CON-0019: every op has a briefing, a case note (aftermath), sim-calibrated ranks and callouts that fit the panel', () => {
    for (const def of DEMO_OPS) {
      expect(def.diagnosis.length, def.id).toBeGreaterThan(20);
      // The case note: an aftermath scene, or (after the Malison fights) the story step that follows.
      const ch = CAMPAIGN.find((c) => c.steps.some((st) => st.kind === 'op' && st.op === def))!;
      const next = ch.steps[ch.steps.findIndex((st) => st.kind === 'op' && st.op === def) + 1];
      expect(AFTERMATH[def.id] ?? (next?.kind === 'story' ? next : undefined), `${def.id} case note`).toBeDefined();
      expect(RANK_TABLE[def.id], `${def.id} ranks`).toBeDefined();
      for (const ph of def.phases) for (const line of ph.callout ?? []) expect(line.length, `${def.id}: ${line}`).toBeLessThanOrEqual(180);
    }
  });

  for (const def of DEMO_OPS) {
    it(`${def.id}: an idle surgeon loses before time + 5 s (CON-0020); the steady bot wins, identically on two runs (CON-0021)`, () => {
      const idle = new Operation(def);
      for (let t = 0; t < def.timeLimit + 5 && (idle.status === 'intro' || idle.status === 'running'); t += 1 / 60) idle.update(1 / 60);
      expect(idle.status).toBe('lost');
      const a = playWithBot(def, { think: 1 }).op;
      const b = playWithBot(def, { think: 1 }).op;
      expect(a.status).toBe('won');
      expect([a.score, Math.round(a.vitals * 1000), a.timeLeft]).toEqual([b.score, Math.round(b.vitals * 1000), b.timeLeft]);
    });
  }
});
