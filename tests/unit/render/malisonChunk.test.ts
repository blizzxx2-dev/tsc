import { describe, expect, it } from 'vitest';
import { CREATURE_FS, MALISON_CHUNK } from '../../../src/render/shaders/creature';

describe('shared Malison shader chunk (ENG-0271)', () => {
  it('is included once and both Malison bodies use its ink, flash and dissolve', () => {
    expect(CREATURE_FS.split(MALISON_CHUNK)).toHaveLength(2);
    const body = (name: string) =>
      CREATURE_FS.slice(CREATURE_FS.indexOf(`vec4 ${name}(vec2 p)`), CREATURE_FS.indexOf('\n}\n', CREATURE_FS.indexOf(`vec4 ${name}(vec2 p)`)));
    for (const b of [body('matins'), body('lauds')]) {
      expect(b).toMatch(/malInk\(/);
      expect(b).toMatch(/malGlints\(/);
      expect(b).toMatch(/malFlash\(/);
      expect(b).toMatch(/malDissolve\(/);
    }
  });
});
