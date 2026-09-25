/**
 * Rich-text drawing (ENG-0174): `[b]`, `[i]`, `[color=blood]`, `[font=display]` spans plus inline
 * instrument icons (`[icon=lancet]`) and key prompts (`[key=Litany]`) resolved to the player's
 * current bindings and device glyphs, laid out once by the text engine (ENG-0173).
 */
import { isActionId, type ActionId } from '../input/actions';
import { glyphFor } from '../input/glyphs';
import { hex, type RGBA } from '../render/color';
import type { DrawLayoutOpts, Gfx } from '../render/gfx';
import type { LayoutOptions, TextLayout } from '../render/textLayout';
import { TOOL_INFO, type ToolId } from '../surgery/types';
import { toolIcon } from './widgets';

/** Friendly `[key=…]` names for the actions writers refer to. */
export const KEY_ALIASES: Record<string, ActionId> = {
  litany: 'litany.key',
  pause: 'pause',
  confirm: 'ui.confirm',
  back: 'ui.back',
  advance: 'vn.advance',
  fast: 'vn.fast',
  log: 'vn.log',
  retry: 'op.retry',
  assist: 'op.assist',
  precision: 'op.precision',
  next: 'tool.next',
  prev: 'tool.prev',
  radial: 'tool.radial',
  primary: 'primary',
};

/** The action a `[key=Name]` tag names (alias, action id, or `tool1`…`tool8`), if any. */
export function keyAction(name: string): ActionId | null {
  const n = name.toLowerCase();
  if (KEY_ALIASES[n]) return KEY_ALIASES[n];
  if (isActionId(name)) return name;
  const slot = /^tool([1-8])$/.exec(n);
  return slot ? (`tool.select.${slot[1]}` as ActionId) : null;
}

/** Current label for a `[key=…]` tag on the active device (unknown names are shown as written). */
export const resolveKey = (name: string): string => {
  const a = keyAction(name);
  return a ? glyphFor(a) : name;
};

const isTool = (id: string): id is ToolId => TOOL_INFO.some((t) => t.id === id);

/** Draws an inline icon: an instrument icon, or a key cap with the binding's label. */
export function drawInlineIcon(g: Gfx, icon: { kind: 'icon' | 'key'; id: string }, x: number, baseline: number, size: number, w: number): void {
  const cy = baseline - size * 0.36;
  if (icon.kind === 'icon') {
    if (isTool(icon.id)) toolIcon(g, icon.id, x + w / 2, cy, (size * 1.05) / 50);
    else g.circle(x + w / 2, cy, size * 0.3, hex('#e6c77a'));
    return;
  }
  const cw = w - size * 0.12;
  const h = size * 1.05;
  g.plate(x, cy - h / 2, cw, h, { radius: size * 0.18, top: hex('#2a211a', 0.95), bottom: hex('#15100c', 0.95), border: hex('#c8a060', 0.9), shadow: [0.4, 3, 1] });
  // Key labels stay at least 16 px so prompts remain readable.
  g.text(icon.id, x + cw / 2, baseline - size * 0.08, { size: Math.max(16, size * 0.72), color: hex('#f3e6c8'), align: 'center', shadow: false });
}

export interface RichTextOpts extends LayoutOptions {
  color?: RGBA;
  shadow?: RGBA | false;
  reveal?: number;
}

/** Lay out (cached) and draw rich text with its first baseline at y; returns the layout. */
export function drawRichText(g: Gfx, str: string, x: number, y: number, o: RichTextOpts = {}): TextLayout {
  const l = g.layout(str, { ...o, rich: true, resolveKey });
  const d: DrawLayoutOpts = { color: o.color, shadow: o.shadow, reveal: o.reveal, icon: drawInlineIcon };
  g.drawLayout(l, x, y, d);
  return l;
}
