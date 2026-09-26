/**
 * A recording stand-in for `Gfx` (GAM-0012): every property read and call on it is logged, so
 * the drawing an entity does can be compared call-for-call before and after a refactor.
 */
import type { Gfx } from '../../src/render/gfx';

const r2 = (n: number) => (Object.is(n, -0) ? 0 : Math.round(n * 100) / 100);

export function recorder(): { g: Gfx; log: string[] } {
  const log: string[] = [];
  const proxies = new WeakSet<object>();
  const fmt = (v: unknown, depth = 0): string => {
    if (typeof v === 'number') return String(r2(v));
    if (typeof v === 'string' || typeof v === 'boolean' || v === undefined || v === null) return String(v);
    if (typeof v === 'function') return proxies.has(v) ? 'P' : 'fn';
    if (depth > 3) return '…';
    if (ArrayBuffer.isView(v)) return `[${Array.from(v as unknown as ArrayLike<number>, (x) => r2(x)).join(',')}]`;
    if (Array.isArray(v)) return `[${v.map((x) => fmt(x, depth + 1)).join(',')}]`;
    if (typeof v === 'object')
      return `{${Object.keys(v as object)
        .sort()
        .map((k) => `${k}:${fmt((v as Record<string, unknown>)[k], depth + 1)}`)
        .join(',')}}`;
    return String(v);
  };
  const make = (name: string): unknown => {
    const p: object = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === Symbol.toPrimitive) return () => 0;
        if (prop === 'then' || typeof prop === 'symbol') return undefined;
        return make(`${name}.${prop}`);
      },
      apply(_t, _this, args) {
        log.push(`${name}(${args.map((a) => fmt(a)).join(',')})`);
        return make(`${name}()`);
      },
    });
    proxies.add(p);
    return p;
  };
  return { g: make('g') as Gfx, log };
}
