/** How the entities of `surgery/malison.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { presentation } from '../presentation';
import { surfDisc } from './paint';
import { threadKnotArt } from '../../art/ailmentArt';
import { Malison, TAU, MalisonShard, MalisonAsh } from '../../surgery/malison';

drawer(Malison, {
  surface(g, e) {
    // The curse's corruption spreads through the flesh as it is wounded (BOS-0019).
    surfDisc(g, e.pos, e.radius * 1.8 + (1 - e.frac) * 140, 0.1, 0.4, 0.15, 0.6);
  },
  draw(g, e, op) {
    const r = e.radius;
    // Opening tell: the shroud trembles, and peels to an inner red glow.
    const tellK = !e.open && e.opening.telling ? Math.min(1, (e.opening.t - (e.tune.veil - e.opening.lead)) / e.opening.lead) : 0;
    const x = e.pos.x + (tellK > 0 ? Math.sin(op.elapsed * 55) * 2.5 * tellK : 0);
    const y = e.pos.y + (tellK > 0 ? Math.cos(op.elapsed * 47) * 1.5 * tellK : 0);
    let openness = e.open ? Math.min(1, e.cycleT * 4) : tellK * 0.25;
    if (e.eyeOut) {
      const b = e.beat;
      const within = e.eyeT % e.tune.beat;
      openness = b === 3 ? 1 : b === 0 ? 0.1 : 0.3 + 0.3 * Math.exp(-within * 6) * b;
      if (e.gaze) openness *= 0.6 + 0.4 * (e.gaze.t / 1); // the iris contracts
    }
    // The opening flash follows the flash-intensity slider (GAM-0239); shakes go through op.shake × the shake slider.
    const fl = presentation.flash;
    g.glow(x, y, r * 2.6, hex(e.vulnerable ? '#ff6030' : '#8030c0', 0.22 * (e.vulnerable ? fl : 1)));
    if (tellK > 0) g.glow(x, y, r * 1.6, hex('#ff2010', 0.35 * tellK * fl));
    g.creature(0, x, y, r * 4.4, { seed: e.id * 1.3, open: openness, health: e.frac, flash: e.hurtFlash });
    // Rend tell: the shroud's edge sharpens into hooks.
    if (e.rendTelling) {
      const k = Math.min(1, (e.rendT - (e.rendEvery - 0.8)) / 0.3);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + op.elapsed * 0.6;
        const p0 = { x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9 };
        const p1 = { x: x + Math.cos(a + 0.18) * (r + 16 * k), y: y + Math.sin(a + 0.18) * (r + 16 * k) };
        const p2 = { x: x + Math.cos(a + 0.34) * (r + 8 * k), y: y + Math.sin(a + 0.34) * (r + 8 * k) };
        g.polyline([p0, p1, p2], 2.5, hex('#1a0820', 0.9 * k));
      }
    }
    // The gaze line, tightening as it locks.
    if (e.gaze) {
      const end = e.gazeEnd()!;
      const k = 1 - e.gaze.t;
      g.dashed([e.pos, end], 2 + 3 * k, hex('#ff3020', 0.35 + 0.5 * k), 10, 8, op.elapsed * 60);
    }
    // Beats of the eye: three pips, the third gilt.
    if (e.eyeOut) {
      for (let i = 1; i <= 3; i++) {
        const lit = e.beat >= i || e.beat === 0 ? e.beat !== 0 && e.beat >= i : false;
        g.circle(x - 16 + (i - 1) * 16, y - r - 22, lit ? 5 : 3.5, hex(i === 3 ? '#ffd070' : '#e08060', lit ? 0.95 : 0.35));
      }
    }
    g.arc(x, y, r + 14, 3, e.vulnerable ? hex('#ff8040', 0.9) : hex('#b478ff', 0.5), e.frac);
  },
});

drawer(MalisonShard, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const flick = 0.6 + 0.4 * Math.sin(op.elapsed * 15 + e.id);
    g.glow(x, y, 40, hex(e.mode === 'crawler' ? '#ff5060' : '#b060ff', 0.3 + 0.1 * flick));
    // A knot of curse-thread (ART-0228): three knot shapes, drifting; its burst plays in the scene's VanishFx.
    threadKnotArt(g, e.pos, 14, { shape: e.id % 3, crawler: e.mode === 'crawler', seed: e.id });
    if (e.mode === 'fragment') g.arc(x, y, 24, 3, hex('#ffc878', 0.7), e.life / 9);
  },
});

drawer(MalisonAsh, {
  draw(g, e) {
    g.creature(e.mode, e.pos.x, e.pos.y, e.r * 4.4, { seed: e.id, dissolve: Math.min(1, e.t / 1.2), health: 0.6 });
  },
});
