import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOOD_EMITTERS, Particles } from '../../../src/render/particles';
import { EMITTERS } from '../../../src/render/fx/emitters';
import { speciesBlood } from '../../../src/render/organs';
import { bloodOf, HUMAN_BLOOD, SPECIES_PROFILES, tintBlood } from '../../../src/surgery/species';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith('.ts') ? [join(dir, f)] : []));

describe('species blood colour source of truth (ENG-0096)', () => {
  it('human blood is unchanged; other species map through their look', () => {
    expect(tintBlood(HUMAN_BLOOD, SPECIES_PROFILES.human.look)).toBe(HUMAN_BLOOD);
    expect(bloodOf('orc')).not.toBe(bloodOf('human'));
    expect(speciesBlood('#6a0208', SPECIES_PROFILES.elf.look)).toBe(tintBlood('#6a0208', SPECIES_PROFILES.elf.look));
  });

  it('particles tint every blood emitter and the suction streak for the patient', () => {
    const p = new Particles();
    const look = SPECIES_PROFILES.elf.look;
    p.setBloodTint((c) => tintBlood(c, look));
    const defs = (p as unknown as { defs: typeof EMITTERS }).defs;
    for (const id of BLOOD_EMITTERS) expect(JSON.stringify(defs[id].color), id).not.toBe(JSON.stringify(EMITTERS[id].color));
    expect(p.blood).toBe(tintBlood('#7a0a10', look));
  });

  it('no drawn blood red is hard-coded outside the tint inputs', () => {
    const reds = /'#(6a0208|7a0a10|8a0a10|5a0206|8a0610|9a0812|7a0410)'/;
    const allowed = ['species.ts', 'particles.ts', 'vfx.ts', 'operation.ts', 'vampire.ts', 'gangrene.ts', 'hud.ts'];
    const offenders = files('src')
      .filter((f) => !allowed.some((a) => f.endsWith(a)))
      .filter((f) => reds.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
