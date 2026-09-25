/** Demo gameplay roadmap checks (GAM-*) that scan content or drive the sim directly. */
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import type { OperationDef } from '../src/surgery/operation';
import { TOOL_INFO } from '../src/surgery/types';

const demoOps = (): OperationDef[] => [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));
const callouts = (d: OperationDef): string[] => [...d.phases.flatMap((p) => p.callout ?? []), ...(d.events ?? []).flatMap((e) => e.say ?? [])];

describe('GAM-0252: callout audit', () => {
  const alias = /\b(?:lancet|tongs|leech(?:-pipe)?|thread|salve|tincture|brand|lens)\b/i;
  it('every demo op callout is ≤ 90 characters and names instruments by their TOOL_INFO display names', () => {
    for (const d of demoOps()) {
      for (const line of callouts(d)) {
        expect(line.length, `${d.id}: ${line}`).toBeLessThanOrEqual(90);
        // Strip every display name; any instrument word left over is an off-book name ("the brand", "gut thread").
        const rest = TOOL_INFO.reduce((s, t) => s.split(t.name).join('·'), line);
        expect(rest, `${d.id}: ${line}`).not.toMatch(alias);
      }
    }
  });
});
