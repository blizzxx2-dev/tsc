/**
 * Presentation-only exit effects: when a tracked entity leaves play, a short flipbook plays where it
 * was — a Malison shard bursts into snapped thread (ART-0228, 8 frames), a removed hexstone crumbles
 * to curse-ash (ART-0201). The simulation never sees these: the scene watches the entity list, so
 * replays, goldens and the sim stay untouched.
 */
import type { Vec } from '../core/math';
import type { Gfx } from '../render/gfx';
import type { Entity } from '../surgery/entity';
import { Embedded } from '../surgery/entities';
import { MalisonShard } from '../surgery/malison';
import { hexstoneArt, threadKnotArt } from './ailmentArt';

interface Vanish {
  kind: 'shard' | 'hexstone';
  pos: Vec;
  angle: number;
  size: number;
  seed: number;
  crawler: boolean;
  t0: number;
  dur: number;
}

const tracked = (e: Entity): boolean => e instanceof MalisonShard || (e instanceof Embedded && e.kind === 'hexstone');

export class VanishFx {
  private seen = new Set<Entity>();
  private live: Vanish[] = [];

  /** Call once a frame with the operation's entities and clock. */
  update(entities: readonly Entity[], now: number): void {
    for (const e of this.seen) {
      if (e.alive) continue;
      this.seen.delete(e);
      if (e instanceof MalisonShard) this.live.push({ kind: 'shard', pos: { ...e.pos }, angle: 0, size: 14, seed: e.id, crawler: e.mode === 'crawler', t0: now, dur: 0.6 });
      else if (e instanceof Embedded) this.live.push({ kind: 'hexstone', pos: { ...e.pos }, angle: e.angle, size: e.spec.len, seed: e.id, crawler: false, t0: now, dur: 0.8 });
    }
    for (const e of entities) if (e.alive && tracked(e)) this.seen.add(e);
    this.live = this.live.filter((v) => now - v.t0 < v.dur && now >= v.t0);
  }

  draw(g: Gfx, now: number): void {
    for (const v of this.live) {
      const k = Math.min(1, (now - v.t0) / v.dur);
      if (v.kind === 'shard') threadKnotArt(g, v.pos, v.size, { shape: v.seed % 3, burst: k, crawler: v.crawler, seed: v.seed });
      else hexstoneArt(g, v.pos, v.angle, v.size, { dissolve: k, stilled: 1, seed: v.seed });
    }
  }
}
