import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { pointAlong, polyLength, surfDisc } from '../entities';
import { Entity } from '../entity';
import { analyseLoop, loopRating } from '../gesture';
import type { Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { Amputation } from './gangrene';

export const INFECTION = {
  speed: 8,
  nodeLeech: 0.6,
  nodeInject: 0.7,
  nodeR: 16,
  drain: 0.3,
  crustR: 20,
  sporeSeed: 60,
  sporeDrain: 0.15,
  dungDrain: 0.2,
  dungFlush: 1.5,
  dungR: 34,
  loopMargin: 30,
};

interface InfectionNode {
  at: number;
  leeched: number;
  injected: number;
  treated: boolean;
}

/**
 * A dark infection line climbing a vein toward the armpit. At each branch
 * node ahead of it, hold the leech-pipe (0.6 s) then the tincture (0.7 s):
 * a treated node stops the line there. If it reaches the armpit, the arm
 * must come off.
 */
export class InfectionLine extends Entity {
  readonly path: Vec[];
  readonly length: number;
  front = 0;
  nodes: InfectionNode[];
  stopped = false;
  noun = 'the infection';

  constructor(path: Vec[], nodeCount = 3) {
    super(path[0]);
    this.layer = -1;
    this.path = path;
    this.length = polyLength(path);
    this.nodes = Array.from({ length: nodeCount }, (_, i) => ({ at: (this.length * (i + 1)) / (nodeCount + 1), leeched: 0, injected: 0, treated: false }));
  }

  /** Where the arm comes off if the line reaches the armpit. */
  armpitCut(): { pos: Vec; angle: number } {
    const end = this.path[this.path.length - 1];
    const prev = this.path[this.path.length - 2];
    return { pos: { x: (end.x + prev.x) / 2, y: (end.y + prev.y) / 2 }, angle: Math.atan2(end.y - prev.y, end.x - prev.x) + Math.PI / 2 };
  }

  nodePos(n: InfectionNode): Vec {
    return pointAlong(this.path, n.at);
  }

  /** The next untreated node ahead of the front. */
  get nextNode(): InfectionNode | undefined {
    return this.nodes.find((n) => !n.treated && n.at > this.front);
  }

  override wants(): readonly ToolId[] {
    const n = this.nextNode;
    return n && n.leeched < INFECTION.nodeLeech ? ['leech'] : ['tincture'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.nodes.some((n) => dist(this.nodePos(n), p) < INFECTION.nodeR + pad);
  }

  override drain(): number {
    return INFECTION.drain * (1 + this.front / this.length);
  }

  override update(op: Operation, dt: number): void {
    if (this.stopped) return;
    const block = this.nodes.find((n) => n.treated && n.at > this.front);
    this.front = Math.min(block ? block.at : this.length, this.front + INFECTION.speed * dt);
    if (block && this.front >= block.at) {
      this.stopped = true;
      this.kill();
      op.rate('good', this.nodePos(block), 'Line halted');
      return;
    }
    if (this.front >= this.length) {
      this.kill();
      op.say('It’s in the armpit — the arm must come off!', 'danger');
      const cut = this.armpitCut();
      op.spawn(new Amputation(cut.pos, cut.angle));
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    const n = this.nextNode;
    if (!n || dist(this.nodePos(n), ptr.pos) > INFECTION.nodeR + op.hitPad) return;
    if (tool === 'leech') n.leeched += dt;
    if (tool === 'tincture' && n.leeched >= INFECTION.nodeLeech) {
      n.injected += dt;
      if (n.injected >= INFECTION.nodeInject && !n.treated) {
        n.treated = true;
        op.cues.push('inject');
        op.rate('cool', this.nodePos(n), 'Node treated');
      }
    } else if (tool === 'tincture') op.sayOnce('node-leech', 'Draw the node off with the leech-pipe first, then the tincture.');
  }

  draw(g: Gfx): void {
    g.polyline(this.path, 2, hex('#3a1a2a', 0.3));
    const pts: Vec[] = [this.path[0]];
    for (let s = 10; s < this.front; s += 10) pts.push(pointAlong(this.path, s));
    pts.push(pointAlong(this.path, this.front));
    g.polyline(pts, 5, hex('#200818', 0.9));
    for (const n of this.nodes) {
      const p = this.nodePos(n);
      g.circle(p.x, p.y, 7, hex(n.treated ? '#9fd3a8' : n.leeched >= INFECTION.nodeLeech ? '#f0c060' : '#6a2a4a'));
    }
  }
}

/**
 * A crust of spores. Only an encircling cut removes it; a lancet dragged
 * across it scatters spores that seed new crust nearby.
 */
export class SporeCrust extends Entity {
  private path: Vec[] = [];
  noun = 'the spore crust';

  constructor(pos: Vec) {
    super(pos);
    this.layer = -1;
  }

  override wants(): readonly ToolId[] {
    return ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < INFECTION.crustR + INFECTION.loopMargin + pad;
  }

  override drain(): number {
    return INFECTION.sporeDrain;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || !this.hitTest(ptr.pos, op.hitPad)) return false;
    this.path = [{ ...ptr.pos }];
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || !this.path.length) return;
    this.path.push({ ...ptr.pos });
    // Dragged straight through the crust: spores fly.
    if (dist(ptr.pos, this.pos) < INFECTION.crustR * 0.7) {
      this.path = [];
      op.rate('bad', ptr.pos, 'Spores scattered');
      const a = op.rng.range(0, Math.PI * 2);
      op.spawnPenalty(new SporeCrust({ x: this.pos.x + Math.cos(a) * INFECTION.sporeSeed, y: this.pos.y + Math.sin(a) * INFECTION.sporeSeed * 0.7 }));
      op.sayOnce('spores', 'Don’t cut through it — around it! Cut a circle round the crust.');
    }
  }

  override onRelease(op: Operation): void {
    if (this.path.length < 3) return;
    const l = analyseLoop(this.path, this.pos, INFECTION.crustR);
    this.path = [];
    if (l.closed && l.encloses) {
      this.kill();
      op.rate(loopRating(l), this.pos, 'Crust excised');
    }
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, INFECTION.crustR * 1.5, 0, 0.2, 0.2, 0);
  }

  draw(g: Gfx): void {
    g.circleGrad(this.pos.x, this.pos.y, INFECTION.crustR, hex('#8a8a50'), hex('#4a4a20'));
    for (let i = 0; i < 6; i++) g.circle(this.pos.x + Math.cos(i * 1.1) * 10, this.pos.y + Math.sin(i * 1.7) * 9, 2, hex('#e0e0a0'));
    if (this.path.length > 1) g.polyline(this.path, 2, hex('#ff9090', 0.6));
  }
}

/**
 * A dung-fouled patch: drains until irrigated — the leech-pipe reversed (R)
 * and held on it for 1.5 s.
 */
export class DungZone extends Entity {
  private flush = 0;
  noun = 'the filth';

  constructor(pos: Vec) {
    super(pos);
    this.layer = -1;
  }

  override wants(): readonly ToolId[] {
    return ['leech'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < INFECTION.dungR + pad;
  }

  override drain(): number {
    return INFECTION.dungDrain;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > INFECTION.dungR + op.hitPad) return;
    if (!op.leechReverse) {
      op.sayOnce('irrigate', 'Irrigate it — reverse the leech-pipe (R) and flush it clean.');
      return;
    }
    this.flush += dt;
    if (this.flush >= INFECTION.dungFlush) {
      this.kill();
      op.rate('good', this.pos, 'Irrigated');
    }
  }

  draw(g: Gfx): void {
    g.circleGrad(this.pos.x, this.pos.y, INFECTION.dungR, hex('#4a3a18', 0.7), hex('#4a3a18', 0));
  }
}
