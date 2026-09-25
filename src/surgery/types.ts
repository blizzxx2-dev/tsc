import type { Vec } from '../core/math';

/**
 * The surgeon's instruments. Ids are stable (used in save data and content);
 * display names live in TOOL_INFO so the fiction can change freely.
 */
export type ToolId =
  | 'lancet' // scalpel: incisions, excising growths
  | 'tongs' // forceps: extract shards, grubs, excised growths
  | 'leech' // drain: draw off pooled blood
  | 'thread' // suture: stitch lacerations and the final incision
  | 'salve' // antibiotic gel: soothe rot, seal small nicks
  | 'tincture' // syringe: stabilise vitals
  | 'brand' // laser: sear grubs, curse-sigils and Malison flesh
  | 'lens'; // ultrasound: reveal what lies beneath

export interface ToolInfo {
  id: ToolId;
  name: string;
  key: string; // keyboard hotkey label
  code: string; // KeyboardEvent.code
  hint: string;
}

export const TOOL_INFO: readonly ToolInfo[] = [
  { id: 'lancet', name: 'Lancet', key: '1', code: 'Digit1', hint: 'Trace incision lines, lance buboes and egg sacs, nick barbed arrows free.' },
  { id: 'tongs', name: 'Tongs', key: '2', code: 'Digit2', hint: 'Seize shards and grubs, and drag them off the body.' },
  { id: 'leech', name: 'Leech-Pipe', key: '3', code: 'Digit3', hint: 'Hold over pooled blood to draw it off.' },
  { id: 'thread', name: 'Gut Thread', key: '4', code: 'Digit4', hint: 'Zig-zag across a wound to stitch it closed.' },
  { id: 'salve', name: 'Saint’s Salve', key: '5', code: 'Digit5', hint: 'Brush over rot and small nicks to seal them.' },
  { id: 'tincture', name: 'Tincture', key: '6', code: 'Digit6', hint: 'Hold on the body to inject. Restores vitals.' },
  { id: 'brand', name: 'Cautery Brand', key: '7', code: 'Digit7', hint: 'Hold on grubs, curse-sigils and exposed Malison flesh to sear them.' },
  { id: 'lens', name: 'Scrying Lens', key: '8', code: 'Digit8', hint: 'Hover to reveal what hides beneath the flesh.' },
];

export const toolInfo = (id: ToolId): ToolInfo => TOOL_INFO.find((t) => t.id === id)!;

export type Rating = 'cool' | 'good' | 'bad' | 'miss';

/** What moved the pointer (ENG-0250). */
export type PointerSource = 'mouse' | 'pen' | 'touch' | 'pad';

export interface Pointer {
  pos: Vec;
  prev: Vec;
  down: boolean;
  pressed: boolean;
  released: boolean;
  /**
   * Extended pointer data (ENG-0250): pens, touchscreens and the gamepad cursor feed the same API.
   * Pressure is 0..1 (0.5 for devices without it), tilt is degrees on x/y. These are not in the
   * replay log yet, so rules must not depend on them; assists and presentation may.
   */
  pressure?: number;
  tilt?: Vec;
  source?: PointerSource;
}

export type Rank = 'XS' | 'S' | 'A' | 'B' | 'C';
