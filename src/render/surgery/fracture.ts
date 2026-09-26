/** How the entities of `surgery/ailments/fracture.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { dist } from '../../core/math';
import { boneChipsArt, boneFragmentArt, drawBoneView, splintArt } from '../../art/boneView';
import { hex } from '../color';
import type { Gfx } from '../gfx';
import { angleDiff, surfDisc } from '../../surgery/entities';
import { PIN_HOLD } from '../../surgery/operation';
import { Fracture, FRACTURE, RAD, BoneSplinter, Splint, SplintWrap } from '../../surgery/ailments/fracture';

/**
* The bone-setting HUD (UIX-0193): while a fragment is held, an alignment gauge (how far it sits
* from home, green inside the COOL tolerance) and a guide arc from its angle to the one it wants;
* once every piece is roughly set, a ghost of the splint that will go on.
*/
function drawGuides(self: Fracture, g: Gfx): void {
    const f = self.held;
    if (f && !f.set) {
      const d = dist(f.pos, f.target);
      const a = angleDiff(f.rot, f.targetRot);
      const ok = (v: number, cool: number, good: number) => (v <= cool ? '#9fd3a8' : v <= good ? '#f0d070' : '#e07050');
      // Gauge: two short bars over the fragment, distance and angle, full when home.
      const gx = f.pos.x - 30;
      const gy = f.pos.y - 44;
      g.rect(gx, gy, 60, 5, hex('#000000', 0.5));
      g.rect(gx, gy, 60 * Math.max(0, 1 - d / 40), 5, hex(ok(d, FRACTURE.coolPx, FRACTURE.goodPx)));
      g.rect(gx, gy + 8, 60, 5, hex('#000000', 0.5));
      g.rect(gx, gy + 8, 60 * Math.max(0, 1 - a / 35), 5, hex(ok(a, FRACTURE.coolDeg, FRACTURE.goodDeg)));
      // Guide arc: from where it points to where it should, round its middle.
      let turn = f.targetRot - f.rot;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      if (Math.abs(turn) > FRACTURE.coolDeg * RAD) g.arc(f.pos.x, f.pos.y, FRACTURE.segLen / 2 + 8, 2, hex(ok(a, FRACTURE.coolDeg, FRACTURE.goodDeg), 0.8), Math.abs(turn) / (Math.PI * 2), Math.min(f.rot, f.rot + turn));
      // And the home it's heading for.
      g.circle(f.target.x, f.target.y, 4, hex('#f4ecd8', 0.6));
    }
    if (self.roughlyAligned && self.pinned === 0) {
      const first = self.fragments[0];
      const last = self.fragments[self.fragments.length - 1];
      g.line(self.end(first.target, first.targetRot, -1), self.end(last.target, last.targetRot, 1), 34, hex('#d8ceb4', 0.14));
    }
  }

drawer(Fracture, {
  surface(g, self) {
    surfDisc(g, self.pos, FRACTURE.segLen * self.fragments.length * 0.6, 0, 0.25, 0.05, 0.4);
  },
  draw(g, self, op) {
    // The vellum anatomy plate (ENG-0273): the inked bone, its breaks and, with guides on, where each fragment goes.
    drawBoneView(g, self, op.elapsed, op.guides);
    // Fracture sprites (ART-0223): broken ends jagged where fragments meet, chips round a comminuted
    // break, and a compound fracture's end through the skin until it is set.
    const n = self.fragments.length;
    self.fragments.forEach((f, i) => {
      boneFragmentArt(g, f.pos, f.rot, FRACTURE.segLen, { brokenA: i > 0, brokenB: i < n - 1, set: f.set, protrude: self.compound && i === n - 1 && !f.set, seed: i });
      if (self.held === f) g.glow(f.pos.x, f.pos.y, 30, hex('#ffe0a0', 0.3));
      // A pinned grip (INP-0107): the seconds it has left, as a ring round the fragment.
      if (self.held === f && op.pinned?.e === self) g.arc(f.pos.x, f.pos.y, 34, 3, hex('#e8dcc0', 0.8), op.pinned.t / PIN_HOLD);
    });
    if (n >= 4) for (let i = 1; i < n; i++) if (!(self.fragments[i - 1].set && self.fragments[i].set)) boneChipsArt(g, self.pins[Math.min(self.pins.length - 1, i - 1)] ?? self.pos, 3, i);
    if (self.roughlyAligned)
      self.pins.forEach((q, i) => {
        const done = i < self.pinned;
        g.circle(q.x, q.y, done ? 5 : 8, hex(done ? '#9aa0a6' : '#ffebbe', done ? 1 : 0.5 + 0.4 * Math.sin(op.elapsed * 6)));
        if (!done && op.guides) g.text(String(i + 1), q.x, q.y + 5, { size: 12, color: hex('#20100a'), align: 'center', shadow: false });
      });
    if (self.compound && !self.aligned) g.arc(self.pos.x, self.pos.y, 30, 2, hex('#ff8060', 0.4));
    drawGuides(self, g);
  },
});

drawer(BoneSplinter, {
  draw(g, e) {
    g.line({ x: e.pos.x - 6, y: e.pos.y - 2 }, { x: e.pos.x + 6, y: e.pos.y + 2 }, 3, hex('#efe8d8'));
  },
});

drawer(Splint, {
  draw(g, e) {
    splintArt(g, e.a, e.b);
  },
});

drawer(SplintWrap, {
  draw(g, e, op) {
    splintArt(g, e.a, e.b, e.bound);
    e.bound.forEach((done, i) => {
      const c = e.bandAt(i);
      if (!done) g.circle(c.x, c.y, 6, hex('#ffebbe', 0.35 + 0.3 * Math.sin(op.elapsed * 5 + i)));
    });
  },
});
