/**
 * Turns scene changes and operation state into schema-v1 events. DOM-free and cheap per frame:
 * the browser layer (./index.ts) feeds it scene transitions and calls `tick()` once per frame.
 */
import type { Operation } from '../surgery/operation';
import type { Rating, ToolId } from '../surgery/types';
import type { Assists, EventProps } from './events';
import { quantise } from './events';
import { kindOf } from './kinds';
import type { EventName } from './schema';

export interface SceneInfo {
  name: string;
  /** For story scenes. `chapter` is set (1-based) when this story opens a chapter. */
  story?: { id: string; line: number; lines: number; chapter?: number; prologue?: boolean };
  /** For operation scenes. */
  op?: Operation;
}

export type Emit = <E extends EventName>(event: E, props: EventProps[E]) => void;

interface OpWatch {
  op: Operation;
  started: boolean;
  ended: boolean;
  tool: ToolId;
  minVitals: number;
  tinctures: number;
  startElapsed: number;
}

export class TelemetryObserver {
  private titleSeen = false;
  private attempts = new Map<string, number>();
  private watch: OpWatch | null = null;
  private current: SceneInfo | null = null;

  constructor(
    private emit: Emit,
    private assists: () => Assists,
  ) {}

  /** A new scene became active. `hadSave` tells a new game from a fresh start (for new_game). */
  onScene(next: SceneInfo, hadSave = false): void {
    const prev = this.current;
    this.current = next;
    // Leaving an operation that never finished counts as quitting it.
    if (this.watch && this.watch.op !== next.op) {
      this.endOp('quit');
      this.watch = null;
    }
    if (prev?.name === 'story' && prev.story && prev.story.line < prev.story.lines - 1 && next !== prev) {
      this.emit('story_skip', { story: prev.story.id, line: prev.story.line, lines: prev.story.lines });
    }
    if (next.name === 'title') {
      this.emit('title_view', { firstThisSession: !this.titleSeen });
      this.titleSeen = true;
    }
    if (next.name === 'story' && next.story) {
      if (next.story.prologue && prev?.name === 'title') this.emit('new_game', { replacedSave: hadSave });
      if (next.story.chapter) this.emit('chapter_start', { chapter: next.story.chapter });
    }
    if (next.name === 'demoend') this.emit('demo_end_view', {});
    if (next.name === 'operation' && next.op) this.attach(next.op);
  }

  /** Story scenes advance lines without changing scene: keep the line current for skip detection. */
  storyLine(line: number): void {
    if (this.current?.story) this.current.story.line = line;
  }

  private attach(op: Operation): void {
    this.watch = { op, started: false, ended: false, tool: op.tool, minVitals: op.vitals, tinctures: 0, startElapsed: 0 };
    const w = this.watch;
    const rate = op.rate.bind(op);
    op.rate = (r: Rating, pos, label) => {
      rate(r, pos, label);
      if (this.watch !== w) return;
      // The entity that produced the rating is the nearest one (it is still in the list this frame).
      let best = Infinity;
      let kind = 'none';
      for (const e of op.entities) {
        const d = (e.pos.x - pos.x) ** 2 + (e.pos.y - pos.y) ** 2;
        if (d < best) {
          best = d;
          kind = kindOf(e);
        }
      }
      this.emit('rating', {
        op: op.def.id,
        tool: op.tool,
        entity: kind,
        ...(label ? { label: label.slice(0, 64) } : {}),
        rating: r,
        x: quantise(pos.x, 1280),
        y: quantise(pos.y, 720),
      });
    };
    const heal = op.heal.bind(op);
    op.heal = (n: number) => {
      heal(n);
      if (this.watch === w) w.tinctures++;
    };
  }

  /** Per-frame check (a handful of comparisons). */
  tick(): void {
    const w = this.watch;
    if (!w || w.ended) return;
    const op = w.op;
    if (!w.started && op.status !== 'intro') {
      w.started = true;
      w.startElapsed = op.elapsed;
      const n = (this.attempts.get(op.def.id) ?? 0) + 1;
      this.attempts.set(op.def.id, n);
      this.emit('op_start', { op: op.def.id, attempt: n, assists: this.assists() });
    }
    if (op.vitals < w.minVitals) w.minVitals = op.vitals;
    if (op.tool !== w.tool) {
      w.tool = op.tool;
      if (w.started) this.emit('tool_select', { op: op.def.id, tool: op.tool });
    }
    if (op.status === 'won') this.endOp('won');
    else if (op.status === 'lost') this.endOp('lost');
  }

  private endOp(result: 'won' | 'lost' | 'quit'): void {
    const w = this.watch;
    if (!w || w.ended || !w.started) return;
    w.ended = true;
    const op = w.op;
    this.emit('op_end', {
      op: op.def.id,
      result,
      rank: op.rank(),
      score: Math.max(0, Math.round(op.score)),
      duration: Math.round((op.elapsed - w.startElapsed) * 10) / 10,
      minVitals: Math.round(Math.max(0, w.minVitals) * 10) / 10,
      counts: { ...op.counts },
      maxCombo: op.maxCombo,
      litanyUsed: op.litanyUsed,
      tinctures: w.tinctures,
      assists: this.assists(),
    });
    if (result !== 'won') {
      const reason = result === 'quit' ? 'quit' : op.lostReason.startsWith('Time') ? 'timer' : 'vitals';
      const liveKinds = [...new Set(op.entities.filter((e) => e.alive).map(kindOf))].slice(0, 32);
      this.emit('op_fail', { op: op.def.id, reason, phase: op.phase, liveKinds });
    }
  }

  /** Session end: close any open operation as quit. */
  onQuit(): void {
    if (this.watch) this.endOp('quit');
  }
}
