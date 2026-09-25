import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex, type RGBA } from '../render/color';
import type { Gfx } from '../render/gfx';
import { TOOL_INFO, type ToolId } from '../surgery/types';
import { dragGlyphFor, glyphFor, toolKeyLabel } from '../input/glyphs';
import { Ui } from '../ui/kit';
import { menuEntry } from '../ui/controls';
import { divider, giltText, leatherPanel, medallion, UI } from '../ui/ornaments';
import { MOTION, pulse, tween } from '../ui/motion';
import { fitBlock, fitText } from '../ui/text';
import { VIEW_W } from '../ui/layout';
import { uiEvents } from '../ui/events';
import { reticle, star, toolIcon } from '../ui/widgets';

const TAU = Math.PI * 2;

/** A small looping diagram of each instrument's gesture (trace, grab-and-pull, hold, zig-zag, brush…). */
export function gestureDiagram(g: Gfx, tool: ToolId, x: number, y: number, s: number, time: number): void {
  const ink: RGBA = hex('#e8d8b0', 0.85);
  const faint: RGBA = hex('#e8d8b0', 0.3);
  const ph = (time * 0.6) % 1;
  const dot = (px: number, py: number) => g.circle(px, py, 3.2, hex(UI.gilt));
  switch (tool) {
    case 'lancet': {
      g.dashed([{ x: x - s, y: y + s * 0.3 }, { x: x + s, y: y - s * 0.3 }], 2, faint, 6, 5);
      const px = x - s + 2 * s * ph;
      g.line({ x: x - s, y: y + s * 0.3 }, { x: px, y: y + s * 0.3 - 0.6 * s * ph }, 2.5, ink);
      dot(px, y + s * 0.3 - 0.6 * s * ph);
      break;
    }
    case 'tongs': {
      g.circle(x - s * 0.5, y, s * 0.18, hex('#a0a0a8', 0.8));
      const k = Math.min(1, ph * 1.6);
      g.line({ x: x - s * 0.5, y }, { x: x - s * 0.5 + s * 1.3 * k, y: y - s * 0.4 * k }, 2, ink);
      dot(x - s * 0.5 + s * 1.3 * k, y - s * 0.4 * k);
      break;
    }
    case 'leech':
    case 'tincture':
    case 'brand': {
      g.circle(x, y, s * 0.45, hex(tool === 'leech' ? '#6a0a10' : tool === 'brand' ? '#4a1a50' : '#2a4a30', 0.8));
      g.arc(x, y, s * 0.62, 3, hex(UI.gilt, 0.9), ph);
      dot(x, y);
      break;
    }
    case 'thread': {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push({ x: x - s + (i / 8) * 2 * s, y: y + (i % 2 ? -s * 0.35 : s * 0.35) });
      g.line({ x: x - s, y }, { x: x + s, y }, 3, hex('#6a0a10', 0.9));
      const n = Math.max(2, Math.floor(ph * 9) + 1);
      g.polyline(pts.slice(0, n), 2, ink);
      dot(pts[n - 1].x, pts[n - 1].y);
      break;
    }
    case 'salve': {
      g.circle(x, y, s * 0.5, hex('#4a5a20', 0.6));
      const a = ph * TAU * 2;
      const pts = [];
      for (let i = 0; i < 24; i++) {
        const b = a - i * 0.25;
        pts.push({ x: x + Math.cos(b) * s * 0.4, y: y + Math.sin(b * 1.5) * s * 0.3 });
      }
      g.polyline(pts, 2, ink);
      dot(pts[0].x, pts[0].y);
      break;
    }
    case 'lens': {
      g.circle(x + s * 0.3, y + s * 0.1, s * 0.16, hex('#b9d7ff', 0.3 + 0.5 * pulse(time, 1.2)));
      const cx = x - s * 0.5 + s * ph;
      g.arc(cx, y, s * 0.42, 2, hex('#b9d7ff', 0.8));
      dot(cx, y);
      break;
    }
  }
}

/**
 * Controls reference card (UIX-0141): every instrument with its gesture
 * diagram, hint and *current* binding, plus the Litany. Reachable from the
 * patient chart and the pause menu; Esc / B closes.
 */
export class ControlsCardScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('controls-card');
  private t = 0;
  private closed = false;

  constructor(private tools: readonly ToolId[] = TOOL_INFO.map((i) => i.id)) {}

  private close(game: Game): void {
    if (this.closed) return;
    this.closed = true;
    game.pop?.();
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.ui.begin();
    this.ui.button('close', { x: VIEW_W / 2 - 120, y: 634, w: 240, h: 46 }, t('ui.common.back'), () => this.close(game));
    if (!this.ui.focus) this.ui.focusFirst('close');
    this.ui.update(game.input, dt);
    if (!this.closed && game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'controls-card' });
      this.close(game);
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#040202', 0.7 * k));
    const r = { x: 90, y: 24, w: 1100, h: 672 };
    leatherPanel(g, r, { alpha: 0.98 });
    giltText(g, t('ui.card.title'), VIEW_W / 2, r.y + 58, { size: 42, align: 'center' });
    divider(g, VIEW_W / 2, r.y + 78, 360);
    const tools = TOOL_INFO.filter((i) => this.tools.includes(i.id));
    const cols = 2;
    const cw = (r.w - 80) / cols;
    const rh = 100;
    tools.forEach((info, i) => {
      const cx = r.x + 40 + (i % cols) * cw;
      const cy = r.y + 100 + Math.floor(i / cols) * rh;
      medallion(g, cx + 38, cy + 40, 30);
      toolIcon(g, info.id, cx + 38, cy + 40, 0.9, g.time);
      const key = toolKeyLabel(TOOL_INFO.indexOf(info) + 1);
      fitText(g, `card.${info.id}`, t(`tool.${info.id}.name`), cx + 84, cy + 28, cw - 250, { size: 24, color: hex(UI.gilt) });
      g.text(key, cx + cw - 150, cy + 28, { size: 20, color: hex(UI.brassHi), align: 'right' });
      fitBlock(g, `card.${info.id}.hint`, t(`tool.${info.id}.hint`), cx + 84, cy + 56, cw - 250, 2, { size: 17, color: hex('#d8c8a8') }, 1.25);
      g.rect(cx + cw - 132, cy + 6, 112, 76, hex('#0a0604', 0.6));
      g.rectLine(cx + cw - 132, cy + 6, 112, 76, 1, hex(UI.brass, 0.6));
      gestureDiagram(g, info.id, cx + cw - 76, cy + 44, 40, g.time + i * 0.13);
    });
    // The Litany of Stillness.
    const ly = r.y + 100 + Math.ceil(tools.length / cols) * rh;
    {
      star(g, r.x + 78, ly + 36, 24, hex(UI.gilt));
      g.text(t('ui.card.litany'), r.x + 124, ly + 30, { size: 24, color: hex(UI.gilt) });
      const how = t('ui.card.litany_how', { draw: dragGlyphFor('litany.draw'), key: glyphFor('litany.key') });
      fitBlock(g, 'card.litany', how, r.x + 124, ly + 58, r.w - 200, 2, { size: 17, color: hex('#d8c8a8') }, 1.25);
    }
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 24);
    reticle(g, game.input.pos);
  }
}
