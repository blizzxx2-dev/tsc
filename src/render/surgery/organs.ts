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
    g.circle(e.pos.x, e.pos.y, ORGAN.drillOuter - 10, hex(e.loose ? '#d8d0c0' : '#c8bca8'));
    g.arc(e.pos.x, e.pos.y, ORGAN.drillOuter - 10, 3, hex('#6a4a30'), (e.turns + e.acc / TAU) / ORGAN.drillTurns);
    if (op.guides && !e.loose) g.arc(e.pos.x, e.pos.y, (ORGAN.drillInner + ORGAN.drillOuter) / 2, 1, hex('#ffebbe', 0.4));
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
