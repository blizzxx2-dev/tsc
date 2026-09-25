/** BOS-0009: the boss content lint — every phase of every Hour has a tell, a counter, an Ilse hint and codex text. */
import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../src/content/campaign';
import { hasKey } from '../src/i18n';
import { CODEX_BOSSES, BOSS_OPS } from '../src/surgery/bosses/codex';
import { BOSS_SHEET, bossPhaseHint } from '../src/surgery/bosses/sheet';
import { BOSS_TELLS } from '../src/surgery/bosses/signals';
import { tipFor } from '../src/surgery/hints';
import { Malison } from '../src/surgery/malison';
import { Operation } from '../src/surgery/operation';
import { TOOL_INFO } from '../src/surgery/types';

const TOOLS = new Set(TOOL_INFO.map((t) => t.id));

describe('BOS-0009: boss content lint', () => {
  it('every Hour and the Office: three phases, each with ≥ 1 declared tell, ≥ 1 counter, a hint line and codex text', () => {
    for (const boss of CODEX_BOSSES) {
      const sheet = BOSS_SHEET[boss];
      expect(sheet.length, boss).toBe(3);
      expect(hasKey(`codex.${boss}.title`) && hasKey(`codex.${boss}.body`), `${boss} codex`).toBe(true);
      for (const ph of sheet) {
        const at = `${boss} / ${ph.name}`;
        expect(ph.tells.length, at).toBeGreaterThanOrEqual(1);
        for (const t of ph.tells) expect(BOSS_TELLS[boss]?.[t], `${at}: tell ${t}`).toBeDefined();
        expect(ph.counters.length, at).toBeGreaterThanOrEqual(1);
        for (const c of ph.counters) expect(TOOLS.has(c), `${at}: counter ${c}`).toBe(true);
        expect(ph.hint.length, at).toBeGreaterThan(20);
        expect(ph.hint.length, at).toBeLessThanOrEqual(120);
      }
    }
  });

  it('each boss operation’s kit holds every counter its Hour asks for', () => {
    const ops = allCampaignOperations();
    for (const [id, boss] of Object.entries(BOSS_OPS)) {
      const def = ops.find((d) => d.id === id)!;
      for (const ph of BOSS_SHEET[boss]) for (const c of ph.counters) expect(def.tools, `${id} ${ph.name}: ${c}`).toContain(c);
    }
  });

  it('losing to an Hour, Ilse offers the hint for the phase it was lost in', () => {
    const def = allCampaignOperations().find((d) => d.id === 'op1-5')!;
    const op = new Operation(def);
    let m: Malison | undefined;
    for (let i = 0; i < 60 * 600 && !m; i++) {
      op.update(1 / 60);
      m = op.entities.find((e): e is Malison => e instanceof Malison && e.alive);
      if (!m) for (const e of op.entities) if (e.required) e.kill();
    }
    expect(m).toBeDefined();
    m!.damage(op, 45); // into Watchfire
    op.lose('test', 'vitals');
    expect(bossPhaseHint(op)).toBe(BOSS_SHEET.matins[1].hint);
    expect(tipFor(op)).toEqual({ id: 'boss-phase', text: BOSS_SHEET.matins[1].hint });
  });
});
