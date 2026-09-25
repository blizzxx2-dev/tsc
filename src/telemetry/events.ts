/** Typed telemetry events and the envelope builder (schema v1, see ./schema.ts). */
import type { Rank, Rating, ToolId } from '../surgery/types';
import { SCHEMA_VERSION, type EventName } from './schema';

export type Flavour = 'dev' | 'qa' | 'playtest' | 'release';

export interface Assists {
  timer: 1 | 1.5 | 2;
  litanyKey: boolean;
}

export interface EventProps {
  session_start: { os: string; gpuFamily: string; locale: string; edition: 'demo' | 'full'; viewport: { w: number; h: number; dpr: number } };
  consent_answered: { granted: boolean };
  title_view: { firstThisSession: boolean };
  new_game: { replacedSave: boolean };
  chapter_start: { chapter: number };
  op_start: { op: string; attempt: number; assists: Assists };
  op_end: {
    op: string;
    result: 'won' | 'lost' | 'quit';
    rank: Rank;
    score: number;
    duration: number;
    minVitals: number;
    counts: Record<Rating, number>;
    maxCombo: number;
    litanyUsed: boolean;
    tinctures: number;
    assists: Assists;
  };
  op_fail: { op: string; reason: 'vitals' | 'timer' | 'quit'; phase: number; liveKinds: string[] };
  rating: { op: string; tool: ToolId; entity: string; label?: string; rating: Rating; x: number; y: number };
  tool_select: { op: string; tool: ToolId };
  story_skip: { story: string; line: number; lines: number };
  settings_changed: { changes: Record<string, number | boolean> };
  demo_end_view: Record<string, never>;
  wishlist_click: { source: 'demo_end' | 'title' | 'other' };
  quit: { scene: string; sessionSeconds: number };
}

export interface TelemetryEvent<E extends EventName = EventName> {
  schema: typeof SCHEMA_VERSION;
  event: E;
  ts: string;
  session: string;
  install: string;
  seq: number;
  build: string;
  flavour: Flavour;
  props: EventProps[E];
}

export interface EnvelopeContext {
  session: string;
  install: string;
  build: string;
  flavour: Flavour;
  now?: () => Date;
}

export class EventFactory {
  private seq = 0;
  constructor(private ctx: EnvelopeContext) {}

  make<E extends EventName>(event: E, props: EventProps[E]): TelemetryEvent<E> {
    return {
      schema: SCHEMA_VERSION,
      event,
      ts: (this.ctx.now?.() ?? new Date()).toISOString(),
      session: this.ctx.session,
      install: this.ctx.install,
      seq: this.seq++,
      build: this.ctx.build,
      flavour: this.ctx.flavour,
      props,
    };
  }

  setInstall(id: string): void {
    this.ctx.install = id;
  }
}

/** Positions are quantised to a 32 px grid inside the 1280×720 view before they leave the sim. */
export const quantise = (v: number, max: number): number => Math.max(0, Math.min(max, Math.floor(v / 32) * 32));

/** RFC 4122 v4 UUID from any random source (crypto when available). */
export function uuid(rand: () => number = Math.random): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  h[12] = '4';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
