import type { Vec } from '../core/math';
import type { Entity } from './entity';
import type { Operation } from './operation';
import type { ToolId } from './types';

/**
 * Tutorialisation data: first-time contextual hints (one per mechanic, tracked
 * on the save) and step-gated guided operations. Matching is by entity class
 * name and fields so the core never imports the ailment classes.
 */

export interface FirstHint {
  id: string;
  match: (e: Entity) => boolean;
  text: string;
}

const is = (name: string) => (e: Entity) => e.constructor.name === name;
const embed = (kind: string, pred: (e: Record<string, unknown>) => boolean = () => true) => (e: Entity) => e.constructor.name === 'Embedded' && (e as unknown as { kind: string }).kind === kind && pred(e as unknown as Record<string, unknown>);

export const FIRST_HINTS: readonly FirstHint[] = [
  { id: 'barb', match: embed('arrow', (e) => e.barbed === true), text: 'A barbed head — two lancet nicks at the entry before you pull.' },
  { id: 'bolt', match: embed('bolt'), text: 'Crossbow bolts come in two pulls: ease it, pause a breath, then draw.' },
  { id: 'wadding', match: is('Wadding'), text: 'Shot drives cloth in after it. Leave none behind.' },
  { id: 'rot', match: is('Rot'), text: 'Rot must be salved almost entirely — any island left creeps back.' },
  { id: 'sigil', match: is('Sigil'), text: 'A curse-sigil: hold the brand on node 1, then trace the stroke. In order.' },
  { id: 'hexstone', match: embed('hexstone'), text: 'Hexstone: brand it still, then into the lead dish — never the tray.' },
  { id: 'venom', match: is('Venom'), text: 'Venom runs for the heart. A stitch across the vein ties it off.' },
];

export interface TutorialStep {
  id: string;
  /** The step starts once this phase has begun. */
  phase: number;
  say: string;
  /** Instrument the step introduces (its tray slot is highlighted). */
  tool?: ToolId;
  /** What to point at. */
  highlight?: (op: Operation) => Vec | null;
  done: (op: Operation) => boolean;
}

const first = (name: string) => (op: Operation) => op.entities.find((e) => e.alive && !e.hidden && e.constructor.name === name)?.pos ?? null;

/** Step-gated guided operations: drain is paused until each step's first correct action. */
export const TUTORIALS: Record<string, readonly TutorialStep[]> = {
  'op1-1': [
    { id: 'thread', phase: 0, tool: 'thread', say: 'Take the Gut Thread — press 4, or click it in the tray.', done: (op) => op.tool === 'thread' },
    { id: 'stitch', phase: 0, tool: 'thread', say: 'Zig-zag across the wound, crossing it again and again as you move along it.', highlight: first('Laceration'), done: (op) => op.labelCount('Stitched') > 0 },
    { id: 'leech', phase: 1, tool: 'leech', say: 'Blood’s pooling. The Leech-Pipe — press 3.', done: (op) => op.tool === 'leech' },
    { id: 'drain', phase: 1, tool: 'leech', say: 'Hold it over the pool until it’s drawn off.', highlight: first('BloodPool'), done: (op) => op.flags.has('drained-any') },
    { id: 'salve', phase: 2, tool: 'salve', say: 'Small nicks: brush Saint’s Salve (5) over them — no thread needed.', highlight: first('Laceration'), done: (op) => op.labelCount('Sealed') > 0 },
  ],
};

/** Tool introduction schedule (by content), for the Surgeon's Manual and for checks. */
export const TOOL_INTRODUCED: Record<ToolId, string> = {
  thread: 'op1-1',
  leech: 'op1-1',
  salve: 'op1-1',
  lancet: 'op1-2',
  tongs: 'op1-2',
  tincture: 'op1-3',
  brand: 'op1-4',
  lens: 'op2-2',
};
