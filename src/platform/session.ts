/**
 * Glue between the running game and the platform services. `src/main.ts` calls three hooks:
 *   installPlatform(game)   once, after the renderer and input exist
 *   sceneChanged(scene)     from Game.go()
 *   platformFrame(dt)       every frame, right after input.beginFrame()
 * Everything else — rich presence, achievements, playtime, focus/suspend pause, display sleep, quit
 * guard, gamepad, settings application, first-launch detection, kiosk idle reset, crash capture,
 * watermark, demo import — hangs off these.
 */
import type { Game, Scene } from '../core/scene';
import { addPlaytime, activeSave, flushSaves, setSlotDescriber, setThumbnailSource, store } from '../core/save';
import { firstLaunch, onSettingChange, saveSettings, settings } from '../core/settings';
import { autoDetect } from '../core/settings/detect';
import { CAMPAIGN } from '../content/campaign';
import { OperationScene } from '../scenes/operation';
import { StoryScene } from '../scenes/story';
import { BriefingScene } from '../scenes/briefing';
import { ResultsScene } from '../scenes/results';
import { TitleScene } from '../scenes/title';
import { playStep, save } from '../scenes/flow';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { t } from '../i18n';
import { platform } from './index';
import { Achievements, type AchievementState } from './achievements';
import { BUILD, EDITION, buildLabel } from './build';
import { IMPORT_DIALOG, importDemoProfile, indexCampaign, readDemoProfile } from './carryover';
import { installErrorCapture, markFrame, parseDsn } from './crash';
import { DisplayChangeGuard, type DisplayConfig } from './display';
import { onGameEvent, type GameEvent } from './events';
import { flag } from './flags';
import { GamepadController } from './gamepad';
import { addScrubSecret, log } from './log';
import { attachPresenter, notify, setBusyHandler } from './notify';
import { OverlayGate } from './overlay';
import { presenceFor, type Activity } from './richpresence';
import { prompt, SaveIndicator, showNotice, showWatermark } from './ui';

/** Idle longer than this stops the playtime clock (PLT-0090). */
export const IDLE_LIMIT_S = 5 * 60;
/** Kiosk/booth mode returns to the title after this much inactivity (PLT-0074). */
export const KIOSK_IDLE_S = 90;

interface Pausable {
  paused?: boolean;
  op?: { status: string; def: { id: string; patient: string } };
}

let game: Game | null = null;
let scene: Scene | null = null;
let focused = true;
let idle = 0;
let heartbeatT = 0;
let started = false;
let achievements: Achievements | null = null;
let gamepad: GamepadController | null = null;
let overlay: OverlayGate | null = null;
/** Steam Timeline (PLT-0050): the operation whose start marker was sent, and whether its Malison marker was. */
let timelineOp: OperationScene | null = null;
let timelineBoss = false;
let lastActivityKey = '';
let lastPresence = '';
const refreshSamples: number[] = [];

const numeral = (chapter: number) => CAMPAIGN[chapter]?.numeral ?? String(chapter + 1);

function chapterOfOp(id: string): number {
  return Math.max(0, CAMPAIGN.findIndex((c) => c.steps.some((s) => s.kind === 'op' && s.op.id === id)));
}

function operationOf(s: Scene | null): Pausable['op'] | undefined {
  return (s as Pausable | null)?.op;
}

/** Pause an operation in progress (focus loss, overlay, suspend, controller loss). */
export function pauseOperation(): void {
  if (!(scene instanceof OperationScene)) return;
  const s = scene as unknown as Pausable;
  if (s.op && s.op.status !== 'won' && s.op.status !== 'lost') s.paused = true;
}

/* Field-snapshot thumbnail for save slots (PLT-0086): grabbed once per operation, 3 s in, inside the
   same task as the frame's render (a microtask after the rAF callback) so the WebGL buffer is intact. */
let thumb: string | undefined;
let thumbScene: Scene | null = null;
let thumbT = 0;
function maybeCaptureThumbnail(dt: number): void {
  if (!(scene instanceof OperationScene) || thumbScene === scene) return;
  thumbT += dt;
  if (thumbT < 3) return;
  thumbScene = scene;
  thumbT = 0;
  const src = game?.gfx.gl.canvas as HTMLCanvasElement | undefined;
  queueMicrotask(() => {
    try {
      if (!src) return;
      const c = document.createElement('canvas');
      c.width = 192;
      c.height = 108;
      c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
      thumb = c.toDataURL('image/jpeg', 0.6);
    } catch {
      // tainted/lost context: keep the previous thumbnail
    }
  });
}

function activity(s: Scene | null): Activity {
  const op = operationOf(s);
  if (op) {
    const chapter = numeral(chapterOfOp(op.def.id));
    return s instanceof ResultsScene ? { kind: 'results', chapter, patient: op.def.patient } : { kind: 'operating', chapter, patient: op.def.patient };
  }
  if (s instanceof StoryScene) return { kind: 'story', chapter: numeral(save.progress.chapter) };
  if (s instanceof BriefingScene) return { kind: 'briefing', chapter: numeral(save.progress.chapter), patient: '' };
  return { kind: 'menu' };
}

function updateActivity(): void {
  const s = scene as unknown as Pausable | null;
  const op = scene instanceof OperationScene ? scene.op : undefined;
  const operating = !!op && op.status !== 'won' && op.status !== 'lost';
  const paused = !!s?.paused;
  const a = { preventSleep: (operating && !paused) || scene instanceof StoryScene, guardQuit: operating, kioskIdleReset: platform.args.kiosk };
  const key = JSON.stringify(a);
  if (key !== lastActivityKey) {
    lastActivityKey = key;
    platform.setActivity(a);
  }
  const presence = presenceFor(activity(scene));
  const pk = JSON.stringify(presence);
  if (pk !== lastPresence) {
    lastPresence = pk;
    platform.steam.setRichPresence(presence);
  }
}

function applyAudio(): void {
  if (!game) return;
  game.audio.volume = settings.volume;
  game.audio.muted = settings.muted || (!focused && settings.muteWhenUnfocused);
}

function installSettings(): void {
  onSettingChange('volume', applyAudio);
  onSettingChange('muted', applyAudio);
  onSettingChange('muteWhenUnfocused', applyAudio);
  onSettingChange('crashReports', (v) => platform.setCrashConsent(v === 'on'));
  platform.setCrashConsent(settings.crashReports === 'on');

  let applied: DisplayConfig = { mode: settings.displayMode, monitor: settings.monitor };
  const guard = new DisplayChangeGuard(
    (c) => platform.window.setMode(c.mode, c.monitor < 0 ? null : c.monitor),
    (ms) => prompt({ title: 'Keep these display settings?', message: 'The display mode was changed.', buttons: ['Keep', 'Revert'], timeoutMs: ms, timeoutIndex: 1, countdown: true }).then((i) => i === 0),
  );
  const onDisplay = () => {
    const next: DisplayConfig = { mode: settings.displayMode, monitor: settings.monitor };
    void guard.change(applied, next).then((kept) => {
      applied = kept;
      if (kept.mode !== settings.displayMode || kept.monitor !== settings.monitor) {
        settings.displayMode = kept.mode;
        settings.monitor = kept.monitor;
        saveSettings();
      }
    });
  };
  platform.window.onModeChange((mode) => {
    if (guard.pending || mode === applied.mode) return;
    applied = { mode, monitor: settings.monitor };
    settings.displayMode = mode;
    saveSettings();
  });
  onSettingChange('displayMode', onDisplay);
  onSettingChange('monitor', onDisplay);
  // Restart-only switches (PLT-0111): stored for the next launch; the player is told.
  onSettingChange('vsync', () => {
    platform.setLaunchSwitches({ vsync: settings.vsync, glBackend: platform.args.glBackend });
    if (platform.kind === 'desktop') notify('V-sync takes effect the next time Suture & Steel starts.');
  });
  // Desktop: bring the window to the stored mode at boot (the shell starts windowed/fullscreen already;
  // this covers borderless and monitor choice).
  if (platform.kind === 'desktop') {
    const st = platform.window.state();
    if (st && (st.mode !== settings.displayMode || (settings.monitor >= 0 && st.displayId !== settings.monitor))) void platform.window.setMode(settings.displayMode, settings.monitor < 0 ? null : settings.monitor);
  }
}

function installFocus(): void {
  platform.window.onFocus((f) => {
    focused = f;
    if (!f) {
      if (settings.pauseOnFocusLoss) pauseOperation();
      // Release held buttons so no lancet drag is stuck after Alt+Tab (PLT-0113).
      if (game) {
        game.input.down = false;
        game.input.rightDown = false;
      }
    }
    applyAudio();
  });
  platform.window.onSuspend((s) => {
    if (s) pauseOperation();
    log.info('platform', s ? 'suspended' : 'resumed');
  });
  // Steam overlay (PLT-0042): pause and silence input while it is up, whatever the display mode.
  platform.window.onOverlay((active) => {
    overlay?.set(active);
    log.info('platform', active ? 'steam overlay opened' : 'steam overlay closed');
  });
}

/** Steam Timeline markers (PLT-0050): operation start/end, the Malison's appearance, a lost patient, an XS rank. */
function timelineOperationEnd(e: Extract<GameEvent, { type: 'operation-end' }>): void {
  const op = timelineOp?.op;
  if (!op || op.def.id !== e.opId) return;
  const patient = op.def.patient;
  if (!e.won) platform.steam.timeline({ kind: 'patient-lost', title: t('steam.timeline.patient_lost'), description: patient, icon: 'steam_death', priority: 800 });
  else if (e.rank === 'XS') platform.steam.timeline({ kind: 'rank-xs', title: t('steam.timeline.rank_xs'), description: patient, icon: 'steam_star', priority: 900 });
  platform.steam.timeline({ kind: 'op-end', title: t(e.won ? 'steam.timeline.op_won' : 'steam.timeline.op_lost', { title: op.def.title }), description: patient, icon: e.won ? 'steam_checkmark' : 'steam_x', priority: 600, state: t('steam.timeline.state_menu') });
  timelineOp = null;
}

function timelineFrame(): void {
  if (!(scene instanceof OperationScene)) return;
  if (scene !== timelineOp) {
    timelineOp = scene;
    timelineBoss = false;
    platform.steam.timeline({ kind: 'op-start', title: scene.op.def.title, description: scene.op.def.patient, icon: 'steam_marker', priority: 500, state: t('steam.timeline.state_operating', { patient: scene.op.def.patient }) });
  }
  if (!timelineBoss && scene.op.bossOp) {
    timelineBoss = true;
    platform.steam.timeline({ kind: 'malison', title: t('steam.timeline.malison'), description: scene.op.def.title, icon: 'steam_bolt', priority: 700 });
  }
}

async function firstRunPrompts(): Promise<void> {
  // Only ask when this build can actually upload (DSN configured at build time; the desktop build uses the same project for minidumps).
  if (settings.crashReports === 'ask' && parseDsn(import.meta.env?.VITE_SENTRY_DSN)) {
    const i = await prompt({
      title: 'Help mend the game?',
      message: 'Suture & Steel can send anonymous crash reports — the error, your build and hardware tier, never your name or files. You can change this any time in Options → Privacy.',
      buttons: ['Send crash reports', 'No thanks'],
    });
    settings.crashReports = i === 0 ? 'on' : 'off';
    saveSettings();
  }
}

/** Full edition, first launch: offer to import the demo's progress (PLT-0066). */
async function offerDemoImport(): Promise<void> {
  if (EDITION !== 'full') return;
  const current = activeSave();
  if (!current || current.importedFrom || current.progress.chapter > 0 || current.progress.step > 0 || Object.keys(current.best).length) return;
  const demo = readDemoProfile(platform.demoFiles, BUILD.id);
  if (!demo) return;
  if (!(await platform.confirm(IMPORT_DIALOG))) return;
  const index = indexCampaign(CAMPAIGN.map((c) => c.steps.map((s) => (s.kind === 'op' ? s.op.id : s.story.id))));
  const { profile, report } = importDemoProfile(demo, index, BUILD.id);
  Object.assign(save, profile);
  store(save);
  log.info('carryover', `imported demo profile: ${report.imported.length} results, position ${report.position.chapter}:${report.position.step}`);
  notify('Your demo journal has been carried over.');
}

function onFirstScene(): void {
  if (!game) return;
  if (platform.recovered) {
    notify('Suture & Steel recovered from a problem and resumed at your last autosave.', 'warning');
    const p = save.progress;
    if (p.chapter < CAMPAIGN.length) playStep(game, p.chapter, p.step);
  }
  void firstRunPrompts().then(offerDemoImport);
}

export function installPlatform(g: Game): void {
  game = g;
  addScrubSecret(platform.steam.personaName);
  log.addSink((line, e) => {
    if (e.level === 'error' || e.level === 'warn' || import.meta.env?.DEV) (e.level === 'error' ? console.error : console.log)(line);
  });
  if (platform.kind === 'desktop') {
    // Batch log lines to the main process (file log with rotation, PLT-0121).
    let buf: string[] = [];
    log.addSink((line) => {
      buf.push(line);
      if (buf.length === 1)
        setTimeout(() => {
          platform.writeLog(buf);
          buf = [];
        }, 250);
    });
  }
  log.info('boot', `Suture & Steel ${BUILD.id} (${EDITION}) on ${platform.kind}/${platform.os}, storage ${platform.storage.backend}, steam ${platform.steam.available ? 'on' : 'off'}`);

  installErrorCapture({
    os: platform.os,
    consent: () => settings.crashReports === 'on',
    dsn: parseDsn(import.meta.env?.VITE_SENTRY_DSN),
    openLogs: platform.kind === 'desktop' ? () => platform.open('logs') : null,
    restart: () => platform.relaunch([]),
  });

  attachPresenter((m, k) => showNotice(m, k));
  const quill = new SaveIndicator();
  const AUTOSAVE_TIP_KEY = 'suture-and-steel.tip.autosave';
  // The first save ever written also explains the quill, once (UIX-0093).
  let tipShown = false;
  setBusyHandler((b) => {
    quill.set(b);
    if (!b || tipShown) return;
    tipShown = true;
    try {
      if (localStorage.getItem(AUTOSAVE_TIP_KEY)) return;
      localStorage.setItem(AUTOSAVE_TIP_KEY, '1');
      notify('The quill in the corner writes while your journal is saved. Do not quit while it writes.', 'info');
    } catch {
      // storage unavailable: skip the tip
    }
  });
  if (flag('watermark')) showWatermark(`${buildLabel()} · ${BUILD.date} · not for distribution`);

  setSlotDescriber((pos) => {
    const ch = CAMPAIGN[pos.chapter];
    const step = ch?.steps[pos.step];
    return { chapterTitle: ch ? `${ch.numeral}. ${ch.title}` : 'The End of the Demo', patient: step ? (step.kind === 'op' ? step.op.patient : step.story.place) : '' };
  });

  setThumbnailSource(() => thumb);

  const current = activeSave();
  if (current) {
    achievements = new Achievements(EDITION, platform.steam, current as AchievementState, () => store(current));
    onGameEvent((e) => achievements?.handle(e));
    void achievements.flush();
  }
  onGameEvent((e) => {
    if (e.type === 'operation-end') timelineOperationEnd(e);
  });
  overlay = new OverlayGate(g.input, pauseOperation);
  if (platform.args.kiosk) {
    // Show-floor build: every demo operation selectable, nothing persisted.
    save.progress = { chapter: CAMPAIGN.length - 1, step: CAMPAIGN[CAMPAIGN.length - 1].steps.length - 1 };
  }

  applyAudio();
  installSettings();
  installFocus();
  gamepad = new GamepadController(VIEW_W, VIEW_H, () => {
    pauseOperation();
    showNotice('Controller disconnected — reconnect it, or carry on with the mouse.', 'warning', 8000);
  });
  const resetIdle = () => (idle = 0);
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, resetIdle, { passive: true });

  platform.onQuitRequest(() => flushSaves());
  if (flag('qaTools')) installQaTools();
  (globalThis as { __platform?: unknown }).__platform = { platform, achievements, settings, build: BUILD };
}

export function sceneChanged(s: Scene): void {
  scene = s;
  updateActivity();
  if (!started) {
    started = true;
    queueMicrotask(onFirstScene);
  }
}

export function platformFrame(dt: number): void {
  if (!game) return;
  markFrame();
  log.frame++;
  maybeCaptureThumbnail(dt);
  timelineFrame();
  gamepad?.poll(game.input, dt, settings.gamepadCursorSpeed, settings.gamepadCursorAccel);
  if (gamepad?.lastDevice === 'gamepad' && (game.input.down || game.input.pressed || game.input.wheel)) idle = 0;
  idle += dt;
  const paused = !!(scene as Pausable | null)?.paused;
  if (focused && !paused && idle < IDLE_LIMIT_S) addPlaytime(dt);
  if (platform.args.kiosk && idle > KIOSK_IDLE_S && !(scene instanceof TitleScene)) {
    idle = 0;
    game.go(new TitleScene());
  }
  updateActivity();
  heartbeatT += dt;
  if (heartbeatT > 1) {
    heartbeatT = 0;
    platform.heartbeat();
  }
  if (firstLaunch && refreshSamples.length < 90) {
    refreshSamples.push(dt);
    if (refreshSamples.length === 90) runFirstLaunchDetection();
  }
}

function runFirstLaunchDetection(): void {
  if (!game) return;
  const sorted = refreshSamples.slice(30).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1 / 60;
  let renderer: string | null = null;
  try {
    const gl = game.gfx.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    // unavailable
  }
  autoDetect(settings, { gpuRenderer: renderer, refreshHz: 1 / median, steamLanguage: platform.steam.language, osLocale: platform.locale, isDeck: platform.steam.isDeck });
  saveSettings();
  log.info('settings', `first launch: gpu "${renderer}" → ${settings.preset}, ~${Math.round(1 / median)} Hz → cap ${settings.frameCap}, deck ${platform.steam.isDeck}`);
}

/** QA builds: F8 bug report (PLT-0131), Ctrl+Shift+F9 reset achievements (PLT-0049). */
function installQaTools(): void {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F8') {
      e.preventDefault();
      void (async () => {
        const extra: Record<string, string> = {
          'log.txt': log.lines().join('\n'),
          'settings.json': JSON.stringify(settings, null, 2),
          'profile.json': JSON.stringify(activeSave(), null, 2),
          'build.txt': `${BUILD.id}\n${platform.kind}/${platform.os}\n${navigator.userAgent}`,
        };
        const where = await platform.exportSupport(extra);
        showNotice(where ? `Bug report saved: ${where}` : 'Bug reports need the desktop build.', where ? 'info' : 'warning');
      })();
    }
    if (e.code === 'F9' && e.ctrlKey && e.shiftKey) void achievements?.resetAll().then(() => showNotice('Achievements reset (QA).'));
  });
}
