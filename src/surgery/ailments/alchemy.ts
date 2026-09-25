import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { pointAlong, polyLength, surfDisc, Venom } from '../entities';
import { Entity } from '../entity';
import { TINCTURE_HEX, type Operation } from '../operation';
import type { TinctureColor } from '../progress';
import type { Pointer, ToolId } from '../types';

export const ALCHEMY = {
  corrodeAfter: 1,
  corrodeFor: 6,
  neutralise: 0.7,
  drainOff: 1,
  acidDrain: 0.5,
  moteEvery: 3,
  moteSpeed: 30,
  moteHurt: 8,
  moteHit: 16,
  wrongSpeedup: 1.3,
  poisonDrain: 0.25,
  gasVent: 1,
  hazeTime: 4,
  gasR: 26,
};

/**
 * An alchemist's acid pool. Any instrument that sits in it for more than a
 * second corrodes (useless for 6 s). Neutralise it first by injecting amber
 * tincture into it; then the leech-pipe can draw it off.
 */
export class AlchemicalAcid extends Entity {
  neutralised = false;
  private touch = new Map<ToolId, number>();
  private suck = 0;
  noun = 'the acid';

  constructor(
    pos: Vec,
    public r = 36,
  ) {
    super(pos);
    this.layer = 4;
  }

  override wants(): readonly ToolId[] {
    return this.neutralised ? ['leech'] : ['tincture'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.r + pad;
  }

  override drain(): number {
    return ALCHEMY.acidDrain;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (dist(ptr.pos, this.pos) > this.r) return;
    if (this.neutralised) {
      if (tool !== 'leech') return;
      this.suck += dt;
      if (this.suck >= ALCHEMY.drainOff) {
        this.kill();
        op.cues.push('squelch');
        op.rate('good', this.pos, 'Acid drawn');
      }
      return;
    }
    if (tool === 'tincture' && op.tinctureColor === 'amber') return; // the injection handles it
    const t = (this.touch.get(tool) ?? 0) + dt;
    this.touch.set(tool, t);
    if (t > ALCHEMY.corrodeAfter) {
      this.touch.set(tool, 0);
      op.disableTool(tool, ALCHEMY.corrodeFor);
      op.rate('bad', ptr.pos, 'Corroded');
      op.sayOnce('acid-corrode', 'The acid’s eaten the instrument! Amber tincture into the pool first — it kills the acid.', 'danger');
    }
  }

  /** Called by the operation when a tincture is injected. */
  onTincture(op: Operation, c: TinctureColor, p: Vec): void {
    if (this.neutralised || c !== 'amber' || dist(p, this.pos) > this.r) return;
    this.neutralised = true;
    op.rate('good', this.pos, 'Neutralised');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.r * 1.4, 0.3, 0.4, 0.2, 0);
  }

  draw(g: Gfx, op: Operation): void {
    g.circleGrad(this.pos.x, this.pos.y, this.r, hex(this.neutralised ? '#a0a070' : '#c0f040', 0.8), hex('#406010', 0.3));
    if (!this.neutralised) for (let i = 0; i < 4; i++) g.circle(this.pos.x + Math.sin(op.elapsed * 3 + i * 2) * this.r * 0.5, this.pos.y + Math.cos(op.elapsed * 2 + i) * this.r * 0.4, 3, hex('#f0ffb0', 0.7));
  }
}

interface ColourMote {
  s: number;
  colour: TinctureColor;
  speed: number;
  alive: boolean;
}

const MOTE_COLOURS: readonly TinctureColor[] = ['green', 'blue', 'amber'];

/**
 * A compound poison: motes of three colours race along the vein to the heart.
 * Tap each with the tincture of its colour (COOL); the wrong colour is BAD and
 * speeds the mote up 30 %. Clears once the poison has spent its motes.
 */
export class CompoundPoison extends Entity {
  motes: ColourMote[] = [];
  readonly vein: Vec[];
  readonly veinLen: number;
  private moteT = 0;
  remaining: number;
  noun = 'the poison';

  constructor(
    pos: Vec,
    op: Operation,
    public doses = 6,
  ) {
    super(pos);
    this.layer = 1;
    const heart = Venom.heart();
    this.vein = [pos, { x: (pos.x + heart.x) / 2 + op.rng.range(-30, 30), y: (pos.y + heart.y) / 2 }, heart];
    this.veinLen = polyLength(this.vein);
    this.remaining = doses;
  }

  motePos(m: ColourMote): Vec {
    return pointAlong(this.vein, m.s);
  }

  override wants(): readonly ToolId[] {
    return ['tincture'];
  }

  override drain(): number {
    return ALCHEMY.poisonDrain;
  }

  override update(op: Operation, dt: number): void {
    this.moteT += dt;
    if (this.remaining > 0 && this.moteT >= ALCHEMY.moteEvery) {
      this.moteT = 0;
      this.remaining--;
      this.motes.push({ s: 0, colour: MOTE_COLOURS[Math.floor(op.rng.next() * MOTE_COLOURS.length)], speed: ALCHEMY.moteSpeed, alive: true });
    }
    for (const m of this.motes) {
      m.s += m.speed * dt * (op.venomSlowT > 0 ? op.tuning.venom.antivenomSlow : 1);
      if (m.s >= this.veinLen) {
        m.alive = false;
        op.hurt(ALCHEMY.moteHurt, Venom.heart());
      }
    }
    this.motes = this.motes.filter((m) => m.alive);
    if (this.remaining === 0 && !this.motes.length) {
      this.kill();
      op.rate('good', this.pos, 'Poison spent');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tincture') return false;
    const m = this.motes.find((mm) => dist(this.motePos(mm), ptr.pos) < ALCHEMY.moteHit + op.hitPad);
    if (!m) return false;
    if (m.colour === op.tinctureColor) {
      m.alive = false;
      op.cues.push('inject');
      op.rate('cool', ptr.pos, 'Matched');
    } else {
      m.speed *= ALCHEMY.wrongSpeedup;
      op.rate('bad', ptr.pos, 'Wrong antidote');
      op.sayOnce('antidote-colour', 'Match the colour — cycle the tincture (6) to the drop’s hue.');
    }
    return true;
  }

  draw(g: Gfx): void {
    g.polyline(this.vein, 2, hex('#140a1e', 0.4));
    for (const m of this.motes) {
      const p = this.motePos(m);
      g.glow(p.x, p.y, 14, hex(TINCTURE_HEX[m.colour], 0.5));
      g.circle(p.x, p.y, 5, hex(TINCTURE_HEX[m.colour]));
    }
    g.circle(this.pos.x, this.pos.y, 8, hex('#2a1030'));
  }
}

/**
 * A pocket of poisonous gas. Hold the leech-pipe on it for a second to vent it
 * before cutting; lance it unvented and the haze blinds the field for 4 s.
 */
export class GasPocket extends Entity {
  vented = false;
  private suck = 0;
  noun = 'the gas pocket';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 2;
  }

  override wants(): readonly ToolId[] {
    return this.vented ? ['lancet'] : ['leech', 'lancet'];
  }

  override drain(): number {
    return ALCHEMY.poisonDrain;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || this.vented || dist(ptr.pos, this.pos) > ALCHEMY.gasR + op.hitPad) return;
    this.suck += dt;
    if (this.suck >= ALCHEMY.gasVent) {
      this.vented = true;
      op.rate('good', this.pos, 'Vented');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > ALCHEMY.gasR + op.hitPad) return false;
    this.kill();
    op.cues.push('squelch');
    if (this.vented) op.rate('cool', this.pos, 'Pocket opened');
    else {
      op.hazeT = ALCHEMY.hazeTime;
      op.rate('bad', this.pos, 'Gassed');
      op.sayOnce('gas', 'Gas! Vent those with the leech-pipe before you cut.', 'danger');
    }
    return true;
  }

  draw(g: Gfx, op: Operation): void {
    const s = 1 + Math.sin(op.elapsed * 2 + this.id) * 0.06;
    g.circleGrad(this.pos.x, this.pos.y, ALCHEMY.gasR * s * (this.vented ? 0.6 : 1), hex('#c8d890', 0.6), hex('#6a7a40', 0.2));
  }
}
