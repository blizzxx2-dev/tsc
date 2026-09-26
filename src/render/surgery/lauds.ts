/** How the entities of `surgery/lauds.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { FIELD, type Operation } from '../../surgery/operation';
import type { Gfx } from '../gfx';
import type { Vec } from '../../core/math';
import { eggSacArt } from '../../art/ailmentArt';
import { drawBlotch, presentation } from '../presentation';
import { hex } from '../color';
import { dawnFlare, flareIntensity, laudsChoir, lightThread, THREAD_SEVER_S, THREAD_TIE_S } from '../../art/bossVfx';
import { surfDisc } from './paint';
import { LaudsMalison, DawnOverlay, LaudsBody, LightThread, ChoirVoice, VOICE_SIGIL, VOICE_SAMPLES, EggSac, SpiderlingGrub, TAU } from '../../surgery/lauds';


/** Lauds's dawn flare and its horizon glow (drawn even while the core is hidden, by the thread-less overlay). */
export function drawDawn(g: Gfx, l: LaudsMalison, op: Operation): void {
    if (l.phase.key !== 'dawn') return;
    // Flash intensity slider (GAM-0239, BOS-0038): the dawn flare and its horizon glow scale with it.
    const soften = presentation.flash;
    // The dawn flare (ART-0238, docs/art/vfx/dawn-flare.md): a horizon glow foretells it, then a gold bloom burst whites out the Lens.
    const tellK = l.flare.telling ? Math.min(1, (l.flare.t - (l.tune.flareEvery - l.flare.lead)) / l.flare.lead) : 0;
    const k = l.flareT > 0 ? flareIntensity(l.tune.flareFor - l.flareT, l.tune.flareFor) : 0;
    if (tellK > 0 || k > 0) dawnFlare(g, { x: -400, y: -400, w: 2080, h: 1520 }, { x: FIELD.cx, y: FIELD.cy - FIELD.ry }, k, tellK, soften, op.tool === 'lens' ? op.pointer : undefined);
    // Ripples where it swims (the Lens finds them).
    if (l.submerged && op.tool === 'lens' && !l.blinded) {
      const r = 20 + ((op.elapsed * 30) % 30);
      g.arc(l.pos.x, l.pos.y, r, 1.5, hex('#b9d7ff', 0.25 * (1 - (r - 20) / 30)));
    }
  }

drawer(LaudsMalison, {
  surface(g, e) {
    if (!e.submerged) surfDisc(g, e.pos, e.radius * 1.9, 0.05, 0.35, 0.1, 0.7);
    else surfDisc(g, e.pos, 46, 0, 0.1, 0.05, 0.9);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    if (e.hymnTelling) {
      // Hymn tell: the ring's outline shimmers before it expands.
      const k = 0.5 + 0.5 * Math.sin(op.elapsed * 30);
      g.arc(x, y, e.tune.ringRadius * 0.35, 2, hex('#f0d8ff', 0.25 + 0.35 * k));
    }
    if (e.hymnR >= 0) {
      const a = Math.max(0, 1 - e.hymnR / (e.tune.ringRadius * 2.1));
      g.arc(x, y, e.hymnR, 14, hex('#d8b0ff', 0.1 * a));
      g.arc(x, y, e.hymnR, 3, hex('#f0d8ff', 0.7 * a));
    }
    const bare = e.phase.key !== 'call' || e.livingVoices.length === 0;
    g.glow(x, y, e.radius * 2.8, hex(bare ? '#ff9050' : '#c0a0ff', 0.25));
    g.creature(1, x, y, e.radius * 4, { seed: e.id, open: bare ? 1 : 0, health: e.frac, flash: e.hurtFlash });
    if (e.phase.key === 'call' && bare) g.arc(x, y, e.radius + 16, 3, hex('#ff8040'), 1 - e.bareT / e.tune.exposure);
    if (e.phase.key === 'response' && e.partner) laudsChoir(g, x, y, e.radius, e.choirState('core', op), op.elapsed, e.partner.pos);
    if (e.pending && e.pending.from === 'core') g.arc(x, y, e.radius + 20, 3, hex('#ffe0a0'), e.pending.t / e.tune.response);
    g.arc(x, y, e.radius + 10, 3, hex('#b478ff', 0.7), e.frac);
  },
});

drawer(DawnOverlay, {
  draw(g, e, op) {
    drawDawn(g, e.core, op);
  },
});

drawer(LaudsBody, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    g.glow(x, y, e.radius * 2.6, hex('#ffb070', 0.22));
    g.creature(1, x, y, e.radius * 4, { seed: e.id + 7, open: 1, health: e.core.frac, flash: e.core.hurtFlash });
    laudsChoir(g, x, y, e.radius, e.core.choirState('partner', op), op.elapsed + 0.37, e.core.pos);
    const p = e.core.pending;
    if (p && p.from === 'partner') g.arc(x, y, e.radius + 20, 3, hex('#ffe0a0'), p.t / e.core.tune.response);
  },
});

drawer(LightThread, {
  draw(g, e, op) {
    const pa = e.a.pos;
    const pb = e.b.pos;
    if (e.unlinkT > 0) {
      // Severed (ART-0237): the halves recoil, a ghost line waits, then the ends reach back and knot.
      const k = e.unlinkT / e.a.tune.unlink;
      const since = e.a.tune.unlink - e.unlinkT;
      g.dashed([pa, pb], 1.5, hex('#e0c0ff', 0.25 * (1 - k) + 0.05), 6, 10);
      if (since < THREAD_SEVER_S) lightThread(g, pa, pb, op.elapsed, { bright: 0.75, sever: since / THREAD_SEVER_S, tie: null });
      else if (e.unlinkT < THREAD_TIE_S) lightThread(g, pa, pb, op.elapsed, { bright: 0.75, sever: null, tie: 1 - e.unlinkT / THREAD_TIE_S });
      return;
    }
    const tellK = e.dim.telling ? 0.5 + 0.5 * Math.sin(op.elapsed * 20) : 0;
    const bright = e.dimmed ? 0.18 : 0.75 - 0.3 * tellK;
    lightThread(g, pa, pb, op.elapsed, { bright, sever: null, tie: null });
    // The response window, as an arc filling between the bodies.
    const p = e.a.pending;
    if (p) {
      const k = 1 - p.t / e.a.tune.response;
      const from = p.from === 'core' ? pa : pb;
      const to = p.from === 'core' ? pb : pa;
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 60 };
      const pts: Vec[] = [];
      for (let i = 0; i <= 16 * k; i++) {
        const t = i / 16;
        pts.push({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x, y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y });
      }
      if (pts.length > 1) g.polyline(pts, 3, hex('#ffe0a0', 0.8));
    }
  },
});

drawer(ChoirVoice, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const glow = 0.6 + 0.4 * Math.sin(op.elapsed * 8 + e.id);
    g.glow(x, y, 38, hex('#c890ff', 0.35 * glow));
    const pts = VOICE_SIGIL.map((p) => ({ x: x + p.x, y: y + p.y }));
    g.polyline(pts, 3, hex('#e0c0ff', glow));
    for (let i = 0; i < VOICE_SAMPLES.length; i++) if (e.covered[i]) g.circle(x + VOICE_SAMPLES[i].x, y + VOICE_SAMPLES[i].y, 2.5, hex('#ffb060', 0.95));
    g.circle(x, y, 3 + 2 * glow, hex('#20082a'));
  },
});

drawer(EggSac, {
  surface(g, e) {
    surfDisc(g, e.pos, 34 + 8 * e.swell, 0, 0.1, 0, 0.8 + 0.2 * e.swell);
  },
  draw(g, e) {
    const { x, y } = e.pos;
    const urgency = Math.max(0, 1 - e.hatchT / e.hatchIn);
    if (presentation.creatureFilter) return drawBlotch(g, x, y, 22);
    const s = 1 + 0.25 * e.swell;
    // Painted sac (ART-0216): translucent, embryos stirring, pulsing faster as it swells; the last
    // 0.6 s before hatching plays the 8-frame hatch as the brood breaks through.
    eggSacArt(g, e.pos, 22 * s, { swell: e.swell, hatch: Math.max(0, Math.min(1, 1 - e.hatchT / 0.6)), seed: e.id });
    g.arc(x, y, 30 * s, 2, hex('#e05040', 0.3 + 0.5 * urgency), Math.max(0, e.hatchT) / e.hatchIn);
  },
});

drawer(SpiderlingGrub, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    if (presentation.creatureFilter) return drawBlotch(g, x, y, 9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.sin(op.elapsed * 20 + i) * 0.2;
      g.line({ x, y }, { x: x + Math.cos(a) * 11, y: y + Math.sin(a) * 11 }, 1.5, hex('#1a1410'));
    }
    g.circle(x, y, 6, hex('#2a2018'));
    g.circle(x, y - 2, 2, hex('#e04030', 0.8));
    if (e.heat > 0) g.arc(x, y, 15, 3, hex('#ff9040'), e.heat / 0.25);
  },
});
