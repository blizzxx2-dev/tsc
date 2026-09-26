/**
 * Entity drawing, kept out of the simulation (GAM-0012). Entities expose state only; each kind's
 * look is registered here by its class, and the operation scene draws through `drawEntity` and
 * friends. A kind inherits its parent's drawer hook by hook, as a subclass inherited `draw`
 * before; `drawAs` stands in for what `super.draw` was.
 */
import type { Entity } from '../../surgery/entity';
import type { Operation } from '../../surgery/operation';
import type { Gfx } from '../gfx';

type Hook<E> = (g: Gfx, e: E, op: Operation) => void;

/** How one kind of entity draws: its body over the field, and its marks in the surface and fluid layers. */
export interface Drawer<E extends Entity> {
  draw?: Hook<E>;
  surface?: Hook<E>;
  fluid?: Hook<E>;
}

type HookName = keyof Drawer<Entity>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor<E> = abstract new (...a: any[]) => E;

const DRAWERS = new Map<unknown, Drawer<Entity>>();
const CACHE = new Map<unknown, Partial<Record<HookName, Hook<Entity> | null>>>();

/** Register how a kind of entity draws (called once per kind, at module load). */
export function drawer<E extends Entity>(cls: Ctor<E>, d: Drawer<E>): void {
  DRAWERS.set(cls, d as Drawer<Entity>);
  CACHE.clear();
}

/** The nearest hook, starting at `proto` and walking up the class chain. */
function find(proto: object | null, k: HookName): Hook<Entity> | null {
  for (let p = proto; p && p !== Object.prototype; p = Object.getPrototypeOf(p) as object | null) {
    const h = DRAWERS.get((p as { constructor: unknown }).constructor)?.[k];
    if (h) return h;
  }
  return null;
}

function hookOf(e: Entity, k: HookName): Hook<Entity> | null {
  const ctor = e.constructor;
  let c = CACHE.get(ctor);
  if (!c) CACHE.set(ctor, (c = {}));
  if (c[k] === undefined) c[k] = find(Object.getPrototypeOf(e) as object, k);
  return c[k] ?? null;
}

/** Draw an entity's body over the field. */
export function drawEntity(g: Gfx, e: Entity, op: Operation): void {
  hookOf(e, 'draw')?.(g, e, op);
}

/** Write an entity's marks into the surface layer (R cut depth, G stain, B scorch, A swelling). */
export function drawEntitySurface(g: Gfx, e: Entity, op: Operation): void {
  hookOf(e, 'surface')?.(g, e, op);
}

/** Write an entity's liquid into the fluid layer (R blood, G pus, B bile). */
export function drawEntityFluid(g: Gfx, e: Entity, op: Operation): void {
  hookOf(e, 'fluid')?.(g, e, op);
}

/** Draw `e` as its ancestor `cls` would: what a subclass's `super.draw` was. */
export function drawAs<E extends Entity>(cls: Ctor<E>, k: HookName, g: Gfx, e: E, op: Operation): void {
  find((cls as unknown as { prototype: object }).prototype, k)?.(g, e, op);
}
