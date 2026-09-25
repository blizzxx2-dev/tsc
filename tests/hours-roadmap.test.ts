/** Boss roadmap checks (BOS-*) that sit between the sim and the scenes: lost-patient names, story flags, assists, op tuning. */
import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../src/content/campaign';
import { bossStoryFlags, FlagStore } from '../src/content/flags';
import { NameSigil, patientName, PrimeMalison, PRIME_NAMES, primeRoll } from '../src/surgery/bosses/prime';
import type { BossEvent, BossOpDef } from '../src/surgery/bosses/signals';
import { Operation, type OperationDef } from '../src/surgery/operation';
import { lostPatientsOf } from '../src/scenes/bossAudio';
import { optionRows } from '../src/scenes/options';
import { at, start, wait } from './harness';

const byId = (id: string) => allCampaignOperations().find((d) => d.id === id)!;
const boss = (o: Partial<BossOpDef>) => o as Partial<OperationDef>;

describe('Prime: the roll of the dead', () => {
  it('BOS-0055: names come from the lost-patient list first, falling back to the canned roll', () => {
    const lost = lostPatientsOf({ 'op1-1': 1, 'op2-4': 2, 'op1-2': 0 });
    expect(lost).toEqual(['Jost']);
    expect(patientName('A lay-cantor of the Hollow Choir')).toBeNull();
    expect(patientName('Orsa Flintvein, dwarf prospector')).toBe('Orsa Flintvein');
    let p!: PrimeMalison;
    const op = start((o) => [(p = new PrimeMalison(at(0, 0), o))], boss({ lostPatients: ['Jost', 'Orsa Flintvein', 'x<script>'] }));
    expect(primeRoll(op).slice(0, 2)).toEqual(['Jost', 'Orsa Flintvein']);
    expect(primeRoll(op)).not.toContain('x<script>');
    wait(op, 3);
    expect(p.names[0]?.name).toBe('Jost');
    const plain = start((o) => [new PrimeMalison(at(0, 0), o)]);
    expect(primeRoll(plain)).toBe(PRIME_NAMES);
  });

  it('BOS-0056: the monk reads each name the quill finishes', () => {
    const op = start((o) => [new NameSigil(at(0, 0), 'Aldo Brenck', o, 0.5)]);
    const sounds: string[] = [];
    op.events.on('boss', (e: BossEvent) => e.kind === 'sound' && sounds.push(e.sound));
    wait(op, 2.6);
    expect(sounds.filter((s) => s === 'reading').length).toBe(1);
  });
});

describe('story flags and assists reach the fights', () => {
  it('BOS-0139/0146: Stroh stands with the surgeon once he owes them his tooth', () => {
    const f = new FlagStore();
    expect(bossStoryFlags(f)).toEqual([]);
    f.set('strohTooth', true);
    expect(bossStoryFlags(f)).toEqual(['strohAlly']);
  });

  it('BOS-0069/0082/0085/0112: every boss assist has a row in the accessibility options', () => {
    const keys = optionRows('access').flatMap((r) => r.keys ?? []);
    for (const k of ['bossReducedLag', 'bossLagReadout', 'bossMinBrightness', 'bossHazeOutline']) expect(keys).toContain(k);
  });

  it('BOS-0067: the Hour of Terce deepens the salve pot to 70 and refills it after 2 s', () => {
    const op = new Operation(byId('op3-11'));
    expect(op.tuning.salve.capacity).toBe(70);
    expect(op.tuning.salve.refillIdle).toBe(2);
    expect(op.salve).toBe(70);
    expect(new Operation(byId('op3-10')).tuning.salve.capacity).toBe(46);
  });
});
