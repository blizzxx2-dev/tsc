/**
 * Automated functional passes for Chapters III–V (QAT-0152, QAT-0153, QAT-0154): every later-chapter
 * operation (the six remaining Hours and the Office included) is won by the bot, lost by an idle
 * surgeon, lost by the timer and retried deterministically; every story scene resolves on the
 * default path with each flag the chapter reads set either way; and Chapter V runs through the
 * campaign step model to its ending and on to the credits (the end of the campaign).
 */
import { isTeaching } from '../../src/content/teach';
import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN, nextOpenStep, stepId, type Chapter } from '../../src/content/campaign';
import { resolveStory } from '../../src/content/conditions';
import { evalCondition, FlagStore } from '../../src/content/flags';
import { LATER_CHAPTERS } from '../../src/content/later';
import { stateHash } from '../../src/debug/state';
import { BOSS_OPS } from '../../src/surgery/bosses/codex';
import { Operation, type OperationDef } from '../../src/surgery/operation';
import { playWithBot } from '../bot';
import { runIdle, runTimerLoss, runVitalsLoss, type FailureFingerprint } from '../helpers/failure-paths';
import { DT } from '../helpers/sim';

const opsOf = (ch: Chapter): OperationDef[] => ch.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : []));

/** The decisive end state of a finished operation. */
const outcome = (op: Operation) => ({
  status: op.status,
  score: op.score,
  vitals: Math.round(op.vitals * 1000),
  timeLeft: Math.round(op.timeLeft * 1000),
  counts: { ...op.counts },
  phase: op.phase,
});

/** Play the intro out and hash the first phase's spawned state (what "Try Again" must reproduce). */
function firstPhaseHash(def: OperationDef): string {
  const op = new Operation(def);
  for (let i = 0; i < 600 && op.status === 'intro'; i++) op.update(DT);
  return stateHash(op);
}

const HOURS: Record<number, string[]> = { 2: ['prime', 'terce'], 3: ['sext', 'none'], 4: ['vespers', 'compline', 'office'] };

for (const [ci, ch] of LATER_CHAPTERS.map((c, i) => [i + 2, c] as const)) {
  const task = `QAT-015${ci}`;
  describe(`${task}: Chapter ${ch.numeral} functional pass`, () => {
    const ops = opsOf(ch);

    it(`plays the Hours of Chapter ${ch.numeral} (${HOURS[ci].join(', ')})`, () => {
      const hours = ops.map((o) => BOSS_OPS[o.id]).filter(Boolean);
      expect(hours).toEqual(HOURS[ci]);
    });

    for (const def of ops) {
      const boss = BOSS_OPS[def.id] ? ` (${BOSS_OPS[def.id]})` : '';

      it(`${def.id}${boss}: the bot wins, and a second run on the same seed is identical`, () => {
        const a = playWithBot(def, { think: 1 }).op;
        expect(
          a.status,
          `${def.id}: ${a.lostReason} left=${a.entities
            .filter((e) => e.alive)
            .map((e) => e.constructor.name)
            .join(',')}`,
        ).toBe('won');
        expect(a.score).toBeGreaterThan(0);
        const b = playWithBot(def, { think: 1 }).op;
        expect(outcome(b)).toEqual(outcome(a));
      });

      it(`${def.id}${boss}: an idle surgeon loses, and a loss by vitals is reachable`, () => {
        const idle = runIdle(def);
        expect(idle.status).toBe('lost');
        // Some ailments end the operation on their own terms (petrification or a burrower reaching the heart).
        if (idle.lostCause === 'other') expect(idle.lostReason).toMatch(/reached (her|the) heart/);
        else expect(['vitals', 'time']).toContain(idle.lostCause);
        // A teaching phase (GAM-0212) cannot be lost by vitals: the loss must be reachable after it.
        const vdef = isTeaching(def.phases[0]) ? { ...def, phases: def.phases.slice(1) } : def;
        const vitals: FailureFingerprint = runVitalsLoss(vdef);
        expect(vitals.status).toBe('lost');
        expect(vitals.lostCause).toBe('vitals');
        expect(vitals.vitals).toBe(0);
        // The same driver on the same seed loses the same way (loss handling is deterministic).
        expect(runVitalsLoss(vdef)).toEqual(vitals);
      });

      it(`${def.id}${boss}: the timer runs out with the patient alive`, () => {
        const timer = runTimerLoss(def);
        expect(timer.status).toBe('lost');
        expect(timer.lostCause).toBe('time');
        expect(timer.timeLeft).toBe(0);
        expect(timer.vitals).toBeGreaterThan(0);
        expect(runTimerLoss(def)).toEqual(timer);
      });

      it(`${def.id}${boss}: Try Again after a loss restarts on the same seed and reaches the same result`, () => {
        // A retry is a fresh Operation on the same definition: its first phase spawns identically…
        const reference = firstPhaseHash(def);
        runTimerLoss(def);
        expect(firstPhaseHash(def)).toBe(reference);
        // …and a repeat attempt that skips the Hours' phase-transition beats (BOS-0004) still wins.
        const retry = playWithBot({ ...def, skipCinematics: true } as OperationDef, { think: 1 }).op;
        expect(retry.status, `${def.id} retry: ${retry.lostReason}`).toBe('won');
        expect(outcome(playWithBot({ ...def, skipCinematics: true } as OperationDef, { think: 1 }).op)).toEqual(outcome(retry));
      });
    }

    it('every story scene resolves with lines on the default path and with each flag the chapter reads set either way', () => {
      const stories = ch.steps.flatMap((s) => (s.kind === 'story' ? [s.story] : []));
      expect(stories.length).toBeGreaterThan(0);
      for (const st of stories) expect(resolveStory(st, {}).lines.length, st.id).toBeGreaterThan(0);
      for (const flag of ch.flags?.reads ?? []) {
        for (const value of [true, false]) {
          const f = new FlagStore();
          f.set(flag, value);
          for (let i = 0; i < ch.steps.length; i++)
            if (!ENDING_IDS.includes(stepId(ch.steps[i]))) expect(nextOpenStep(ch, i, f), `${ch.id} step ${i} with ${flag}=${value}`).toBe(i);
        }
      }
    });
  });
}

/** The three alternative endings (NAR-0158): exactly one of them opens. */
const ENDING_IDS = ['s5-end', 's5-end-pyre', 's5-end-exile'];

describe('QAT-0154: Chapter V ending and credits', () => {
  const five = FULL_CAMPAIGN[4];

  it('the chapter ends on one of three endings after the Office, then the epilogue and the journal (NAR-0157)', () => {
    const ids = five.steps.map(stepId);
    expect(ids.slice(-6)).toEqual(['op5-9', ...ENDING_IDS, 's5-epilogue', 's5-journal']);
    expect(BOSS_OPS['op5-9']).toBe('office');
    for (const s of five.steps.filter((x) => ENDING_IDS.includes(stepId(x))))
      expect(s.kind === 'story' && s.story.lines[s.story.lines.length - 1].text).toMatch(/THE END/);
  });

  it('walking Chapter V through the step model reaches the ending, then the campaign is complete (credits)', () => {
    const flags = new FlagStore();
    const visited: string[] = [];
    let step = 0;
    for (let guard = 0; guard < 100; guard++) {
      const open = nextOpenStep(five, step, flags);
      const s = five.steps[open];
      if (!s) break;
      visited.push(stepId(s));
      step = open + 1;
    }
    // A fresh save with no choices takes the exile (NAR-0158).
    expect(visited).toEqual(five.steps.map(stepId).filter((id) => id !== 's5-end' && id !== 's5-end-pyre'));
    // Past the last step of the last chapter there is no chapter 6: the campaign is complete.
    expect(FULL_CAMPAIGN[5]).toBeUndefined();
    expect(step).toBe(five.steps.length);
  });

  it('the finale is reachable whatever the prior choices: every combination of the flags it reads keeps every step open', () => {
    const reads = five.flags?.reads ?? [];
    expect(reads.length).toBeGreaterThan(0);
    for (let mask = 0; mask < 1 << reads.length; mask++) {
      const f = new FlagStore();
      reads.forEach((r, i) => f.set(r, !!(mask & (1 << i))));
      for (let i = 0; i < five.steps.length; i++) if (!ENDING_IDS.includes(stepId(five.steps[i]))) expect(nextOpenStep(five, i, f)).toBe(i);
      // Exactly one ending opens for any flags.
      const open = five.steps.filter((x) => ENDING_IDS.includes(stepId(x)) && (!x.if || evalCondition(x.if, f)));
      expect(open).toHaveLength(1);
      const end = open[0];
      if (end.kind === 'story') expect(resolveStory(end.story, {}).lines.length).toBeGreaterThan(0);
    }
  });
});
