/**
 * Bot strategies for the Hours built on MalisonBase (BOS-0007): each boss id
 * maps to a strategy that `plan()` in bot.ts consults first. A strategy
 * returns null to hand back to the generic planner (wounds, pools, shards…).
 */
import { dist, type Vec } from '../src/core/math';
import { activeBoss, bossesOf, type MalisonBase } from '../src/surgery/bosses/base';
import { FIELD, onBody, TRAY_DISH, type Operation } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';
import { Malison, MalisonShard } from '../src/surgery/malison';
import { ChoirVoice, LaudsMalison, VOICE_SIGIL } from '../src/surgery/lauds';
import { pointAlong } from '../src/surgery/bosses/common';
import { EggCluster, FangNest, MatinsHerald } from '../src/surgery/bosses/elites';
import type { BotKit } from './bot-later';

const DT = 1 / 60;
interface Frame {
  tool: ToolId;
  pos: Vec;
  down: boolean;
}
type Action = Generator<Frame, void, void>;

export type BotStrategy = (op: Operation, k: BotKit, boss: MalisonBase) => Action | null;

/** Move the pointer toward `to` at `speed` px/s (pointer up), one frame. */
function toward(from: Vec, to: Vec, speed: number): Vec {
  const d = dist(from, to);
  const s = speed * DT;
  if (d <= s) return { ...to };
  return { x: from.x + ((to.x - from.x) / d) * s, y: from.y + ((to.y - from.y) / d) * s };
}

// ------------------------------------------------------------------ Matins

/** Phase 3: wait off the gaze line, brand only on the third beat, sidestep a locked gaze. */
function* eyeDance(op: Operation, m: Malison, seconds: number): Action {
  let p: Vec = { ...op.pointer };
  let dodge: Vec | null = null;
  for (let t = 0; t < seconds && m.alive; t += DT) {
    if (m.gaze) {
      if (!dodge) {
        const n = { x: -m.gaze.dir.y, y: m.gaze.dir.x };
        const a = { x: p.x + n.x * 110, y: p.y + n.y * 110 };
        const b = { x: p.x - n.x * 110, y: p.y - n.y * 110 };
        dodge = onBody(a) ? a : b;
      }
      p = toward(p, dodge, 700);
      yield { tool: 'brand', pos: p, down: false };
      continue;
    }
    dodge = null;
    if (m.beat === 3) {
      p = { ...m.pos };
      yield { tool: 'brand', pos: p, down: true };
      continue;
    }
    // Hover beside the eye, ready.
    p = toward(p, { x: m.pos.x, y: m.pos.y - m.radius - 30 }, 500);
    yield { tool: 'brand', pos: p, down: false };
  }
}

/** One continuous hand: sear crawling shards while veiled, brand the shroud whenever it parts. */
function* watch(m: Malison, crawlers: () => MalisonShard[], seconds: number): Action {
  let p: Vec = { x: m.pos.x, y: m.pos.y - m.radius - 24 };
  let branded = false;
  for (let t = 0; t < seconds && m.alive; t += DT) {
    const target = m.vulnerable ? m.pos : (crawlers().sort((a, b) => dist(a.pos, p) - dist(b.pos, p))[0]?.pos ?? null);
    if (!target) {
      if (branded && !m.openTelling) return;
      p = toward(p, { x: m.pos.x, y: m.pos.y - m.radius - 24 }, 600);
      yield { tool: 'brand', pos: p, down: false };
      continue;
    }
    if (dist(p, target) > 8) {
      p = toward(p, target, 900);
      yield { tool: 'brand', pos: p, down: false };
      continue;
    }
    branded = true;
    p = { ...target };
    yield { tool: 'brand', pos: p, down: true };
  }
}

export const matinsStrategy: BotStrategy = (op, _k, boss) => {
  const m = boss as Malison;
  if (!m.alive) return null;
  if (m.eyeOut && m.phase.key === 'eye') {
    // Shards and wounds first if they pile up; the eye can wait a beat.
    if (op.entities.some((e) => e instanceof MalisonShard && e.alive)) return null;
    return eyeDance(op, m, 6);
  }
  const crawlers = () => op.entities.filter((e): e is MalisonShard => e instanceof MalisonShard && e.alive && e.mode === 'crawler');
  // The Litany, as Ilse teaches it: when the Watchfire begins.
  if (m.phase.key === 'watchfire' && op.canInvokeLitany() && m.phases.length > 1) op.invokeLitany();
  // Between openings, a surgeon tends the wounds (the generic planner) and returns to wait.
  const idle = !m.vulnerable && !m.openTelling && crawlers().length === 0;
  if (idle && op.entities.some((e) => e.alive && !e.hidden && e.required && e !== m && !(e instanceof MalisonShard))) return null;
  return watch(m, crawlers, 7);
};

// ------------------------------------------------------------------ Lauds

/** Trace a Voice's sigil with the brand as it orbits. */
function* traceVoice(v: ChoirVoice, seconds = 2.2): Action {
  const per = 3 * dist(VOICE_SIGIL[0], VOICE_SIGIL[1]);
  let s = 0;
  for (let t = 0; t < seconds && v.alive; t += DT) {
    const l = pointAlong(VOICE_SIGIL as Vec[], s % per);
    yield { tool: 'brand', pos: { x: v.pos.x + l.x, y: v.pos.y + l.y }, down: true };
    s += 120 * DT;
  }
}

/** The Response: strike one body, then the other within the window; cut the thread when it dims. */
function* antiphon(l: LaudsMalison, seconds: number): Action {
  let p: Vec = { ...l.pos };
  let side: 'core' | 'partner' = 'core';
  let segT = 0;
  for (let t = 0; t < seconds && l.alive && l.phase.key === 'response'; t += DT) {
    const th = l.thread;
    const b = l.partner;
    if (!b || !th) return;
    // Severance: on the dim beat, draw the lancet across the thread.
    if (!l.unlinked && (th.dimmed || th.dimTelling)) {
      const mid = { x: (l.pos.x + b.pos.x) / 2, y: (l.pos.y + b.pos.y) / 2 };
      const d = { x: b.pos.x - l.pos.x, y: b.pos.y - l.pos.y };
      const len = Math.hypot(d.x, d.y) || 1;
      const n = { x: -d.y / len, y: d.x / len };
      if (!th.dimmed) {
        p = toward(p, { x: mid.x + n.x * 30, y: mid.y + n.y * 30 }, 900);
        yield { tool: 'lancet', pos: p, down: false };
        continue;
      }
      const start = { x: mid.x + n.x * 30, y: mid.y + n.y * 30 };
      yield { tool: 'lancet', pos: start, down: true };
      for (let i = 1; i <= 10; i++) yield { tool: 'lancet', pos: { x: mid.x + n.x * (30 - 6 * i), y: mid.y + n.y * (30 - 6 * i) }, down: true };
      p = { x: mid.x - n.x * 30, y: mid.y - n.y * 30 };
      yield { tool: 'lancet', pos: p, down: false };
      continue;
    }
    const target = side === 'core' ? l.pos : b.pos;
    if (dist(p, target) > 6) {
      p = toward(p, target, 1300);
      yield { tool: 'brand', pos: p, down: false };
      continue;
    }
    p = { ...target };
    yield { tool: 'brand', pos: p, down: true };
    segT += DT;
    if (segT > (l.unlinked ? 1.5 : 0.55)) {
      segT = 0;
      if (!l.unlinked) side = side === 'core' ? 'partner' : 'core';
    }
  }
}

export const laudsStrategy: BotStrategy = (op, k, boss) => {
  const l = boss as LaudsMalison;
  if (!l.alive) return null;
  const key = l.phase.key;
  if (key === 'call') {
    const v = op.entities.filter((e): e is ChoirVoice => e instanceof ChoirVoice && e.alive && e.core === l).sort((a, b) => b.traced - a.traced)[0];
    if (v) return traceVoice(v);
    return k.hold('brand', () => (l.alive && l.phase.key === 'call' && l.livingVoices.length === 0 ? l.pos : null), 5);
  }
  if (key === 'response') return antiphon(l, 20);
  // Dawn: hunt its ripples between flares, brand it while surfaced.
  if (l.submerged) {
    // Blinded by the flare: tend the rot and the bleeding instead of waiting.
    if (l.blinded || l.flareTelling) return null;
    return k.hold('lens', () => (l.alive && l.submerged && !l.blinded ? l.pos : null), 1.5);
  }
  return k.hold('brand', () => (l.alive && !l.submerged ? l.pos : null), 5);
};

// ------------------------------------------------------------------ elites

/** Brood-Mother: cut the membrane right round the cluster before touching a sac. */
export const broodStrategy: BotStrategy = (_op, k, boss) => {
  const c = boss as EggCluster;
  if (c.cut || !c.alive) return null;
  const ring = Array.from({ length: 41 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    return { x: c.pos.x + Math.cos(a) * 85, y: c.pos.y + Math.sin(a) * 80 };
  });
  return k.drag('lancet', ring, 520);
};

/** Gravehound: pull the fangs in the order the web shows. */
export const fangStrategy: BotStrategy = (_op, k, boss) => {
  const f = (boss as FangNest).due;
  if (!f || f.grabbed) return null;
  const grip = { x: f.origin.x + (f.handle.x - f.origin.x) * 0.7, y: f.origin.y + (f.handle.y - f.origin.y) * 0.7 };
  const dir = { x: f.handle.x - f.origin.x, y: f.handle.y - f.origin.y };
  const l = Math.hypot(dir.x, dir.y) || 1;
  // Out along the axis, then carried off the body into the instrument dish.
  return k.drag('tongs', [grip, { x: grip.x + (dir.x / l) * 40, y: grip.y + (dir.y / l) * 40 }, TRAY_DISH], 480);
};

/** Cantor's Knot: the generic sigil-tracing between hums is enough. */
export const cantorStrategy: BotStrategy = () => null;

export const BOT_STRATEGIES: Record<string, BotStrategy> = {
  matins: matinsStrategy,
  lauds: laudsStrategy,
  broodmother: broodStrategy,
  gravehound: fangStrategy,
  cantor: cantorStrategy,
};

/** A window a surgeon would not waste on wound-tending: brand it now. */
export function hoursUrgent(op: Operation): boolean {
  const b = activeBoss(op);
  if (op.vitals < 30) return false;
  if (b instanceof Malison) return b.vulnerable || b.openTelling;
  if (b instanceof LaudsMalison) return (b.phase.key === 'call' && b.livingVoices.length === 0) || (b.phase.key === 'dawn' && !b.submerged);
  return false;
}

/** The strategy for the operation's current boss (or null). */
export function planHours(op: Operation, k: BotKit): Action | null {
  // The Matins herald is worth chasing while it lingers.
  const herald = op.entities.find((e): e is MatinsHerald => e instanceof MatinsHerald && e.alive);
  if (herald && op.def.tools.includes('brand')) return k.hold('brand', () => (herald.alive ? herald.pos : null), 1.2);
  const b =activeBoss(op) ?? bossesOf(op).find((x) => x.alive) ?? null;
  if (!b) return null;
  return BOT_STRATEGIES[b.bossId]?.(op, k, b) ?? null;
}

export const SIDE_REST: Vec = { x: FIELD.cx + 330, y: FIELD.cy + 20 };
