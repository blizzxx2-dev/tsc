/** How the entities of `surgery/entities.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { surgicalFlapArt } from '../../art/surgicalFlap';
import { drawCoverage, drawStitch, surfDisc, surfLine } from './paint';
import { speciesOf } from '../../surgery/species';
import { poisonFor } from '../../content/poisons';
import { burnSeverity } from '../../art/burnGrades';
import { clamp, dist, type Vec } from '../../core/math';
import { drawBlotch, flinchCurl, presentation, shaftTwitch } from '../presentation';
import { hex, rgba } from '../color';
import type { Operation } from '../../surgery/operation';
import { DEFAULT_TUNING } from '../../surgery/tuning';
import { acidBurnArt, buboArt, escharFlakeArt, fangArt, fireBurnArt, glassArt, grubArt, hexfireEdgeArt, hexstoneArt, missileArt, powderArt, rotArt, shotArt, venomArt, woundArt } from '../../art/ailmentArt';
import { Incision, BloodPool, Laceration, Embedded, ROOT_LEN, hexagon, Wadding, Burn, Bubo, Rot, Venom, pointAlong, Grub, Sigil, SearedWord } from '../../surgery/entities';

// ============================================================ layer helpers

/** The heartbeat's bleed pulse (1 on the beat, decaying): wounds well in time with it. */
function beatPulse(op: Operation): number {
  return Math.exp(-op.beatPhase * 8);
}

/** Wound art is painted at full and reduced gore (browned, dimmer); minimal gore keeps the ink-black carve only. */
function woundAlpha(): number {
  return presentation.gore === 2 ? 0 : presentation.gore === 1 ? 0.55 : 1;
}

/** Fixed bubble spots inside a pus pool of radius r (a pattern, not noise: the same every frame). */
function pusBubbles(r: number): { x: number; y: number; r: number }[] {
  const n = Math.max(3, Math.min(9, Math.round(r / 5)));
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996;
    const d = r * 0.62 * Math.sqrt((i + 0.5) / n);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 2.5 + (i % 3) };
  });
}

function tracedPoints(e: Incision): Vec[] {
    const out = [e.points[0]];
    let acc = 0;
    for (let i = 1; i < e.points.length; i++) {
      const seg = dist(e.points[i - 1], e.points[i]);
      if (acc + seg >= e.progress) {
        out.push(e.pointAt(e.progress));
        break;
      }
      out.push(e.points[i]);
      acc += seg;
    }
    return out;
  }

drawer(Incision, {
  surface(g, e) {
    if (e.state === 'mark') {
      if (e.progress > 0 || e.depth > 0) surfLine(g, e.depth > 0 ? e.points : tracedPoints(e), 10 + e.depth * 4, 0.9, 0.3);
    } else {
      // Closing: each stitch draws the edges together, so the channel narrows and shallows.
      const k = e.stitch && e.stitch.needed > 0 ? Math.min(1, e.stitch.count / e.stitch.needed) : 0;
      surfLine(g, e.points, 12 * (1 - 0.45 * k), 1 - 0.65 * k, 0.45 * (1 - 0.5 * k), 0, 0.15);
    }
  },
  draw(g, e, op) {
    if (e.state === 'mark') {
      // The guide fades in; on Master (no guides) only the start and end nubs show.
      const a = Math.min(1, e.age / op.tuning.incision.guideFade);
      if (op.guides) g.dashed(e.points, 3, hex(e.depth > 0 ? '#ffd0a0' : '#ffebbe', 0.85 * a), 10, 9, -op.elapsed * 20);
      const end = e.points[e.points.length - 1];
      g.circle(e.points[0].x, e.points[0].y, 4, hex('#ffebbe', 0.7 * a));
      g.circle(end.x, end.y, 4, hex('#ffebbe', 0.7 * a));
      const head = e.pointAt(e.progress);
      g.glow(head.x, head.y, 22, hex('#ffe0a0', 0.35 * a));
      g.circle(head.x, head.y, 6 + Math.sin(op.elapsed * 6) * 2, hex('#ffebbe', 0.9 * a));
      // A layer already opened shows its cut edge under the next guide.
      if (e.depth > 0) woundArt(g, e.points, 5, { seed: e.id, alpha: woundAlpha() });
    } else {
      // The flesh shader carves the gash (surface layer); the cut-edge art paints skin lips, fat and the
      // bleeding edge over it, opening over 6 frames once the last layer is through.
      const open = e.openedAt < 0 ? 1 : Math.min(1, (op.elapsed - e.openedAt) / 0.5);
      // Deep-organ operations hold the incision wide with pinned skin flaps (ART-0189).
      if (op.fieldOrgan !== 'flesh' && op.fieldOrgan !== 'skin' && op.fieldOrgan !== 'muscle' && e.state === 'open') surgicalFlapArt(g, e.points, open, speciesOf(op.def.race).look.skin);
      const drawn = e.state === 'closing' && e.stitch && e.stitch.needed > 0 ? Math.min(1, e.stitch.count / e.stitch.needed) : 0;
      woundArt(g, e.points, 8 * (1 - 0.72 * drawn), { open, bleed: e.state === 'open' ? 0.6 : 0.25 * (1 - drawn), beat: beatPulse(op), seed: e.id, alpha: woundAlpha() });
      if (e.state === 'closing') g.dashed(e.points, 2, hex('#ffebbe', 0.35 + 0.2 * Math.sin(op.elapsed * 4)), 6, 10, op.elapsed * 10);
      if (e.stitch) drawStitch(g, e.stitch, op);
    }
  },
});

drawer(BloodPool, {
  fluid(g, e, op) {
    if (e.ichor === 'bonedust') return;
    const c = e.ichor === 'blood' ? rgba(255, 0, 0, 1) : e.ichor === 'pus' ? rgba(0, 255, 0, 1) : rgba(0, 0, 255, 1);
    const z = rgba(0, 0, 0, 0);
    const spread = Math.min(1, Math.floor(e.age * 16 + 1) / 8);
    const r = e.r * (0.35 + 0.65 * spread);
    let px = 0;
    let py = 0;
    if (e.drawFrom && op.elapsed - e.drawnAt < 0.25) {
      const d = Math.max(1, dist(e.drawFrom, e.pos));
      px = ((e.drawFrom.x - e.pos.x) / d) * r * 0.35;
      py = ((e.drawFrom.y - e.pos.y) / d) * r * 0.35;
    }
    const lobe = (dx: number, dy: number, rad: number, pull: number) => g.circleGrad(e.pos.x + dx + px * pull, e.pos.y + dy + py * pull, rad, c, z);
    // An irregular spill, not a disc: a smaller core with lobes of varied size scattered round it
    // (hashed per pool so each keeps its shape), and a run creeping downhill on most pools.
    const h = (i: number) => Math.abs(Math.sin(e.id * 91.7 + i * 17.3) * 43758.5453) % 1;
    const wob = (i: number) => Math.sin(op.elapsed * 0.7 + i) * 0.15;
    lobe(0, 0, r * 1.45, 0.3);
    const n = 5 + Math.floor(h(0) * 3);
    for (let i = 0; i < n; i++) {
      const a = h(i + 1) * Math.PI * 2 + wob(i);
      const d = r * (0.45 + 0.5 * h(i + 11));
      lobe(Math.cos(a) * d, Math.sin(a) * d * 0.85, r * (0.55 + 0.5 * h(i + 21)), 1);
    }
    if (e.id % 4 !== 0) {
      // The run: a narrowing trickle downhill, bending a little.
      const bend = (h(40) - 0.5) * 0.6;
      for (let i = 1; i <= 4; i++) lobe(Math.sin(bend * i) * r * 0.5 * i * 0.35, r * (0.55 + 0.42 * i), r * (0.75 - i * 0.13), 1);
    }
    if (e.id % 4 === 2) {
      // A splash: fine droplets flung round the rim.
      for (let i = 0; i < 7; i++) {
        const a = h(i + 50) * Math.PI * 2;
        const d = r * (1.35 + 0.5 * h(i + 60));
        lobe(Math.cos(a) * d, Math.sin(a) * d * 0.85, r * (0.22 + 0.12 * h(i + 70)), 1.2);
      }
    }
  },
  draw(g, e) {
    // Liquids render through the fluid layer (drawFluid); bone dust is a pale powder.
    if (e.ichor === 'bonedust') g.circleGrad(e.pos.x, e.pos.y, e.r * 1.3, hex('#e8e0d0', 0.7), hex('#e8e0d0', 0));
    // Colour-blind safe (GAM-0236): pus is marked by bubbles, not only by its yellow.
    if (e.ichor === 'pus') for (const b of pusBubbles(e.r)) g.arc(e.pos.x + b.x, e.pos.y + b.y, b.r, 1.5, hex('#fff8d8', 0.7));
  },
});

drawer(Laceration, {
  surface(g, e) {
    // The carved channel stays inside the painted lips, so its bevel never shows as a ring outside them.
    // Each stitch draws the edges together: the carved channel narrows and shallows with them.
    const k = e.stitch.needed > 0 ? Math.min(1, e.stitch.count / e.stitch.needed) : 0;
    surfLine(g, e.edge(), (e.small ? 6 : 9) * (1 - 0.45 * k), 1 - 0.65 * k, 0.5 * (1 - 0.5 * k), 0, 0.1);
  },
  draw(g, e, op) {
    // Carved by the flesh shader; the cut-edge art paints its lips and bleeding edge in three widths,
    // clean (blade) or ragged (claw), welling on the heartbeat until it is stitched.
    const closed = e.stitch.count >= e.stitch.needed;
    const drawn = e.stitch.needed > 0 ? Math.min(1, e.stitch.count / e.stitch.needed) : 0;
    const width = (e.small ? 4.5 : e.length < 50 ? 7 : 10) * (1 - 0.72 * drawn);
    woundArt(g, e.edge(), width, { claw: e.source === 'claw', bleed: closed ? 0 : Math.min(1, e.bleed), beat: beatPulse(op), seed: e.id, alpha: woundAlpha() });
    if (e.pusT > 0) g.polyline(e.edge(), 5, hex('#d8c040', Math.min(0.6, e.pusT / op.tuning.laceration.pusRotTime)));
    drawStitch(g, e.stitch, op);
    if (e.cov) drawCoverage(g, e.cov);
  },
});

drawer(Embedded, {
  surface(g, e) {
    surfDisc(g, e.origin, 11, 1, 0.5);
    surfDisc(g, e.origin, 38, 0, 0.25, 0, e.kind === 'hexstone' ? 0.2 : 0.35);
    if (e.kind === 'hexstone') surfDisc(g, e.origin, 50, 0, 0, 0.35);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const ca = Math.cos(e.angle);
    const sa = Math.sin(e.angle);
    // Entry wound.
    g.ellipse(e.origin.x, e.origin.y, 10, 7, e.angle, hex('#2a0306'), hex('#5a0a10'));
    if (e.barbed) {
      // The two nicks a barbed head needs (CON-0035): cut ones in blood, the ones still owed as faint ink ticks.
      for (let i = 0; i < 2; i++) {
        const a = e.angle + Math.PI / 2 + i * Math.PI;
        const tip = { x: e.origin.x + Math.cos(a) * 14, y: e.origin.y + Math.sin(a) * 14 };
        if (i < e.nicks) g.line(e.origin, tip, 3, hex('#8a1016'));
        else g.line({ x: e.origin.x + Math.cos(a) * 8, y: e.origin.y + Math.sin(a) * 8 }, { x: e.origin.x + Math.cos(a) * 18, y: e.origin.y + Math.sin(a) * 18 }, 1.5, hex('#2a1a10', 0.55));
      }
      if (e.nicks === 0) g.arc(e.origin.x, e.origin.y, 26, 2, hex('#ffebbe', 0.25 + 0.2 * Math.sin(op.elapsed * 4)));
    }
    // Pull-axis hint: shown with guides on; a fang's true angle only under the lens.
    const lensNear = op.tool === 'lens' && dist(op.cursor, e.origin) < op.tuning.lens.radius;
    if (!e.grabbed && e.spec.len > 0 && ((e.kind !== 'tooth' && op.guides) || lensNear)) {
      const ax = e.axis;
      const far = { x: e.origin.x + Math.cos(ax) * (e.spec.len + 40), y: e.origin.y + Math.sin(ax) * (e.spec.len + 40) };
      g.dashed([e.origin, far], 1.5, hex(lensNear ? '#b9d7ff' : '#ffebbe', 0.35), 5, 7, -op.elapsed * 10);
    }
    const entry = e.origin;
    switch (e.kind) {
      case 'arrow':
      case 'bolt': {
        // Painted missiles (ART-0195–0197): goose-fletched arrow, barbed head (nicked / torn states),
        // the square-headed quarrel and its leather-vaned variant. The part still in the flesh is hidden.
        const kind = e.kind === 'bolt' ? (e.id % 2 ? 'bolt-leather' : 'bolt') : e.barbed || e.nicks > 0 || e.tore ? 'barbed' : 'arrow';
        missileArt(g, { x, y }, e.grabbed ? e.angle : e.angle + shaftTwitch(presentation.pulse), e.spec.len, entry, { kind, wobble: e.grabbed ? 1 : 0, nicks: e.nicks, torn: e.tore && !e.snapped, snapped: e.snapped, seed: e.id });
        if (e.kind === 'bolt' && e.grabbed && !e.staged) {
          const f = dist(e.pos, e.origin) / e.spec.len;
          if (f > 0.3) g.arc(x, y, 18, 2, hex('#ffebbe', 0.6), Math.min(1, e.stillT / 0.3));
        }
        break;
      }
      case 'shot': {
        // Three calibres, a flattened ball every fourth, and powder tattooing round the entry.
        if (!e.grabbed) powderArt(g, entry, 26, { seed: e.id });
        const r = [5, 7, 9][e.id % 3];
        shotArt(g, { x, y }, r, { flattened: e.id % 4 === 3 ? 1 : 0, sunk: e.grabbed ? 0 : 0.45, seed: e.id });
        break;
      }
      case 'tooth': {
        // Gravehound canine, or a brood-spider fang with a venom-stained root on spider cases.
        const spider = /spider|brood/i.test(op.def.diagnosis ?? '');
        // A root left behind (CON-0057) is a short stub; a broken fang still whole wears a crack.
        fangArt(g, { x, y }, e.angle, e.rootOnly ? ROOT_LEN : Math.max(20, e.spec.len), entry, { spider, venom: spider || /venom/i.test(op.def.diagnosis ?? ''), seed: e.id });
        if (e.crowns > 0) g.line({ x: x - ca * 8 - sa * 5, y: y - sa * 8 + ca * 5 }, { x: x - ca * 12 + sa * 5, y: y - sa * 12 - ca * 5 }, 1.5, hex('#3a2a1a', 0.9));
        break;
      }
      case 'glass':
        glassArt(g, { x, y }, e.angle, e.spec.len, entry, { shape: e.id % 5, seed: e.id });
        g.setBlend('add');
        g.glow(x - ca * e.spec.len * 0.4, y - sa * e.spec.len * 0.4, 10, hex('#d8f0ff', 0.12 + 0.08 * Math.sin(op.elapsed * 2 + e.id)));
        g.setBlend('alpha');
        break;
      case 'hexstone':
        g.creature(3, x, y, 90, { seed: e.id, blend: 'add', intensity: e.calmed ? 0.35 : 1 });
        hexstoneArt(g, { x, y }, e.angle, e.spec.len, { crackle: e.grabbed ? 1 : Math.min(1, e.calmT * 2), stilled: e.calmed ? 1 : 0, seed: e.id });
        if (!e.calmed && e.calmT > 0) g.arc(e.origin.x, e.origin.y, 24, 3, hex('#ff9040'), e.calmT / 0.5);
        // Colour-blind safe (GAM-0236): hexstone wears a hexagon ring, so it never reads as a plain shard by hue alone.
        g.polyline(hexagon(e.origin, 17, op.elapsed * 0.6), 2, hex('#f8e0b0', 0.8));
        break;
      case 'token': {
        // A pewter hymn-token: a small disc stamped with the Choir's open mouth.
        g.circle(x, y, 10, hex('#8a8878'));
        g.circle(x, y, 8, hex('#b0ad98'));
        g.arc(x, y, 4, 1.5, hex('#4a4838'), 0.7);
        break;
      }
      case 'shard': {
        // A splinter of seam-stone: a faceted wedge split along its ridge, the lamp-side face lit,
        // the other in shade, a glint along the ridge and a contact shadow on the flesh.
        const L = e.spec.len;
        const tip = { x, y };
        const mid = { x: x - ca * L * 0.6, y: y - sa * L * 0.6 };
        const butt = { x: x - ca * (L + 3), y: y - sa * (L + 3) };
        const left = { x: mid.x - sa * 7, y: mid.y + ca * 7 };
        const right = { x: mid.x + sa * 7, y: mid.y - ca * 7 };
        const lampLeft = -sa * -0.5 + ca * -0.85 > 0;
        g.poly([tip, left, butt, right].map((p) => ({ x: p.x + 3, y: p.y + 4 })), hex('#000000', 0.32));
        g.poly([tip, left, butt], hex(lampLeft ? '#6a6e76' : '#23252a'), hex(lampLeft ? '#8a8f98' : '#15161a'));
        g.poly([tip, butt, right], hex(lampLeft ? '#23252a' : '#6a6e76'), hex(lampLeft ? '#15161a' : '#8a8f98'));
        g.line(tip, butt, 1.2, hex('#c8d0da', 0.55));
        g.polyline([tip, left, butt, right, tip], 1, hex('#0a0a0c', 0.7));
        break;
      }
    }
  },
});

drawer(Wadding, {
  draw(g, e) {
    g.ellipse(e.pos.x, e.pos.y, 7, 5, 0.4, hex('#b8a888'), hex('#6a5a40'));
  },
});

drawer(Burn, {
  surface(g, e) {
    const left = e.flakes.length / e.total;
    const healed = e.healed();
    const core = e.charCore ? 1 : 0;
    const char = Math.min(1, (0.3 + 0.7 * left + core * 0.4) * (1 - healed * 0.85));
    const r = e.radiusNow;
    // Inflamed halo, raw red bed, then a solid char core while eschar remains.
    surfDisc(g, e.pos, r * 1.7, 0, 0.3 * (1 - healed), 0, 0.45);
    surfDisc(g, e.pos, r * 1.25, 0, e.source === 'acid' ? 0.5 * (1 - healed) : 0.35 * (1 - healed), char * 0.6, 0);
    surfDisc(g, e.pos, r * 0.9, 0, 0, char * 0.7, 0);
    if (core) surfDisc(g, e.pos, e.radius * 0.45, 0, 0, 1, 0);
    // Dragon-breath craters deeper (ART-0208): the whole char bed sinks.
    if (e.source === 'dragon') surfDisc(g, e.pos, r * 0.85, 0.8, 0, 0.6, 0);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    // Burn decals (ART-0204–0206): fire by severity (reddened → blistered → charred) cooling as salve
    // takes; acid etched and bubbling until neutralised; hexfire's violet flame-edge.
    const cooled = e.healed();
    const left = e.flakes.length / e.total;
    if (e.source === 'acid') acidBurnArt(g, e.pos, e.radiusNow, e.acidLive ? 0 : 0.35 + 0.65 * cooled, e.id);
    // Severity from the shared grade table (GAM-0074), so the field matches the briefing chart.
    else fireBurnArt(g, e.pos, e.radiusNow, burnSeverity(e.grade, left), cooled, e.id, e.source === 'dragon' ? Math.max(0.001, e.heat(op.elapsed)) : 0);
    if (e.source === 'hexfire') {
      const heat = 0.35 + 0.65 * (1 - e.cov.fraction);
      hexfireEdgeArt(g, e.pos, e.radiusNow, e.smoulder >= 0 ? 0.5 + 0.5 * Math.abs(Math.sin(op.elapsed * 6)) : heat, e.id);
      g.creature(2, x, y - e.radiusNow * 0.3, e.radiusNow * 3, { seed: e.id, intensity: heat * 0.6, blend: 'add' });
    } else if (e.source === 'acid') g.glow(x, y, e.radiusNow * 1.1, hex(e.acidLive ? '#b8e040' : '#708040', 0.08 + (e.acidLive ? 0.04 * Math.sin(op.elapsed * 6) : 0)));
    else if (e.flakes.length) g.glow(x, y, e.radius * 0.9, hex('#ff5a1a', 0.04 + 0.025 * Math.sin(op.elapsed * 5 + e.id)));
    if (e.charCore) g.circleGrad(x, y, e.radius * 0.45, hex('#050302', 0.85), hex('#1a0e08', 0.2));
    for (const f of e.flakes) escharFlakeArt(g, f, 10, (f.x * 0.37 + f.y * 0.11) % 3, Math.round(f.x * 7 + f.y * 13) % 97);
    if (e.ember) {
      g.glow(e.ember.x, e.ember.y, 18, hex('#c060ff', 0.5 + 0.3 * Math.sin(op.elapsed * 9))); // curse-violet: hexfire is Malison-born
      g.circle(e.ember.x, e.ember.y, 4, hex('#f0c0ff'));
    }
    drawCoverage(g, e.cov, e.radiusNow);
  },
});

drawer(Bubo, {
  surface(g, self) {
    if (!self.lanced) {
      surfDisc(g, self.pos, self.r * 2.1, 0, 0.25, 0, 1);
      surfDisc(g, self.pos, self.r * 1.2, 0, 0.1, 0, 0.8);
    } else {
      surfDisc(g, self.pos, 14, 0.95, 0.4);
      surfDisc(g, self.pos, self.maxR * 1.3, 0, 0.4 * (1 - self.cov.fraction), 0, 0.35);
    }
  },
  draw(g, self, op) {
    const { x, y } = self.pos;
    if (!self.lanced) {
      // Swelling comes from the surface layer; the bubo art adds veins, the ripe head and a tension shine.
      const ripe = self.r / self.maxR;
      buboArt(g, self.pos, self.r * 0.8, { ripe, seed: self.id });
      if (ripe > 0.75) g.arc(x, y, self.r + 4, 2, hex('#ff503c', 0.4 + 0.4 * Math.sin(op.elapsed * 12)));
    } else {
      // Lanced: the crown splits (6 frames), then deflates once the pus is drawn off.
      const burst = self.openedAt < 0 ? 1 : Math.min(1, (op.elapsed - self.openedAt) / 0.5);
      const pus = op.entities.some((e) => e instanceof BloodPool && e.alive && e.ichor === 'pus' && dist(e.pos, self.pos) < 40);
      buboArt(g, self.pos, self.maxR * 0.6, { ripe: 0.6, burst, drained: pus ? 0 : 1, seed: self.id });
      drawCoverage(g, self.cov);
    }
  },
});

drawer(Rot, {
  surface(g, e) {
    for (const c of e.cov.cells) if (!c.done && e.active(c)) surfDisc(g, { x: e.pos.x + c.x, y: e.pos.y + c.y }, 16, 0, 0.12, 0.12, 0.05);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    // The necrotic decal grows through 4 stages with the patch and is scraped back as it is salved.
    rotArt(g, e.pos, e.r * 1.05, e.r / e.maxR, e.fraction, e.id);
    // Bubbling slows as the rot is salved away.
    const speed = 2 * (1 - e.fraction);
    for (const c of e.cov.cells) {
      if (c.done || !e.active(c)) continue;
      const w = Math.sin(op.elapsed * speed + c.x * 0.1 + c.y * 0.13) * 1.5;
      g.circleGrad(x + c.x, y + c.y, 16 + w, hex('#46582a', 0.35), hex('#46582a', 0));
    }
    // Sparse bubbles at jittered spots (not on the cell grid): each swells, glints and pops.
    for (const c of e.cov.cells) {
      if (c.done || !e.active(c)) continue;
      const h = Math.abs(Math.sin(c.x * 12.9898 + c.y * 78.233 + e.id) * 43758.5453) % 1;
      if (h > 0.3) continue;
      const life = (op.elapsed * (0.4 + 0.6 * h) * Math.max(0.2, speed / 2) + h * 7) % 1;
      const r = 1.5 + 3.5 * life * (0.6 + h);
      const bx = x + c.x + (h * 37 % 1 - 0.5) * 12;
      const by = y + c.y + (h * 53 % 1 - 0.5) * 12;
      g.circle(bx, by, r, hex('#2a3414', 0.55 * (1 - life * 0.5)));
      g.circle(bx - r * 0.35, by - r * 0.35, r * 0.3, hex('#d8e0a0', 0.5 * (1 - life)));
    }
    // The creeping edge (CON-0044): salved flesh beside the rot darkens as its regrowth comes due.
    const k = e.creep;
    if (k > 0.05) for (const c of e.frontier()) g.circleGrad(x + c.x, y + c.y, 4 + 8 * k, hex('#46582a', 0.55 * k), hex('#46582a', 0));
  },
});

drawer(Venom, {
  surface(g, e) {
    surfDisc(g, e.pos, e.spreadR * 1.5 + 26, 0, 0.55, 0.12, 0.35);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const look = poisonFor(e.color, e.poison);
    const ink = look.ink;
    // The spreading vein web, fading as the tincture takes hold.
    venomArt(g, e.pos, e.spreadR * 1.5 + 24, Math.min(1, e.holdT / op.tuning.tincture.antivenomHold), look.stain, e.id);
    for (const v of e.veins) {
      const pts: Vec[] = [{ x, y }];
      const r = e.spreadR * v.l;
      for (let s = 1; s <= 6; s++) {
        const t = s / 6;
        const wob = Math.sin(t * 9 + v.a * 3) * 8 * t;
        pts.push({ x: x + Math.cos(v.a) * r * t - Math.sin(v.a) * wob, y: y + Math.sin(v.a) * r * t + Math.cos(v.a) * wob });
      }
      g.polyline(pts, 3, hex(ink, 0.8));
    }
    // The vein to the heart, and any motes on it.
    g.polyline(e.vein, 2, hex(ink, 0.35));
    if (e.ligature !== Infinity) {
      const p = pointAlong(e.vein, e.ligature);
      g.circle(p.x, p.y, 5, hex('#efe6c4'));
    }
    const moteCol = look.mote;
    for (const m of e.motes) {
      const p = e.motePos(m);
      g.glow(p.x, p.y, 14, hex(moteCol, 0.5));
      g.circle(p.x, p.y, 4, hex(moteCol));
    }
    g.circle(x, y, 10, hex(look.core));
    // Twin puncture marks.
    g.circle(x - 5, y, 3, hex('#000000'));
    g.circle(x + 5, y, 3, hex('#000000'));
    if (e.holdT > 0) g.arc(x, y, 20, 3, hex('#9fd3a8'), e.holdT / 0.9);
    else g.arc(x, y, 20 + Math.sin(op.elapsed * 5) * 2, 2, hex('#a0dcaa', 0.4));
    if (e.color === 'green') for (let i = 0; i < 3; i++) g.circle(x - 14 + i * 14, y + 16, 2, hex('#90e060', 0.8));
  },
});

drawer(Grub, {
  draw(g, e, op) {
    const puff = e.heat > 0.15 && e.heat < 0.4 ? 1.25 : 1;
    if (presentation.creatureFilter) return drawBlotch(g, e.pos.x, e.pos.y, e.small ? 9 : 14);
    const s = (e.small ? 0.65 : 1) * puff;
    // Burrow-in over the last 0.8 s before it digs under (lens cases), burrow-out for 0.6 s once found.
    const G = op.tuning.grub;
    let burrow = 0;
    if (op.def.tools.includes('lens') && e.heat === 0 && !e.grabbed) burrow = clamp((e.sinceSurface - (G.burrowAfter - 0.8)) / 0.8, 0, 1);
    if (e.revealedAt >= 0) burrow = Math.max(burrow, 1 - (op.elapsed - e.revealedAt) / 0.6);
    grubArt(g, e.pos, e.heading, 34 * s, { burrowed: clamp(burrow, 0, 0.98), squirm: Math.max(e.grabbed ? 1 : 0, flinchCurl(op.elapsed - (presentation.flinch.get(e) ?? -9))), heat: Math.min(1, e.heat * 1.5), seed: e.id });
    if (e.heat > 0) {
      const need = DEFAULT_TUNING.brand.grubHold * (e.small ? 0.5 : 1);
      g.glow(e.pos.x, e.pos.y, 26, hex('#ff9040', Math.min(1, e.heat)));
      g.arc(e.pos.x, e.pos.y, 16, 3, hex('#ff9040'), e.heat / need);
    }
  },
});

drawer(Sigil, {
  surface(g, e) {
    for (const sg of e.segs) {
      const n = sg.burned.length;
      for (let i = 0; i < n; i++) {
        if (!sg.burned[i]) continue;
        const p0 = { x: sg.a.x + ((sg.b.x - sg.a.x) * i) / n, y: sg.a.y + ((sg.b.y - sg.a.y) * i) / n };
        const p1 = { x: sg.a.x + ((sg.b.x - sg.a.x) * (i + 1)) / n, y: sg.a.y + ((sg.b.y - sg.a.y) * (i + 1)) / n };
        surfLine(g, [p0, p1], 10, 0.15, 0, 1);
      }
    }
    surfDisc(g, e.pos, e.size * 1.3, 0, 0.2, 0, 0.2);
  },
  draw(g, e, op) {
    // Glow states (ART-0220): dormant strokes a faint violet; the stroke being drawn on — and the whole
    // sigil as its next lash nears — pulses violet as it drains the patient; seared strokes flare
    // white-gold and cool over 0.8 s to a charred gold scar (the searing-out animation).
    const glow = 0.6 + 0.4 * Math.sin(op.elapsed * 3 + e.id);
    const lashNear = Math.max(0, (e.lashT / e.lashEvery - 0.7) / 0.3);
    const drain = 0.5 + 0.5 * Math.sin(op.elapsed * (6 + lashNear * 10));
    g.glow(e.pos.x, e.pos.y, e.size * 1.4, hex('#b060ff', 0.12 * glow + 0.18 * lashNear * drain)); // curse-violet: curse sigil
    const cur = e.current;
    // Each stroke is a brand scored into the flesh: a bruised, sunken groove drawn whole (not as
    // dashes), with violet heat glowing up out of it; seared cells are drawn over it as they burn.
    // Whole strokes as one polyline each, so the joints don't stack caps into bright beads.
    for (let si = 0; si < e.strokeCount; si++) {
      const segs = e.segs.filter((sg) => sg.stroke === si);
      if (!segs.length) continue;
      const path = [segs[0].a, ...segs.map((sg) => sg.b)];
      const dormant = si > cur;
      const draining = si === cur;
      const k = draining ? 0.55 + 0.45 * drain : dormant ? 0.35 * glow + 0.3 * lashNear * drain : glow;
      g.strokePath(path, 9, hex('#2a0a24', 0.45));
      g.strokePath(path.map((p) => ({ x: p.x + 0.8, y: p.y + 1.2 })), 3.4, hex('#12040e', 0.7));
      g.setBlend('add');
      g.strokePath(path, draining ? 12 : 8, hex('#7a30d0', (draining ? 0.3 : 0.14) * k)); // curse-violet: curse sigil glow
      g.strokePath(path, 2, hex('#d8a8ff', (draining ? 0.85 : 0.45) * k)); // curse-violet: curse sigil core
      g.setBlend('alpha');
    }
    for (const s of e.segs) {
      const n = s.burned.length;
      for (let i = 0; i < n; i++) {
        if (!s.burned[i]) continue;
        const p0 = { x: s.a.x + ((s.b.x - s.a.x) * i) / n, y: s.a.y + ((s.b.y - s.a.y) * i) / n };
        const p1 = { x: s.a.x + ((s.b.x - s.a.x) * (i + 1)) / n, y: s.a.y + ((s.b.y - s.a.y) * (i + 1)) / n };
        const cool = s.searedAt[i] < 0 ? 1 : Math.min(1, (op.elapsed - s.searedAt[i]) / 0.8);
        g.line(p0, p1, 7, hex('#1e120c'));
        g.line(p0, p1, 2.2, hex(cool < 1 ? '#fff0b0' : '#b8862a', 0.55 + 0.45 * (1 - cool)));
        if (cool < 1) {
          g.setBlend('add');
          g.line(p0, p1, 12 * (1 - cool) + 4, hex('#ffb040', 0.5 * (1 - cool)));
          g.setBlend('alpha');
        }
      }
    }
    // Numbered nodes (guides): the next stroke's node pulses.
    e.nodes.forEach((nd, i) => {
      if (e.strokeDone(i)) return;
      const next = i === cur;
      // Numbered ink dots on the first tries only (CON-0051); after that, only the next stroke's node pulses.
      const numbers = op.strokeNumbers;
      if (!numbers && !next) return;
      // A small ink-ringed node; the next one glows, the rest stay quiet.
      g.circle(nd.x, nd.y, next ? 8 : 6, hex('#1a0816', 0.6));
      g.circle(nd.x, nd.y, next ? 6.5 : 4.5, hex(next ? '#f0d0ff' : '#b890d0', next ? 0.55 + 0.35 * Math.sin(op.elapsed * 6) : 0.4));
      if (numbers) g.text(String(i + 1), nd.x + 10, nd.y - 7, { size: 13, font: 'italic', color: hex('#e8d0f0', 0.75), align: 'center', shadow: hex('#000000', 0.7) });
      if (next && e.nodeT > 0) g.arc(nd.x, nd.y, 13, 3, hex('#ff9040'), e.nodeT / 1);
    });
    g.arc(e.pos.x, e.pos.y, e.size * 0.25, 3, hex('#c88cff', 0.5), e.lashT / e.lashEvery); // curse-violet: curse sigil
  },
});

drawer(SearedWord, {
  draw(g, e) {
    const k = Math.min(1, e.age / 1.5);
    g.text(e.word, e.pos.x, e.pos.y + 8, { size: 34, font: 'display', color: hex('#2a0806', 0.75 * k), align: 'center', tracking: 0.3, shadow: false });
    g.text(e.word, e.pos.x, e.pos.y + 7, { size: 34, font: 'display', color: hex('#ff8040', 0.25 * (1 - k) + 0.05), align: 'center', tracking: 0.3, shadow: false });
  },
});
