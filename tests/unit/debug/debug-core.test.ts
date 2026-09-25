/** QAT-0074/0075/0077: the DOM-free parts of the debug tooling — command parsing, presets, state views and hashes. */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN, allOperations } from '../../../src/content/campaign';
import { OP_1_1, OP_1_5 } from '../../../src/content/chapter1';
import { boolArg, CommandRegistry, intArg, numArg, tokenize } from '../../../src/debug/commands';
import { isPresetName, PRESET_NAMES, presetSave } from '../../../src/debug/presets';
import { canonicalState, opView, stateHash } from '../../../src/debug/state';
import { Operation } from '../../../src/surgery/operation';
import { playWithBot } from '../../bot';
import { start, step } from '../../helpers/sim';

describe('command parsing', () => {
  it('tokenizes words and quoted groups', () => {
    expect(tokenize('  story  s1-2   3 ')).toEqual(['story', 's1-2', '3']);
    expect(tokenize('flag "a flag" on')).toEqual(['flag', 'a flag', 'on']);
    expect(tokenize('')).toEqual([]);
  });

  it('parses numbers with a dot decimal regardless of locale and rejects junk', () => {
    expect(numArg('0.5', 'x')).toBe(0.5);
    expect(() => numArg('0,5', 'x')).toThrow(/number/);
    expect(() => numArg('', 'x')).toThrow();
    expect(intArg('3', 'n')).toBe(3);
    expect(() => intArg('3.5', 'n')).toThrow(/integer/);
    expect(boolArg('off')).toBe(false);
    expect(boolArg('ON')).toBe(true);
    expect(boolArg(undefined)).toBe(true);
  });

  it('runs commands, enforces arity, reports errors and keeps history', async () => {
    const ctx = { n: 0 };
    const reg = new CommandRegistry(ctx).add(
      { name: 'add', usage: '<k>', min: 1, help: 'add k', run: (c, [k]) => String((c.n += intArg(k, 'k'))) },
      {
        name: 'boom',
        help: 'throws',
        run: () => {
          throw new Error('nope');
        },
      },
    );
    expect(await reg.run('add 2')).toBe('2');
    expect(await reg.run('ADD 3')).toBe('5');
    expect(await reg.run('add')).toBe('usage: add <k>');
    expect(await reg.run('boom')).toBe('error: nope');
    expect(await reg.run('what')).toMatch(/unknown command/);
    expect(await reg.run('   ')).toBe('');
    expect(reg.history).toEqual(['add 2', 'ADD 3', 'add', 'boom', 'what']);
    expect(reg.help()).toContain('add <k> — add k');
  });
});

describe('test-state presets', () => {
  const opSteps = (chapter: number) => CAMPAIGN[chapter].steps.map((s, i) => [s, i] as const).filter(([s]) => s.kind === 'op');

  it('defines the seven named presets', () => {
    expect([...PRESET_NAMES]).toEqual(['fresh', 'mid-ch1', 'pre-matins', 'ch2-start', 'pre-lauds', 'demo-complete', 'all-xs']);
    expect(isPresetName('pre-lauds')).toBe(true);
    expect(isPresetName('nope')).toBe(false);
  });

  it('places progress at the right step and records bests only for earlier operations', () => {
    const at = (name: (typeof PRESET_NAMES)[number]) => presetSave(name);
    expect(at('fresh').progress).toEqual({ chapter: 0, step: 0 });
    expect(at('fresh').best).toEqual({});
    const mid = at('mid-ch1');
    const op13 = opSteps(0).find(([s]) => s.kind === 'op' && s.op.id === 'op1-3')![1];
    expect(mid.progress).toEqual({ chapter: 0, step: op13 });
    expect(Object.keys(mid.best).sort()).toEqual(['op1-1', 'op1-2']);
    expect(Object.keys(at('pre-matins').best).sort()).toEqual(['op1-1', 'op1-2', 'op1-3', 'op1-4']);
    expect(at('ch2-start').progress).toEqual({ chapter: 1, step: 0 });
    expect(Object.keys(at('ch2-start').best)).toHaveLength(5);
    expect(Object.keys(at('pre-lauds').best)).toHaveLength(9);
    expect(at('demo-complete').progress).toEqual({ chapter: CAMPAIGN.length, step: 0 });
    expect(Object.keys(at('demo-complete').best)).toHaveLength(allOperations().length);
  });

  it("all-xs records an XS above each operation's XS line", () => {
    const s = presetSave('all-xs');
    for (const def of allOperations()) {
      expect(s.best[def.id].rank).toBe('XS');
      expect(s.best[def.id].score).toBeGreaterThanOrEqual(def.ranks.S * 1.05);
    }
  });
});

describe('state views and hashes', () => {
  it('describes live entities with stable kind names', () => {
    const op = start(new Operation(OP_1_5));
    const v = opView(op);
    expect(v.id).toBe('op1-5');
    expect(v.status).toBe('running');
    expect(v.entities.map((e) => e.kind)).toEqual(['Sigil', 'Sigil']);
    expect(v.entities[0]).toHaveProperty('segs');
  });

  it('hashes identical runs identically and different runs differently', () => {
    const a = playWithBot(OP_1_1).op;
    const b = playWithBot(OP_1_1).op;
    expect(stateHash(a)).toBe(stateHash(b));
    expect(canonicalState(a)).toBe(canonicalState(b));
    const c = start(new Operation(OP_1_1));
    const d = start(new Operation(OP_1_1));
    step(d, 1 / 60);
    expect(stateHash(c)).not.toBe(stateHash(d));
    expect(stateHash(c)).toMatch(/^[0-9a-f]{8}$/);
  });
});
