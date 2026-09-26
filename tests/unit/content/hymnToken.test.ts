/** CON-0069: the silenced cantor swallowed a hymn-token — lens, incision, tongs; it goes into the codex. */
import { describe, expect, it } from 'vitest';
import { CODEX } from '../../../src/content/codex';
import { OP_2_4 } from '../../../src/content/ops/ch2';
import { Embedded, Incision, SWALLOWED_REACH } from '../../../src/surgery/entities';
import { TRAY_DISH } from '../../../src/surgery/operation';
import { strokePath } from '../../helpers/sim';
import { Hand, running } from '../../harness-gameplay';

const last = OP_2_4.phases[OP_2_4.phases.length - 1];

describe('the swallowed hymn-token (CON-0069)', () => {
  it('op2-4 ends on it: an incision line and a hidden token beneath it', () => {
    const op = running(() => []);
    const made = last.spawn(op);
    const token = made.find((e): e is Embedded => e instanceof Embedded && e.kind === 'token')!;
    const line = made.find((e): e is Incision => e instanceof Incision)!;
    expect(token.hidden).toBe(true);
    expect(line.project(token.origin).d).toBeLessThan(SWALLOWED_REACH);
  });

  it('the tongs cannot reach it until the incision is open; then it comes out and sets the flag', () => {
    const op = running((o) => last.spawn(o));
    const token = op.entities.find((e): e is Embedded => e instanceof Embedded && e.kind === 'token')!;
    const line = op.entities.find((e): e is Incision => e instanceof Incision)!;
    token.hidden = false;
    const out = () => strokePath(op, 'tongs', [token.pos, { x: token.pos.x, y: token.pos.y - 60 }, TRAY_DISH], { speed: 400 });
    out();
    expect(token.alive).toBe(true);
    expect(op.callouts.some((c) => c.includes('open him along the line'))).toBe(true);
    new Hand(op).drag('lancet', line.points, 300);
    expect(line.openWound).toBe(true);
    out();
    expect(token.alive).toBe(false);
    expect(op.storyFlags.has('hymnToken')).toBe(true);
  });

  it('the codex keeps it once op2-4 is won (the op cannot be won without it)', () => {
    const entry = CODEX.find((e) => e.id === 'choir-token')!;
    expect(entry.unlock).toEqual({ kind: 'op', op: 'op2-4', rank: undefined });
    expect(entry.body.split(/\s+/).length).toBeLessThanOrEqual(180);
  });
});
