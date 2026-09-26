/** How the entities of `surgery/ailments/organs.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { spurtArt } from '../../art/ailmentArt';
import { presentation } from '../presentation';
import { hex } from '../color';
import { surfDisc } from './paint';
import { Arrhythmia, ORGAN, betweenBeats, CollapsedLung, Trepanation, TAU, LarynxFold, humming, StomachLock, WaxClot, Artery } from '../../surgery/ailments/organs';

drawer(Arrhythmia, {
  draw(g, e, op) {
    g.arc(e.heart.x, e.heart.y, ORGAN.heartR, 2, hex(betweenBeats(op) ? '#9fd3a8' : '#ff5040', 0.35));
  },
});

drawer(CollapsedLung, {
  draw(g, e) {
    g.circleGrad(e.pos.x, e.pos.y, 34, hex(e.drawn ? '#c07070' : '#e0c0c0', 0.6), hex('#a05050', 0));
    g.line(e.a, e.b, 2, hex('#6a1010'));
  },
});

drawer(Trepanation, {
  draw(g, e, op) {
    // A disc of skull marked out for the trephine: the groove darkens and deepens as the turns
    // accumulate, pale bone dust thrown up at its lip; once cut through the disc sits loose in a
    // dark ring, and lifts with a shadow under it.
    const R = ORGAN.drillOuter - 10;
    const k = Math.min(1, (e.turns + e.acc / TAU) / ORGAN.drillTurns);
    const { x, y } = e.pos;
    if (e.loose) {
      g.circle(x, y, R + 3, hex('#1a0808', 0.85));
      g.circle(x + 4, y + 6, R, hex('#000000', 0.35));
    }
    const lift = e.loose ? -2 : 0;
    g.circleGrad(x - R * 0.25, y - R * 0.3 + lift, R * 1.05, hex('#efe6d2'), hex('#c8b89a'));
    g.circle(x, y + lift, R * 0.35, hex('#b8a584', 0.35));
    if (!e.loose) {
      // The groove: a darker band round the rim, as far round as the cutting has gone.
      g.arc(x, y, R, 3 + 3 * k, hex('#5a3a28', 0.35 + 0.5 * k), Math.max(0.02, k));
      g.arc(x, y, R + 4, 2, hex('#f4ecd8', 0.5 * k), Math.max(0.02, k));
      if (op.guides) g.arc(x, y, (ORGAN.drillInner + ORGAN.drillOuter) / 2, 1, hex('#ffebbe', 0.4));
    } else g.arc(x, y + lift, R, 1.5, hex('#8a7050', 0.8));
  },
});

drawer(LarynxFold, {
  draw(g, e, op) {
    const h = humming(op);
    g.line(e.a, e.b, 8, hex(h ? '#c07080' : '#a05060'));
    if (h) for (let i = 0; i < 3; i++) g.arc(e.pos.x, e.pos.y, 16 + i * 8 + ((op.elapsed * 30) % 8), 1, hex('#e0c0ff', 0.4));
  },
});

drawer(StomachLock, {
  draw(g, e) {
    g.rect(e.pos.x - 64, e.pos.y - 22, 128, 44, hex('#5a4a30'));
    for (const t of e.tumblers) {
      g.circle(t.pos.x, t.pos.y, 14, hex(t.locked ? '#c8a040' : '#8a7a60'));
      const a = (t.angle * Math.PI) / 180;
      g.line(t.pos, { x: t.pos.x + Math.cos(a) * 12, y: t.pos.y + Math.sin(a) * 12 }, 2, hex('#1a1008'));
      const m = (t.target * Math.PI) / 180;
      g.circle(t.pos.x + Math.cos(m) * 17, t.pos.y + Math.sin(m) * 17, 2, hex('#ffebbe'));
    }
  },
});

drawer(WaxClot, {
  draw(g, e) {
    g.circleGrad(e.pos.x, e.pos.y, 18, hex(e.soft ? '#e0b080' : '#f0e0c0'), hex('#8a6a40'));
  },
});

drawer(Artery, {
  surface(g, e) {
    surfDisc(g, e.pos, 20, 0.6, 0.2);
  },
  draw(g, e, op) {
    g.circle(e.pos.x, e.pos.y, 9, hex(e.clamped ? '#6a3030' : '#d02030'));
    if (e.clamped) g.rect(e.pos.x - 12, e.pos.y - 2, 24, 4, hex('#9aa0a6'));
    else {
      g.arc(e.pos.x, e.pos.y, 14, 2, hex('#ff5050', 0.5 + 0.4 * Math.sin(op.elapsed * 8)));
      // The severed vessel spurts on every heartbeat (ART-0192): 6 frames, one of three directions.
      if (presentation.gore < 2) spurtArt(g, e.pos, -Math.PI / 2 + ((e.id % 3) - 1) * 0.75, 70, op.beatPhase, e.id);
    }
  },
});
