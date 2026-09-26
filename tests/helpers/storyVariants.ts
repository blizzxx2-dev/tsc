/**
 * The longest version of a scene any player can see (NAR-0178): every outcome context (rank band,
 * Litany) crossed with every combination of the campaign flags its lines read.
 */
import { lineShown, type StoryContext } from '../../src/content/conditions';
import type { FlagCondition, FlagReader } from '../../src/content/flags';
import type { StoryDef } from '../../src/content/story';

type V = string | number | boolean | undefined;

const CONTEXTS: StoryContext[] = [true, false].flatMap((litanyUsed) => (['XS', 'A', 'C'] as const).map((rank) => ({ litanyUsed, rank })));

const truthy = (v: V) => v !== undefined && v !== false && v !== 0 && v !== '';
const reader = (a: Record<string, V>): FlagReader => ({ get: (k) => a[k], has: (k) => a[k] !== undefined, truthy: (k) => truthy(a[k]) });

/** Flags a condition reads, with the values worth trying for each. */
function collect(c: FlagCondition, out: Map<string, Set<V>>): void {
  const add = (k: string, ...vs: V[]) => {
    const s = out.get(k) ?? new Set<V>([undefined, true, false]);
    for (const v of vs) s.add(v);
    out.set(k, s);
  };
  if (typeof c === 'function') {
    // Record what it reads with every flag unset, then with every flag set.
    for (const on of [false, true]) {
      c({ get: (k) => (add(k), on ? true : undefined), has: (k) => (add(k), on), truthy: (k) => (add(k), on) });
    }
    return;
  }
  if ('flag' in c) return add(c.flag, c.is);
  if ('all' in c) return c.all.forEach((x) => collect(x, out));
  if ('any' in c) return c.any.forEach((x) => collect(x, out));
  collect(c.not, out);
}

/** The most lines the scene ever shows. */
export function longestVariant(s: StoryDef): number {
  const vals = new Map<string, Set<V>>();
  for (const l of s.lines) if (l.if) collect(l.if, vals);
  const keys = [...vals.keys()];
  let worlds: Record<string, V>[] = [{}];
  for (const k of keys) worlds = worlds.flatMap((w) => [...vals.get(k)!].map((v) => ({ ...w, [k]: v })));
  let most = 0;
  for (const w of worlds.slice(0, 20000)) {
    const f = reader(w);
    for (const ctx of CONTEXTS) most = Math.max(most, s.lines.filter((l) => lineShown(l, ctx, f)).length);
  }
  return most;
}
