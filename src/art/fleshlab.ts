/**
 * Flesh look-dev page (`?scene=fleshlab`): pick organ × species, grade and Litany sepia,
 * drive u_light, u_pulse, u_corrupt and the membrane softness with sliders, and compare
 * side by side (Tab) against the procedural baseline (human `flesh`, no corruption).
 * Test marks (M) paint a scar, an incision and a stain into the surface layer so ailment
 * readability can be judged on every tissue.
 */
import type { Game, Scene } from '../core/scene';
import { HOUR_CURSE, type Hour } from './curse';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { surfDisc, surfLine } from '../surgery/entities';
import { FIELD, type OperationDef, type OrganKind } from '../surgery/operation';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { giltText, oakPanel, UI } from '../ui/ornaments';
import { brassSlider, inRect, reticle } from '../ui/widgets';

const ORGANS: OrganKind[] = ['flesh', 'heart', 'lung', 'gut', 'liver', 'brain', 'bone', 'muscle', 'skin'];
type Species = NonNullable<OperationDef['race']>;
const SPECIES: Species[] = ['human', 'dwarf', 'elf', 'orc', 'hornfolk', 'giant'];
const GRADES = ['candle', 'dawn', 'curse', 'failing', 'neutral'];

export class FleshLabScene implements Scene {
  organ: OrganKind = 'flesh';
  species: Species = 'human';
  grade = 0;
  light = 0.62;
  pulse = 0.4;
  autoPulse = true;
  corrupt = 0;
  soft = 0.1;
  litany = false;
  compare = false;
  marks = true;
  /** `?curse=terce`: preview that Malison Hour's corruption palette (ART-0183). */
  hour: Hour = 'matins';
  private beat = 0;

  constructor() {
    const q = new URLSearchParams(location.search);
    const o = q.get('organ') as OrganKind | null;
    if (o && ORGANS.includes(o)) this.organ = o;
    const s = q.get('species') as Species | null;
    if (s && SPECIES.includes(s)) this.species = s;
    if (q.get('compare')) this.compare = true;
    if (q.get('marks')) this.marks = true;
    if (q.get('corrupt')) this.corrupt = Number(q.get('corrupt'));
    const h = q.get('curse') as Hour | null;
    if (h && h in HOUR_CURSE) this.hour = h;
    this.soft = organPalette({ organ: this.organ, race: this.species } as OperationDef).cellSoft;
  }

  update(dt: number, game: Game): void {
    const k = game.input;
    this.beat = (this.beat + dt * 1.2) % 1;
    if (this.autoPulse) this.pulse = Math.exp(-this.beat * 8);
    if (k.keyPressed('Tab')) this.compare = !this.compare;
    if (k.keyPressed('KeyM')) this.marks = !this.marks;
    if (k.keyPressed('KeyL')) this.litany = !this.litany;
  }

  private field(g: Gfx, organ: OrganKind, species: Species, corrupt: number, soft: number): void {
    const pal = organPalette({ organ, race: species } as OperationDef);
    const a = this.light * Math.PI * 2;
    g.fleshField({
      center: { x: FIELD.cx, y: FIELD.cy },
      radii: { x: FIELD.rx, y: FIELD.ry },
      kind: pal.kind,
      base: pal.base,
      deep: pal.deep,
      vein: pal.vein,
      pulse: this.pulse,
      light: { x: FIELD.cx + Math.cos(a) * 420, y: FIELD.cy + Math.sin(a) * 260 },
      corrupt,
      curse: HOUR_CURSE[this.hour],
      cellSoft: soft,
      species: pal.species,
    });
  }

  render(g: Gfx, game: Game): void {
    g.beginLayer('surface');
    if (this.marks) {
      surfLine(g, [{ x: 520, y: 300 }, { x: 600, y: 330 }, { x: 700, y: 320 }, { x: 780, y: 360 }], 7, 0.18, 0.15, 0, 0.1);
      surfLine(g, [{ x: 560, y: 470 }, { x: 760, y: 500 }], 12, 0, 0, 0, 0.2);
      surfDisc(g, { x: 900, y: 420 }, 60, 0, 0.3);
      // A deep incision: its lips show skin, dermis and fat in section, sized by the people's hide.
      surfLine(g, [{ x: 430, y: 380 }, { x: 520, y: 405 }, { x: 610, y: 400 }], 14, 1, 0, 0, 0);
    }
    g.endLayer();
    g.beginLayer('fluid');
    g.endLayer();
    g.beginWorld();
    const split = FIELD.cx;
    if (this.compare) {
      g.clipRect({ x: 0, y: 0, w: split, h: VIEW_H });
      this.field(g, this.organ, this.species, this.corrupt, this.soft);
      g.clipRect({ x: split, y: 0, w: VIEW_W - split, h: VIEW_H });
      this.field(g, 'flesh', 'human', 0, 0.1);
      g.clipRect(null);
      g.line({ x: split, y: 0 }, { x: split, y: VIEW_H }, 2, hex(UI.gilt, 0.8));
    } else this.field(g, this.organ, this.species, this.corrupt, this.soft);
    g.endWorld({
      litany: this.litany ? 1 : 0,
      danger: 0,
      shake: { x: 0, y: 0 },
      bloom: 0.7,
      lutA: GRADES[this.grade],
      lutB: 'curse',
      lutMix: this.corrupt * 0.8,
      litanyCenter: [0.5, 0.5],
      litanyAge: 3,
    });

    // Control panel.
    const input = game.input;
    const P = { x: 10, y: 10, w: 250, h: 600 };
    oakPanel(g, P, { alpha: 0.94 });
    giltText(g, 'Flesh Lab', P.x + P.w / 2, P.y + 58, { size: 30, align: 'center' });
    const label = (s: string, yy: number) => g.text(s, P.x + 22, yy, { size: 15, font: 'italic', color: hex(UI.parch) });
    const chips = <T extends string>(items: T[], cur: T, y0: number, set: (v: T) => void): number => {
      let x = P.x + 22;
      let yy = y0;
      for (const it of items) {
        const w = g.measure(it, 15) + 16;
        if (x + w > P.x + P.w - 16) {
          x = P.x + 22;
          yy += 26;
        }
        const r = { x, y: yy - 16, w, h: 22 };
        const on = it === cur;
        g.rect(r.x, r.y, r.w, r.h, hex(on ? '#6a1418' : '#140a06', on ? 0.95 : 0.75));
        g.rectLine(r.x, r.y, r.w, r.h, 1, hex(on ? UI.gilt : UI.brassLo));
        g.text(it, r.x + r.w / 2, yy, { size: 15, color: hex(on ? '#fff0c0' : UI.parch), align: 'center', shadow: false });
        if (input.pressed && inRect(input.pos, r)) set(it);
        x += w + 6;
      }
      return yy;
    };
    label('Organ', P.y + 96);
    let y = chips(ORGANS, this.organ, P.y + 120, (v) => {
      this.organ = v;
      this.soft = organPalette({ organ: v, race: this.species } as OperationDef).cellSoft;
    });
    label('Species', y + 34);
    y = chips(SPECIES, this.species, y + 58, (v) => (this.species = v));
    label('Grade', y + 34);
    y = chips(GRADES, GRADES[this.grade], y + 58, (v) => (this.grade = GRADES.indexOf(v)));
    const slider = (name: string, yy: number, v: number): number => {
      label(`${name}  ${v.toFixed(2)}`, yy);
      return brassSlider(g, input, P.x + 26, yy + 18, P.w - 52, v);
    };
    y += 44;
    this.light = slider('u_light (angle)', y, this.light);
    const before = this.pulse;
    this.pulse = slider(`u_pulse${this.autoPulse ? ' (auto)' : ''}`, y + 48, this.pulse);
    if (this.pulse !== before && input.down) this.autoPulse = false;
    this.corrupt = slider('u_corrupt', y + 96, this.corrupt);
    this.soft = slider('membrane softness', y + 144, this.soft * 4) / 4;
    const hint = `Tab: ${this.compare ? 'single view' : 'compare with baseline'}    M: test marks    L: Litany sepia${this.litany ? ' (on)' : ''}`;
    g.text(hint, P.x + P.w + 20, VIEW_H - 14, { size: 14, color: hex(UI.parch, 0.85) });
    if (this.compare) {
      g.text(`${this.species} ${this.organ}`, split - 16, 40, { size: 18, font: 'italic', color: hex(UI.parch), align: 'right' });
      g.text('baseline: human flesh', split + 16, 40, { size: 18, font: 'italic', color: hex(UI.parch) });
    }
    reticle(g, input.pos);
    g.endFrame();
  }
}
