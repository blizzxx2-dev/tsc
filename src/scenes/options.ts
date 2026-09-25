import type { Game, Scene } from '../core/scene';
import { glass, heading, INK } from '../ui/hudKit';
import { DEFAULT_SETTINGS, saveSettings, settings, type Settings } from '../core/settings';
import { WINDOW_SIZES, windowSizeOf, type WindowSize } from '../core/settings/schema';
import { platform } from '../platform';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { getLocale, menuLocales, t } from '../i18n';
import { setLocale } from '../i18n';
import { bindings, DEFAULT_PREFS } from '../input/bindings';
import { ControlsScene } from '../input/controlsScene';
import { glyphFor } from '../input/glyphs';
import { litanyMode } from '../input/opinput';
import { Ui, type UiNode } from '../ui/kit';
import { drawTooltip, menuEntry, optionRow, sealButton, tab } from '../ui/controls';
import { UI } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { ScrollList } from '../ui/scroll';
import { fitBlock } from '../ui/text';
import { uiEvents } from '../ui/events';
import { palette, PALETTES, type PaletteId } from '../ui/theme';
import { ChoiceScene } from './choice';
import { ControlsCardScene } from './controlsCard';
import { CalibrateScene } from './calibrate';
import { AudioOptionsScene } from '../audio/options-scene';
import { GameplayOptionsScene } from './gameplayOptions';

export type OptionsTab = 'gameplay' | 'controls' | 'display' | 'audio' | 'access' | 'language';
export const OPTION_TABS: readonly OptionsTab[] = ['gameplay', 'controls', 'display', 'audio', 'access', 'language'];

/** One options row, declared as data (UIX-0104). */
export interface OptionRow {
  id: string;
  /** String key of the label; `${label}_note` is its one-line description (UIX-0107). */
  label: string;
  kind: 'toggle' | 'choice' | 'slider' | 'action';
  /** Toggle state. */
  on?: () => boolean;
  /** Choices: localised labels and the current index. */
  options?: () => string[];
  index?: () => number;
  /** Slider: current value 0..1 and its label. */
  frac?: () => number;
  step?: number;
  set?: (v: number | boolean, game: Game) => void;
  value?: () => string;
  /** Action rows open something. */
  run?: (game: Game) => void;
  /** Settings keys this row owns (restored by the tab's Defaults). */
  keys?: (keyof Settings)[];
  /** Input prefs owned by this row (restored by Defaults). */
  prefs?: (keyof typeof DEFAULT_PREFS)[];
  /** Shows the colour-filter preview swatches next to the description. */
  preview?: 'palette';
}

/** String key of a row's one-line description. */
export const noteKey = (row: OptionRow): string => row.label + '_note';

/** A row's label and note. Default labels are `ui.options.<id>`, spelled as templates so the key scanner sees them. */
const rowLabel = (row: OptionRow): string => (row.label === `ui.options.${row.id}` ? t(`ui.options.${row.id}`) : t(row.label));
const rowNote = (row: OptionRow): string => (row.label === `ui.options.${row.id}` ? t(`ui.options.${row.id}_note`) : t(noteKey(row)));

const onOff = (on: boolean): string => t(on ? 'ui.common.on' : 'ui.common.off');
const pct = (v: number) => t('ui.options.volume_value', { value: v });

const toggle = (id: string, key: keyof Settings, label = `ui.options.${id}`): OptionRow => ({
  id,
  label,
  kind: 'toggle',
  on: () => !!settings[key],
  set: (v) => ((settings as unknown as Record<string, unknown>)[key] = !!v),
  keys: [key],
});

function choice<T>(id: string, key: keyof Settings, values: readonly T[], labels: () => string[], label = `ui.options.${id}`): OptionRow {
  return {
    id,
    label,
    kind: 'choice',
    options: labels,
    index: () => Math.max(0, values.indexOf(settings[key] as T)),
    set: (i) => ((settings as unknown as Record<string, unknown>)[key] = values[i as number]),
    keys: [key],
  };
}

function slider(id: string, key: keyof Settings, min: number, max: number, step: number, fmt: (v: number) => string, label = `ui.options.${id}`): OptionRow {
  return {
    id,
    label,
    kind: 'slider',
    step: step / (max - min),
    frac: () => ((settings[key] as number) - min) / (max - min),
    value: () => fmt(settings[key] as number),
    set: (f) => ((settings as unknown as Record<string, unknown>)[key] = Math.round((min + (f as number) * (max - min)) / step) * step),
    keys: [key],
  };
}

const prefToggle = (id: string, pref: 'invertWheel' | 'wrapWheel' | 'aimAssist' | 'autoTool' | 'leftHanded', sync?: (v: boolean) => void): OptionRow => ({
  id,
  label: `ui.options.${id}`,
  kind: 'toggle',
  on: () => bindings.prefs[pref],
  set: (v) => {
    bindings.prefs[pref] = !!v;
    sync?.(!!v);
    bindings.save();
  },
  prefs: [pref],
});

/** The rows of each tab. Only options that change something in this build are listed. */
export function optionRows(tabId: OptionsTab): OptionRow[] {
  switch (tabId) {
    case 'gameplay':
      return [
        { id: 'gameplay', label: 'ui.options.gameplay', kind: 'action', run: (g) => g.push?.(new GameplayOptionsScene(() => g.pop!())) },
        choice('tool_hints', 'toolHints', ['always', 'first', 'off'] as const, () => [t('ui.options.hints_always'), t('ui.options.hints_first'), t('ui.options.hints_off')]),
        toggle('damage_numbers', 'damageNumbers'),
        toggle('minimal_hud', 'minimalHud'),
        toggle('confirm_abandon', 'confirmAbandon'),
        toggle('skip_seen_tutorials', 'skipSeenTutorials'),
        choice('timer_assist', 'timerAssist', [1, 1.5, 2] as const, () => [t('ui.options.timer_standard'), t('ui.options.timer_generous'), t('ui.options.timer_relaxed')]),
        {
          id: 'litany_input',
          label: 'ui.options.litany_input',
          kind: 'choice',
          options: () => [t('ui.options.litany_draw'), t('ui.options.litany_keyname', { key: glyphFor('litany.key', 'kbm') }), t('ui.options.litany_either')],
          index: () => ['draw', 'key', 'both'].indexOf(litanyMode()),
          set: (i) => {
            bindings.prefs.litanyInput = (['draw', 'key', 'both'] as const)[i as number];
            settings.litanyKey = bindings.prefs.litanyInput !== 'draw';
            bindings.save();
          },
          keys: ['litanyKey'],
          prefs: ['litanyInput'],
        },
        prefToggle('invert_wheel', 'invertWheel'),
        prefToggle('wrap_wheel', 'wrapWheel'),
        toggle('pause_on_focus_loss', 'pauseOnFocusLoss'),
      ];
    case 'controls':
      return [
        { id: 'rebind', label: 'ui.options.rebind', kind: 'action', run: (g) => (g.push ? g.push(new ControlsScene(() => g.pop!(), 'overlay')) : undefined) },
        { id: 'card', label: 'ui.options.card', kind: 'action', run: (g) => g.push?.(new ControlsCardScene()) },
        {
          id: 'cursor_speed',
          label: 'ui.options.cursor_speed',
          kind: 'slider',
          step: 0.1 / 1.5,
          frac: () => (bindings.prefs.cursorSpeed - 0.5) / 1.5,
          value: () => pct(bindings.prefs.cursorSpeed),
          set: (f) => {
            bindings.prefs.cursorSpeed = Math.round((0.5 + (f as number) * 1.5) * 10) / 10;
            bindings.save();
          },
          prefs: ['cursorSpeed'],
        },
        {
          id: 'hold_mode',
          label: 'ui.options.hold_mode',
          kind: 'choice',
          options: () => [t('ui.options.hold_hold'), t('ui.options.hold_toggle')],
          index: () => (bindings.prefs.holdMode === 'toggle' ? 1 : 0),
          set: (i) => {
            bindings.prefs.holdMode = i ? 'toggle' : 'hold';
            settings.holdToToggle = !!i;
            bindings.save();
          },
          keys: ['holdToToggle'],
          prefs: ['holdMode'],
        },
        {
          id: 'target_size',
          label: 'ui.options.target_size',
          kind: 'choice',
          options: () => ['100%', '125%', '150%'],
          index: () => [1, 1.25, 1.5].indexOf(bindings.prefs.hitScale),
          set: (i) => {
            bindings.prefs.hitScale = ([1, 1.25, 1.5] as const)[i as number];
            bindings.save();
          },
          prefs: ['hitScale'],
        },
        {
          id: 'grab_mode',
          label: 'ui.options.grab_mode',
          kind: 'choice',
          options: () => [t('ui.options.hold_hold'), t('ui.options.hold_toggle')],
          index: () => (bindings.prefs.grabMode === 'toggle' ? 1 : 0),
          set: (i) => {
            bindings.prefs.grabMode = i ? 'toggle' : 'hold';
            bindings.save();
          },
          prefs: ['grabMode'],
        },
        prefToggle('auto_tool', 'autoTool'),
        prefToggle('left_handed', 'leftHanded', (v) => (settings.leftHanded = v)),
        prefToggle('aim_assist', 'aimAssist'),
      ];
    case 'display':
      return [
        choice('display_mode', 'displayMode', ['windowed', 'borderless', 'fullscreen'] as const, () => [t('ui.options.mode_windowed'), t('ui.options.mode_borderless'), t('ui.options.mode_fullscreen')]),
        ...(platform.kind === 'desktop' ? [{ ...choice('window_size', 'windowSize', WINDOW_SIZES, () => WINDOW_SIZES.map((w) => w.replace('x', ' × '))), set: (i: number | boolean) => applyWindowSize(WINDOW_SIZES[i as number]) }] : []),
        toggle('vsync', 'vsync'),
        choice('frame_limit', 'frameCap', [0, 30, 60, 120, 144] as const, () => [t('ui.options.frame_display'), '30', '60', '120', '144'], 'ui.options.frame_limit'),
        choice('render_scale', 'renderScale', [0.5, 0.75, 0.85, 1] as const, () => ['50%', '75%', '85%', t('ui.options.render_native')], 'ui.options.render_scale'),
        slider('brightness', 'brightness', 0.7, 1.3, 0.05, (v) => pct(v)),
        { id: 'calibrate', label: 'ui.options.calibrate', kind: 'action', run: (g) => g.push?.(new CalibrateScene(() => g.pop!())) },
        toggle('bloom', 'bloom'),
        slider('bloom_amount', 'bloomAmount', 0, 100, 5, (v) => `${v}%`),
        toggle('grain', 'grain'),
        slider('grain_amount', 'grainAmount', 0, 100, 5, (v) => `${v}%`),
        toggle('vignette', 'vignette'),
        toggle('flicker', 'flicker'),
        slider('flicker_amount', 'flickerAmount', 0, 100, 5, (v) => `${v}%`),
        toggle('chroma', 'chromaticAberration'),
        slider('chroma_amount', 'chromaAmount', 0, 100, 5, (v) => `${v}%`),
        slider('shake', 'shake', 0, 1, 0.05, (v) => (v <= 0 ? t('ui.options.shake_off') : pct(v)), 'ui.options.shake'),
      ];
    case 'audio':
      return [
        // The full mixer (buses, heartbeat, comfort, captions and subtitles) lives on its own screen.
        { id: 'mixer', label: 'ui.options.mixer', kind: 'action', run: (g) => g.push?.(new AudioOptionsScene(() => g.pop!(), true)) },
        slider('volume', 'volume', 0, 1, 0.1, (v) => pct(v), 'ui.options.volume'),
        { ...toggle('sound', 'muted', 'ui.options.sound'), on: () => !settings.muted, set: (v) => (settings.muted = !v) },
        toggle('mute_unfocused', 'muteWhenUnfocused'),
      ];
    case 'access':
      return [
        choice('text_scale', 'textScale', [1, 1.25, 1.5, 1.75] as const, () => ['100%', '125%', '150%', '175%']),
        choice('text_speed', 'textSpeed', [0.5, 1, 1.5, 3] as const, () => [t('ui.options.speed_slow'), t('ui.options.speed_normal'), t('ui.options.speed_fast'), t('ui.options.speed_instant')]),
        slider('box_opacity', 'textBoxOpacity', 0.6, 1, 0.1, (v) => pct(v)),
        toggle('reduce_motion', 'reduceMotion'),
        toggle('reduce_flashing', 'reduceFlashing', 'ui.options.reduce_flashing'),
        { ...choice('colour_filter', 'colorFilter', Object.keys(PALETTES) as PaletteId[], () => (Object.keys(PALETTES) as PaletteId[]).map((k) => t(`ui.options.filter_${k}`))), preview: 'palette' },
        choice('cursor_size', 'cursorSize', [1, 1.25, 1.5, 2] as const, () => ['100%', '125%', '150%', '200%']),
        choice('cursor_colour', 'cursorColor', ['brass', 'white', 'cyan', 'magenta'] as const, () => [t('ui.options.cursor_brass'), t('ui.options.cursor_white'), t('ui.options.cursor_cyan'), t('ui.options.cursor_magenta')]),
        toggle('resume_countdown', 'resumeCountdown'),
        toggle('skip_unread', 'skipUnread'),
      ];
    case 'language': {
      const list = menuLocales();
      return [
        {
          id: 'language',
          label: 'ui.options.language',
          kind: 'choice',
          options: () => list.map((l) => l.name),
          index: () => Math.max(0, list.findIndex((l) => l.code === getLocale())),
          set: (i) => {
            const code = list[i as number]?.code ?? 'en';
            settings.language = code;
            void setLocale(code);
          },
          keys: ['language'],
        },
      ];
    }
  }
}

/**
 * Windowed-mode size preset (UIX-0105). The desktop bridge has no resize channel yet, so this asks
 * the window itself; Electron honours `resizeTo` for the main window only when the platform allows it,
 * and the setting is kept for the desktop shell to apply on launch.
 */
export function applyWindowSize(size: WindowSize): void {
  settings.windowSize = size;
  if (platform.kind !== 'desktop' || settings.displayMode !== 'windowed') return;
  const { w, h } = windowSizeOf(size);
  try {
    (globalThis as { resizeTo?: (w: number, h: number) => void }).resizeTo?.(w, h);
  } catch {
    // The shell may refuse: the preset still persists for the next launch.
  }
}

/** Restore a tab's options to their defaults (UIX-0104 per-tab Defaults). */
export function resetTab(tabId: OptionsTab): void {
  for (const row of optionRows(tabId)) {
    for (const k of row.keys ?? []) (settings as unknown as Record<string, unknown>)[k] = structuredClone(DEFAULT_SETTINGS[k]);
    for (const p of row.prefs ?? []) (bindings.prefs as unknown as Record<string, unknown>)[p] = structuredClone(DEFAULT_PREFS[p]);
  }
  if (tabId === 'language') void setLocale(getLocale());
  bindings.save();
  saveSettings();
}

/**
 * Options (UIX-0104–0107): tabs Gameplay / Controls / Display / Audio /
 * Accessibility / Language, every row with a one-line description, live
 * preview (each change applies and saves at once), per-tab Defaults, and
 * Back. Reachable from the title and the pause menu (as an overlay).
 */
export class OptionsScene implements Scene {
  readonly ui = new Ui('options');
  private tab: OptionsTab = 'gameplay';
  private tabT = 0;
  private t = 0;
  private list = new ScrollList({ x: 214, y: 186, w: 852, h: 372 }, 46, 4);
  private rows: OptionRow[] = optionRows('gameplay');

  constructor(
    private onBack: () => void,
    /** true: chapel backdrop; false: plain screen; 'overlay': drawn over the live scene beneath (scene stack). */
    private overWorld: boolean | 'overlay' = true,
    initialTab: OptionsTab = 'gameplay',
  ) {
    this.overlay = overWorld === 'overlay';
    this.setTab(initialTab);
  }

  readonly overlay: boolean;

  private setTab(tabId: OptionsTab): void {
    if (tabId === this.tab && this.rows.length) return;
    this.tab = tabId;
    this.rows = optionRows(tabId);
    this.tabT = 0;
    this.list.offset = this.list.target = 0;
    uiEvents.emit('ui.tab', { id: `options/${tabId}`, index: OPTION_TABS.indexOf(tabId) });
  }

  private change(row: OptionRow, v: number | boolean, game: Game): void {
    row.set?.(v, game);
    saveSettings();
    game.audio.volume = settings.volume;
    game.audio.muted = settings.muted;
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    OPTION_TABS.forEach((id, i) => ui.add({ id: `tab.${id}`, kind: 'tab', rect: { x: 202 + i * 146, y: 128, w: 142, h: 42 }, label: t(`ui.options.tab.${id}`), on: id === this.tab, onActivate: () => this.setTab(id) }));
    this.rows.forEach((row, i) => {
      const rect = this.list.rowRect(i);
      const base = { id: `row${i}`, rect, label: rowLabel(row), clip: this.list.view, tip: undefined };
      if (row.kind === 'toggle') ui.add({ ...base, kind: 'toggle', on: row.on!(), value: onOff(row.on!()), onActivate: () => this.change(row, !row.on!(), game), onAdjust: () => this.change(row, !row.on!(), game) });
      else if (row.kind === 'slider') {
        const f = row.frac!();
        const step = row.step ?? 0.1;
        const snap = (x: number) => Math.max(0, Math.min(1, Math.round(x / step) * step));
        ui.add({ ...base, kind: 'slider', frac: f, value: row.value?.(), onAdjust: (d) => this.change(row, snap(f + d * step), game), onDrag: (x) => this.change(row, snap(x), game) });
      } else if (row.kind === 'choice') {
        const opts = row.options!();
        const idx = row.index!();
        const n = opts.length;
        ui.add({
          ...base,
          kind: 'dropdown',
          value: opts[idx] ?? '',
          onAdjust: (d) => this.change(row, (idx + d + n) % n, game),
          onActivate: () => {
            if (game.push) game.push(new ChoiceScene(rect, opts, idx, (i) => this.change(row, i, game)));
            else this.change(row, (idx + 1) % n, game);
          },
        });
      } else ui.add({ ...base, kind: 'button', style: 'action', onActivate: () => row.run?.(game) });
    });
    ui.button('defaults', { x: 230, y: 626, w: 220, h: 46 }, t('ui.options.defaults'), () => resetTab(this.tab));
    ui.button('back', { x: VIEW_W / 2 + 190, y: 622, w: 240, h: 54 }, t('ui.common.back'), () => this.back(), { style: 'seal' });
    if (!ui.focus) ui.focusFirst('row0');
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    this.t += dt;
    this.tabT += dt;
    if (this.list.update(input, this.rows.length, dt)) this.ui.cancelPress();
    this.layout(game);
    this.ui.update(input, dt);
    this.list.follow(this.ui, 'row');
    const ti = OPTION_TABS.indexOf(this.tab);
    if (input.actPressed('ui.tabNext')) this.setTab(OPTION_TABS[(ti + 1) % OPTION_TABS.length]);
    if (input.actPressed('ui.tabPrev')) this.setTab(OPTION_TABS[(ti + OPTION_TABS.length - 1) % OPTION_TABS.length]);
    if (input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'options' });
      this.back();
    }
  }

  private back(): void {
    saveSettings();
    bindings.save();
    this.onBack();
  }

  render(g: Gfx, game: Game): void {
    const k = this.overlay ? tween(this.t, MOTION.panel) : 1;
    if (this.overlay) {
      const vr = g.viewRect();
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.6 * k));
    } else if (this.overWorld) {
      g.beginWorld();
      drawBackdrop(g, 'chapel', g.time);
      g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1, defocus: 8 });
    } else g.beginScreen();
    const pr = { x: 180, y: 34, w: 920, h: 656 };
    glass(g, pr, { strength: 1.12, alpha: k });
    heading(g, t('ui.options.title'), VIEW_W / 2, 92, 360, k, 30);
    // Page under the tabs: a recessed well.
    g.plate(pr.x + 18, 172, pr.w - 36, 400, { radius: 2, top: hex('#060504', 0.55), bottom: hex('#0c0907', 0.55), border: hex(INK.gilt, 0.22), borderW: 1, bevel: -0.4, shadow: [0, 0, 0], grain: 0.4 });
    const t0 = g.time;
    const fade = tween(this.tabT, MOTION.page);
    g.pushClip(this.list.view);
    for (const n of this.ui.nodes) {
      if (!n.id.startsWith('row')) continue;
      const s = this.ui.state(n.id);
      const shifted: UiNode = fade < 1 ? { ...n, rect: { ...n.rect, x: n.rect.x + (1 - fade) * 24 } } : n;
      if (n.kind === 'button') {
        optionRow(g, { ...shifted, value: '' }, s, t0, { size: 23, split: 0.7 });
        g.poly(
          [
            { x: n.rect.x + n.rect.w - 30, y: n.rect.y + 15 },
            { x: n.rect.x + n.rect.w - 18, y: n.rect.y + 23 },
            { x: n.rect.x + n.rect.w - 30, y: n.rect.y + 31 },
          ],
          hex(INK.gold),
        );
      } else optionRow(g, shifted, s, t0, { size: 23, split: 0.5 });
      g.rect(n.rect.x + 12, n.rect.y + n.rect.h + 2, n.rect.w - 24, 1, hex(INK.gilt, 0.12));
    }
    g.popClip();
    this.list.drawBar(g, this.rows.length);
    for (const n of this.ui.nodes) {
      if (n.kind === 'tab') tab(g, n, this.ui.state(n.id), t0, !!n.on, 21);
      else if (n.style === 'seal') sealButton(g, n, this.ui.state(n.id), t0, 26);
      else if (n.id === 'defaults') menuEntry(g, n, this.ui.state(n.id), t0, 22);
    }
    // Description of the focused row (UIX-0107), with a live palette preview for the colour filter.
    const fi = ScrollList.focusIndex(this.ui, 'row');
    const row = fi >= 0 ? this.rows[fi] : undefined;
    if (row) {
      const noteW = row.preview ? 560 : 820;
      fitBlock(g, `options.${row.id}.note`, rowNote(row), 230, 596, noteW, 1, { size: 17, font: 'italic', color: hex(INK.dim) });
      if (row.preview === 'palette') paletteSwatches(g, 820, 574);
    }
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}

/** Sample chips for the active palette: vitals states, ratings, ichor, curse and Litany. */
export function paletteSwatches(g: Gfx, x: number, y: number): void {
  const p = palette();
  const chips = [p.vitalsGood, p.vitalsWarn, p.vitalsDanger, p.cool[0], p.good[0], p.bad[0], p.miss[0], p.blood, p.pus, p.bile, p.curse, p.litany];
  chips.forEach((c, i) => {
    g.rect(x + i * 20, y, 16, 22, hex(c));
    g.rectLine(x + i * 20, y, 16, 22, 1, hex(UI.brass, 0.7));
  });
}
