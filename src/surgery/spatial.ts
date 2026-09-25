/**
 * Spatial index (ENG-0246): a uniform grid over the field for picking and sweeping when the field
 * is crowded. Only entities that declare a `pickReach` are indexed; everything else (incision
 * paths, rings, whole-field effects) is always a candidate, so the index can only skip entities
 * that could not have answered anyway.
 */
import type { Vec } from '../core/math';
import type { Entity } from './entity';

/** Past this many live entities the index is used; below it a plain scan is cheaper. */
export const SPATIAL_THRESHOLD = 64;
const CELL = 64;

export class SpatialGrid {
  private cells = new Map<number, Entity[]>();
  /** Entities without a reach: always candidates. */
  readonly always: Entity[] = [];

  constructor(entities: readonly Entity[]) {
    for (const e of entities) {
      const r = e.pickReach;
      if (r === undefined) {
        this.always.push(e);
        continue;
      }
      const x0 = Math.floor((e.pos.x - r) / CELL);
      const x1 = Math.floor((e.pos.x + r) / CELL);
      const y0 = Math.floor((e.pos.y - r) / CELL);
      const y1 = Math.floor((e.pos.y + r) / CELL);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const k = key(x, y);
          const c = this.cells.get(k);
          if (c) c.push(e);
          else this.cells.set(k, [e]);
        }
    }
  }

  /** Entities that could answer a stroke from `a` to `b` (padded by `pad` px), in their original order. */
  query(a: Vec, b: Vec, pad: number, order: readonly Entity[]): Entity[] {
    const hits = new Set<Entity>(this.always);
    const x0 = Math.floor((Math.min(a.x, b.x) - pad) / CELL);
    const x1 = Math.floor((Math.max(a.x, b.x) + pad) / CELL);
    const y0 = Math.floor((Math.min(a.y, b.y) - pad) / CELL);
    const y1 = Math.floor((Math.max(a.y, b.y) + pad) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const e of this.cells.get(key(x, y)) ?? []) hits.add(e);
    return order.filter((e) => hits.has(e));
  }
}

const key = (x: number, y: number): number => (x + 1024) * 4096 + (y + 1024);
