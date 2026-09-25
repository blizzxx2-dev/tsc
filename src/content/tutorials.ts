import type { ActionId } from '../input/actions';
import { dragGlyphFor, glyphFor, toolKeyLabel } from '../input/glyphs';
import { TOOL_INFO, type ToolId } from '../surgery/types';

/**
 * Tutorial prompts (NAR-0051, NAR-0052): the *instructions* for each instrument, split out of the
 * story scenes, which now keep only in-fiction flavour. One short prompt per tool and per rule,
 * written control-agnostically with input tokens so mouse, pad and Steam Deck all read correctly:
 *
 *   {TOOL_LANCET} … {TOOL_LENS}   the key/button that selects that instrument
 *   {USE}                         the primary action (click / trigger)
 *   {USE_DRAG}                    "hold and drag" with the primary action
 *   {LITANY_GESTURE}              the star-drawing gesture (e.g. "Right-drag ★")
 *   {LITANY_KEY}                  the Litany key chord
 *
 * `fiction` is who teaches it in the story (for the "Remembered Teachings" page, NAR-0053).
 */
export type TutorialId = ToolId | 'litany' | 'drain-first' | 'barbs' | 'eschar' | 'incision' | 'buboes' | 'sigils' | 'matins' | 'lens-hidden' | 'venom' | 'egg-sacs';

export interface Tutorial {
  id: TutorialId;
  /** Operation that first teaches it. */
  firstOp: string;
  prompt: string;
  /** In-fiction teacher, for the re-openable teachings page. */
  fiction: 'haller' | 'ilse';
}

export const TUTORIALS: readonly Tutorial[] = [
  { id: 'thread', firstOp: 'op1-1', fiction: 'haller', prompt: 'Gut Thread {TOOL_THREAD}: {USE_DRAG} back and forth across the wound, moving along it.' },
  { id: 'leech', firstOp: 'op1-1', fiction: 'ilse', prompt: 'Leech-Pipe {TOOL_LEECH}: hold {USE} over pooled blood until it is drawn off.' },
  { id: 'drain-first', firstOp: 'op1-1', fiction: 'ilse', prompt: 'Blood in a wound? Drain it with the Leech-Pipe before you stitch.' },
  { id: 'salve', firstOp: 'op1-1', fiction: 'haller', prompt: 'Saint’s Salve {TOOL_SALVE}: {USE_DRAG} over small nicks and rot to seal them.' },
  { id: 'lancet', firstOp: 'op1-2', fiction: 'haller', prompt: 'Lancet {TOOL_LANCET}: {USE_DRAG} along an inked line, or tap {USE} to nick or lance.' },
  { id: 'barbs', firstOp: 'op1-2', fiction: 'haller', prompt: 'Barbed head: nick the entry twice with the Lancet before you pull.' },
  { id: 'tongs', firstOp: 'op1-2', fiction: 'haller', prompt: 'Tongs {TOOL_TONGS}: hold {USE} on the object and drag it well clear of the body.' },
  { id: 'eschar', firstOp: 'op1-3', fiction: 'haller', prompt: 'Burns: pluck the black eschar away with the Tongs, then salve the raw flesh.' },
  { id: 'incision', firstOp: 'op1-3', fiction: 'haller', prompt: 'Incision: start at the glowing end of the inked line and keep to it.' },
  { id: 'tincture', firstOp: 'op1-3', fiction: 'haller', prompt: 'Tincture {TOOL_TINCTURE}: hold {USE} on the body to steady a failing pulse.' },
  { id: 'buboes', firstOp: 'op1-4', fiction: 'haller', prompt: 'Buboes: one clean tap of the Lancet each, then drain the pus and salve.' },
  { id: 'brand', firstOp: 'op1-4', fiction: 'haller', prompt: 'Cautery Brand {TOOL_BRAND}: hold {USE} on grubs and sigils. It sears healthy flesh too.' },
  { id: 'sigils', firstOp: 'op1-5', fiction: 'haller', prompt: 'Sigils: trace every stroke with the Brand, in order.' },
  { id: 'matins', firstOp: 'op1-5', fiction: 'haller', prompt: 'The Malison: brand it only while its eye is open.' },
  { id: 'litany', firstOp: 'op1-5', fiction: 'haller', prompt: 'The Litany of Stillness: {LITANY_GESTURE} to draw a five-pointed star, or {LITANY_KEY}. Once per operation.' },
  { id: 'venom', firstOp: 'op2-1', fiction: 'ilse', prompt: 'Venom: hold the Tincture on the bite itself until the poison is drawn.' },
  { id: 'lens', firstOp: 'op2-2', fiction: 'ilse', prompt: 'Scrying Lens {TOOL_LENS}: move slowly over the flesh; hold still where it shimmers.' },
  { id: 'lens-hidden', firstOp: 'op2-2', fiction: 'ilse', prompt: 'What the Lens reveals must still be pulled — Tongs, once it shows.' },
  { id: 'egg-sacs', firstOp: 'op2-3', fiction: 'ilse', prompt: 'Egg sacs: lance each before it hatches, then brand what spills out.' },
];

const TOOL_TOKENS = Object.fromEntries(TOOL_INFO.map((t, i) => [`TOOL_${t.id.toUpperCase()}`, i + 1])) as Record<string, number>;

/** Resolve input tokens against the current device and bindings. Unknown tokens are left visible. */
export function resolvePrompt(text: string, glyph: (a: ActionId) => string = glyphFor, drag: (a: ActionId) => string = dragGlyphFor, toolKey: (slot: number) => string = toolKeyLabel): string {
  return text.replace(/\{([A-Z_]+)\}/g, (all, tok: string) => {
    if (tok in TOOL_TOKENS) return `[${toolKey(TOOL_TOKENS[tok])}]`;
    if (tok === 'USE') return glyph('primary');
    if (tok === 'USE_DRAG') return drag('primary');
    if (tok === 'LITANY_GESTURE') return `${drag('litany.draw')} ★`;
    if (tok === 'LITANY_KEY') return glyph('litany.key');
    return all;
  });
}

export const tutorial = (id: TutorialId): Tutorial => TUTORIALS.find((t) => t.id === id)!;

/** Prompts first taught in an operation, resolved for the current device. */
export const tutorialsFor = (opId: string): string[] => TUTORIALS.filter((t) => t.firstOp === opId).map((t) => resolvePrompt(t.prompt));
