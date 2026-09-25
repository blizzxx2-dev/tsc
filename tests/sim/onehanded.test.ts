/**
 * GAM-0241: one-handed mode — the "One-handed" preset puts instrument cycling on the mouse side
 * buttons and the Litany on a held button, and every Alpha operation (Chapters III–V) is completed
 * through the real input pipeline without a single keyboard event.
 */
import { describe, expect, it } from 'vitest';
import { LATER_CHAPTERS } from '../../src/content/later';
import { Input } from '../../src/core/input';
import { Bindings } from '../../src/input/bindings';
import { applyPreset, presetById } from '../../src/input/presets';
import type { OperationDef } from '../../src/surgery/operation';
import { playWithBotThroughInput } from '../bot';

describe('GAM-0241: one-handed mode', () => {
  it('the preset: side buttons cycle, the right button speaks the Litany, no keys needed to play', () => {
    const b = new Bindings(null);
    applyPreset(b, presetById('onehand'));
    expect(b.effective('tool.prev')).toContain('mouse:3');
    expect(b.effective('tool.next')).toContain('mouse:4');
    expect(b.effective('litany.key')).toContain('mouse:2');
    expect(b.prefs.litanyInput).toBe('key');
  });

  for (const ch of LATER_CHAPTERS) {
    it(`every ${ch.id} operation is completed one-handed, mouse only`, { timeout: 300_000 }, () => {
      let sideClicks = 0;
      for (const s of ch.steps) {
        if (s.kind !== 'op') continue;
        const def = s.op as OperationDef;
        const b = new Bindings(null);
        applyPreset(b, presetById('onehand'));
        const input = new Input(null, 1280, 720, b);
        const keys: string[] = [];
        const push = input.push.bind(input);
        input.push = (e) => {
          if ('code' in e && typeof e.code === 'string' && e.code.startsWith('key:')) keys.push(e.code);
          if ('code' in e && e.type === 'down' && (e.code === 'mouse:3' || e.code === 'mouse:4')) sideClicks++;
          return push(e);
        };
        const { scene } = playWithBotThroughInput(def, input, { oneHanded: true });
        expect(scene.op.status, `${def.id}: ${scene.op.lostReason}`).toBe('won');
        expect(keys, def.id).toEqual([]);
      }
      expect(sideClicks).toBeGreaterThan(20);
    });
  }
});
