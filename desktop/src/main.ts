/**
 * Electron main process for Suture & Steel (PLT-0012 onwards). Responsibilities:
 * secure window + app:// protocol + CSP, hardening, single instance, quit flow with save flush,
 * menus, command-line flags, safe mode and launch health, display modes and window persistence,
 * display-sleep blocking, focus/suspend events, Steamworks, save files (atomic), log files, crash
 * reporting, renderer-crash recovery, hang watchdog, screenshots, support bundles.
 */
import { app, BrowserWindow, crashReporter, dialog, ipcMain, Menu, powerMonitor, powerSaveBlocker, protocol, screen, session, shell, type Display, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, release as osRelease, type as osType } from 'node:os';
import { join } from 'node:path';
import type { BootInfo, ConfirmOptions, DisplayInfo, DisplayMode, InvokeContract, OsKind, SendContract, WindowState } from '../../src/platform/bridge';
import { EDITIONS, type Edition } from '../../src/platform/editions';
import { ACHIEVEMENTS, achievementsFor } from '../../src/platform/achievements';
import { scrub, addScrubSecret } from '../../src/platform/log';
import { decode } from '../../src/core/save/codec';
import { angleSwitch, parseArgs } from './args';
import { buildCsp, dsnOrigin, mimeFor, resolveAppFile } from './csp';
import { atomicWrite, readAll, removeFile } from './fsstore';
import { HEALTHY_AFTER_MS, onCleanQuit, onCrash, onHealthy, onLaunch, parseHealth, type HealthState } from './health';
import { RotatingLog } from './logfile';
import { isSafeName, resolvePaths, userNamespace, type AppPaths } from './paths';
import { loadSteamworks, SteamService } from './steam';
import { parseState, restoreState, type Screen } from './windowstate';
import { zip } from './zip';

/* ───────────── build constants (scripts/build-desktop.mjs) ───────────── */
declare const __EDITION__: Edition;
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;
declare const __RELEASE__: boolean;
declare const __STEAM_ENABLED__: boolean;
declare const __SENTRY_DSN__: string;
declare const __CRASH_SUBMIT_URL__: string;

const EDITION = EDITIONS[__EDITION__];
const OS: OsKind = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
const args = parseArgs(process.argv.slice(1));
/** Dev tools, reload and navigation are only available with --dev or from an unpackaged checkout (PLT-0015). */
const DEV = args.dev || !app.isPackaged;
const SMOKE_OUT = process.env.SS_SMOKE_OUT ?? null;

/* ───────────── early log buffer (the file log needs paths + GPU info) ───────────── */
const early: string[] = [];
let fileLog: RotatingLog | null = null;
function mlog(level: 'INFO' | 'WARN' | 'ERROR', msg: string): void {
  const line = scrub(`${new Date().toISOString()} [${level.padEnd(5)}] main: ${msg}`);
  if (fileLog) fileLog.write([line]);
  else early.push(line);
  if (DEV || level !== 'INFO') console.log(line);
}
addScrubSecret(process.env.USERNAME ?? process.env.USER ?? null);
addScrubSecret(process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? null);

/* ───────────── Steam (before ready: overlay switches) ───────────── */
const steam = new SteamService(__STEAM_ENABLED__ ? loadSteamworks((m) => mlog('WARN', m)) : null, EDITION.steamAppId, (m) => mlog('INFO', m));
/** Launched outside Steam in a release build: Steam relaunches us (PLT-0041). */
let mustExit = steam.restartIfNecessary(__RELEASE__ && !DEV);
if (mustExit) app.exit(0);
if (__STEAM_ENABLED__ && EDITION.steamAppId > 0) steam.enableOverlay();
steam.init();
const steamId = steam.steamId();
addScrubSecret(steamId);
const hashId = (s: string) => createHash('sha256').update(s).digest('hex');
const USER_NS = userNamespace(steamId, hashId);
const paths: AppPaths = resolvePaths(OS, process.env, homedir(), EDITION.saveDir, USER_NS);
for (const d of [paths.saves, paths.settings, paths.logs, paths.cache]) mkdirSync(d, { recursive: true });

app.setName(EDITION.productName);
app.setPath('userData', paths.chromium);
app.setPath('crashDumps', paths.crashDumps);
app.setAppLogsPath(paths.logs);
if (OS === 'windows') app.setAppUserModelId(EDITION.bundleId);

/* ───────────── single instance (PLT-0016) ───────────── */
if (!mustExit && !app.requestSingleInstanceLock()) {
  mustExit = true;
  app.exit(0);
}

/* ───────────── settings read by main (consent, restart-only switches) ───────────── */
function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
function storedSettings(): Record<string, unknown> {
  const env = readJson(join(paths.settings, 'settings.json')) as { data?: Record<string, unknown> } | null;
  return env?.data && typeof env.data === 'object' ? env.data : {};
}
const launchSwitchesFile = join(paths.cache, 'launch-switches.json');
const launchSwitches = (readJson(launchSwitchesFile) as { vsync?: boolean; glBackend?: string | null } | null) ?? {};

/* ───────────── launch health / safe mode (PLT-0021) ───────────── */
const healthFile = join(paths.cache, 'health.json');
let health: HealthState = parseHealth(existsSync(healthFile) ? readFileSync(healthFile, 'utf8') : null);
const launch = onLaunch(health);
health = launch.state;
const saveHealth = () => {
  try {
    writeFileSync(healthFile, JSON.stringify(health));
  } catch {
    // ignore
  }
};
saveHealth();
let safeMode = args.safeMode;

/* ───────────── Chromium switches ───────────── */
const gl = angleSwitch(args.glBackend ?? launchSwitches.glBackend ?? null);
if (gl) app.commandLine.appendSwitch('use-angle', gl);
if (launchSwitches.vsync === false) {
  // No runtime vsync toggle in Chromium: applied on the next launch (PLT-0111).
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
if (OS === 'linux') app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
if (safeMode || launch.offerSafeMode) app.commandLine.appendSwitch('force-color-profile', 'srgb');

/* ───────────── crash reporting (PLT-0123/0125) ───────────── */
const crashConsent = () => storedSettings().crashReports === 'on';
crashReporter.start({
  productName: EDITION.productName,
  submitURL: __CRASH_SUBMIT_URL__ || 'https://invalid.invalid/',
  uploadToServer: !!__CRASH_SUBMIT_URL__ && crashConsent(),
  compress: true,
  ignoreSystemCrashHandler: true,
  globalExtra: { build: __BUILD_ID__, edition: EDITION.id, os: OS },
});

/* ───────────── app:// protocol (PLT-0014) ───────────── */
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);
const GAME_ROOT = join(app.getAppPath(), 'dist');
const CSP = buildCsp([dsnOrigin(__SENTRY_DSN__)].filter((x): x is string => !!x));

let win: BrowserWindow | null = null;
let recovered = false;
let quitting = false;
let kioskForceQuit = false;
let activity = { preventSleep: false, guardQuit: false, kioskIdleReset: false };
let sleepBlocker: number | null = null;
let lastHeartbeat = Date.now();

/* ───────────── displays & window modes (PLT-0108/0109/0110) ───────────── */
const windowFile = join(paths.cache, 'window.json');
const toScreen = (d: Display): Screen => ({ id: d.id, bounds: d.bounds, workArea: d.workArea, primary: d.id === screen.getPrimaryDisplay().id });
function displayInfo(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({ id: d.id, label: d.label || `Display ${i + 1}`, width: d.size.width, height: d.size.height, scaleFactor: d.scaleFactor, refreshRate: d.displayFrequency, primary: d.id === primary }));
}
let windowed = { x: 0, y: 0, width: 1280, height: 720 };
let mode: DisplayMode = 'fullscreen';

function currentState(): WindowState {
  const b = win && !win.isFullScreen() && !win.isSimpleFullScreen() ? win.getNormalBounds() : windowed;
  const displayId = win ? screen.getDisplayMatching(win.getBounds()).id : screen.getPrimaryDisplay().id;
  return { mode, displayId, bounds: b, maximized: !!win?.isMaximized() };
}

function persistWindow(): void {
  try {
    writeFileSync(windowFile, JSON.stringify(currentState()));
  } catch {
    // ignore
  }
}

function applyMode(next: DisplayMode, displayId: number | null): WindowState {
  if (!win) return currentState();
  if (mode === 'windowed' && !win.isFullScreen() && !win.isSimpleFullScreen()) windowed = win.getNormalBounds();
  const target = displayId === null ? screen.getDisplayMatching(win.getBounds()) : (screen.getAllDisplays().find((d) => d.id === displayId) ?? screen.getPrimaryDisplay());
  mode = next;
  if (next === 'windowed') {
    if (OS === 'mac' && win.isSimpleFullScreen()) win.setSimpleFullScreen(false);
    if (win.isFullScreen()) win.setFullScreen(false);
    const r = restoreState({ mode: 'windowed', displayId: target.id, bounds: windowed }, screen.getAllDisplays().map(toScreen));
    win.setBounds(r.bounds);
  } else {
    // Move onto the chosen monitor first, then go full screen there.
    const wa = target.workArea;
    if (win.isFullScreen()) win.setFullScreen(false);
    win.setBounds({ x: wa.x + 40, y: wa.y + 40, width: Math.min(1280, wa.width - 80), height: Math.min(720, wa.height - 80) });
    // Electron/Chromium full screen is a borderless window on Windows and Linux (no exclusive mode);
    // on macOS "fullscreen" is a native Space and "borderless" the simple full screen (PLT-0117).
    if (OS === 'mac' && next === 'borderless') win.setSimpleFullScreen(true);
    else win.setFullScreen(true);
  }
  const st = currentState();
  win.webContents.send('ss:window-state', st);
  persistWindow();
  return st;
}

/* ───────────── bootstrap for the renderer ───────────── */
function snapshot(): Record<string, string> {
  const files = readAll(paths.saves);
  if (paths.settings !== paths.saves) Object.assign(files, Object.fromEntries(Object.entries(readAll(paths.settings)).filter(([n]) => n.startsWith('settings.json'))));
  return files;
}

function bootInfo(): BootInfo {
  return {
    os: OS,
    arch: process.arch,
    osRelease: osRelease(),
    locale: app.getLocale(),
    edition: EDITION.id,
    version: __APP_VERSION__,
    args: { ...args, safeMode },
    safeMode,
    recovered,
    steam: steam.boot(EDITIONS.full.steamAppId, achievementsFor(EDITION.id).map((a) => a.id)),
    userNamespace: USER_NS,
    files: snapshot(),
    demoFiles: EDITION.id === 'full' ? readAll(paths.demoSaves) : null,
    window: currentState(),
    displays: displayInfo(),
    folders: { saves: scrub(paths.saves), logs: scrub(paths.logs), screenshots: scrub(screenshotDir()) },
  };
}

const fileDir = (name: string) => (name.startsWith('settings.json') ? paths.settings : paths.saves);
const validEnvelope = (name: string, text: string) => decode(text, name.startsWith('slot') ? 'slot' : name.startsWith('settings') ? 'settings' : 'profile').ok;
const screenshotDir = () => join(app.getPath('pictures'), 'Suture & Steel');

/* ───────────── IPC ───────────── */
type Handler<C extends keyof InvokeContract> = (e: IpcMainInvokeEvent, ...a: InvokeContract[C][0]) => InvokeContract[C][1] | Promise<InvokeContract[C][1]>;
function handle<C extends keyof InvokeContract>(channel: C, fn: Handler<C>): void {
  ipcMain.handle(channel, (e, ...a) => {
    if (!win || e.sender !== win.webContents) throw new Error('unexpected sender');
    return fn(e, ...(a as InvokeContract[C][0]));
  });
}
function on<C extends keyof SendContract>(channel: C, fn: (e: IpcMainEvent, ...a: SendContract[C]) => void): void {
  ipcMain.on(channel, (e, ...a) => {
    if (!win || e.sender !== win.webContents) return;
    fn(e, ...(a as SendContract[C]));
  });
}

async function confirm(o: ConfirmOptions): Promise<boolean> {
  const ask = async (message: string) => (await dialog.showMessageBox(win!, { type: 'question', title: o.title, message, detail: o.detail, buttons: [o.cancel, o.confirm], defaultId: 0, cancelId: 0, noLink: true })).response === 1;
  if (!(await ask(o.message))) return false;
  return !o.twice || ask('Are you certain? This cannot be undone.');
}

function registerIpc(): void {
  handle('ss:boot', () => bootInfo());
  handle('ss:fs-write', (_e, name, data) => {
    if (typeof name !== 'string' || typeof data !== 'string' || !isSafeName(name) || data.length > 4_000_000) return { ok: false, error: 'invalid' };
    try {
      atomicWrite(fileDir(name), name, data, validEnvelope);
      return { ok: true };
    } catch (err) {
      mlog('WARN', `save write ${name} failed: ${(err as Error).message}`);
      return { ok: false, error: (err as NodeJS.ErrnoException).code ?? 'EIO' };
    }
  });
  handle('ss:fs-remove', (_e, name) => {
    if (typeof name !== 'string' || !isSafeName(name)) return { ok: false, error: 'invalid' };
    try {
      removeFile(fileDir(name), name);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as NodeJS.ErrnoException).code ?? 'EIO' };
    }
  });
  handle('ss:window-set', (_e, m, displayId) => applyMode(['windowed', 'borderless', 'fullscreen'].includes(m) ? m : 'windowed', typeof displayId === 'number' ? displayId : null));
  handle('ss:displays', () => displayInfo());
  handle('ss:steam-achievement', (_e, id, unlock) => (ACHIEVEMENTS.some((a) => a.id === id) ? steam.setAchievement(id, !!unlock) : false));
  handle('ss:steam-overlay', (_e, kind, target) => steam.overlay(kind === 'store' ? 'store' : 'web', String(target)));
  handle('ss:steam-keyboard', (_e, x, y, w, h) => steam.floatingKeyboard(x, y, w, h));
  handle('ss:screenshot', () => takeScreenshot());
  handle('ss:support-export', (_e, extra) => supportBundle(extra));
  handle('ss:delete-all-data', async () => {
    const ok = await confirm({ title: 'Delete all local data', message: 'Delete every journal, save slot and setting for this game on this computer?', detail: 'Steam Cloud copies are removed on the next sync.', confirm: 'Delete everything', cancel: 'Keep my data', twice: true });
    if (!ok) return false;
    for (const d of new Set([paths.saves, paths.settings])) rmSync(d, { recursive: true, force: true });
    mlog('INFO', 'all local data deleted by the player');
    setTimeout(() => {
      quitting = true;
      app.relaunch();
      app.exit(0);
    }, 100);
    return true;
  });
  handle('ss:confirm', (_e, o) => confirm(o));

  on('ss:log', (_e, lines) => {
    if (Array.isArray(lines)) fileLog?.write(lines.filter((l): l is string => typeof l === 'string').map((l) => scrub(l).slice(0, 20_000)));
  });
  on('ss:activity', (_e, a) => {
    activity = { preventSleep: !!a?.preventSleep, guardQuit: !!a?.guardQuit, kioskIdleReset: !!a?.kioskIdleReset };
    // Keep the display awake during operations and story auto-play (PLT-0022).
    if (activity.preventSleep && sleepBlocker === null) sleepBlocker = powerSaveBlocker.start('prevent-display-sleep');
    else if (!activity.preventSleep && sleepBlocker !== null) {
      powerSaveBlocker.stop(sleepBlocker);
      sleepBlocker = null;
    }
  });
  on('ss:rich-presence', (_e, v) => steam.setRichPresence(v ?? {}));
  on('ss:open', (_e, t) => {
    if (t === 'saves') void shell.openPath(paths.saves);
    else if (t === 'logs') void shell.openPath(paths.logs);
    else if (t === 'screenshots') {
      mkdirSync(screenshotDir(), { recursive: true });
      void shell.openPath(screenshotDir());
    } else if (t === 'notices') void shell.openPath(join(app.getAppPath(), 'THIRD_PARTY_NOTICES.txt'));
    else if (t && typeof t === 'object' && typeof t.url === 'string' && /^https:\/\//.test(t.url)) void shell.openExternal(t.url);
  });
  on('ss:relaunch', (_e, extra) => {
    quitting = true;
    const keep = process.argv.slice(1).filter((a) => !['--safe-mode', '--reset-settings'].includes(a));
    app.relaunch({ args: [...keep, ...(Array.isArray(extra) ? extra.filter((a) => typeof a === 'string' && a.startsWith('--')) : [])] });
    app.exit(0);
  });
  on('ss:quit', () => win?.close());
  on('ss:consent', (_e, onOff) => {
    if (__CRASH_SUBMIT_URL__) crashReporter.setUploadToServer(!!onOff);
  });
  on('ss:heartbeat', () => (lastHeartbeat = Date.now()));
  on('ss:settings-restart', (_e, s) => {
    try {
      writeFileSync(launchSwitchesFile, JSON.stringify({ vsync: s?.vsync !== false, glBackend: typeof s?.glBackend === 'string' ? s.glBackend : null }));
    } catch {
      // ignore
    }
  });
}

/* ───────────── screenshots & support bundles (PLT-0134, PLT-0093, PLT-0131) ───────────── */
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
async function takeScreenshot(): Promise<string | null> {
  if (!win) return null;
  try {
    const img = await win.webContents.capturePage();
    mkdirSync(screenshotDir(), { recursive: true });
    const name = `Suture-and-Steel-${stamp()}.png`;
    writeFileSync(join(screenshotDir(), name), img.toPNG());
    return `Pictures/Suture & Steel/${name}`;
  } catch (err) {
    mlog('WARN', `screenshot failed: ${(err as Error).message}`);
    return null;
  }
}

async function supportBundle(extra: Record<string, string>): Promise<string | null> {
  try {
    const files: Record<string, Uint8Array | string> = {};
    for (const [n, t] of Object.entries(snapshot())) files[`saves/${n}`] = t;
    for (const n of readdirSync(paths.logs)) if (/^game(\.\d)?\.log$/.test(n)) files[`logs/${n}`] = readFileSync(join(paths.logs, n));
    if (extra && typeof extra === 'object') for (const [n, t] of Object.entries(extra)) if (isSafeName(n) && typeof t === 'string') files[`report/${n}`] = scrub(t);
    if (win) files['report/screenshot.png'] = (await win.webContents.capturePage()).toPNG();
    mkdirSync(paths.support, { recursive: true });
    const name = `support-${stamp()}-${randomUUID().slice(0, 8)}.zip`;
    const out = join(paths.support, name);
    writeFileSync(out, zip(files));
    shell.showItemInFolder(out);
    return name;
  } catch (err) {
    mlog('WARN', `support bundle failed: ${(err as Error).message}`);
    return null;
  }
}

/* ───────────── quit flow (PLT-0017) ───────────── */
function flushRenderer(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (!win || win.webContents.isDestroyed()) return resolve();
    const t = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(t);
      ipcMain.removeListener('ss:quit-ready', done);
      resolve();
    }
    ipcMain.once('ss:quit-ready', done);
    win.webContents.send('ss:quit-request');
  });
}

async function requestClose(): Promise<void> {
  if (!win) return;
  if (args.kiosk && !kioskForceQuit) return; // booth builds cannot be quit by visitors (PLT-0074)
  if (activity.guardQuit) {
    const r = await dialog.showMessageBox(win, {
      type: 'question',
      title: EDITION.productName,
      message: 'Abandon the operation?',
      detail: 'The patient is still on the table. This operation will be lost; your journal is kept at the last autosave.',
      buttons: ['Keep operating', 'Abandon and quit'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (r.response !== 1) return;
  }
  await flushRenderer();
  persistWindow();
  health = onCleanQuit(health);
  saveHealth();
  quitting = true;
  app.quit();
}

/* ───────────── menus (PLT-0018) ───────────── */
function installMenu(): void {
  if (OS !== 'mac') return Menu.setApplicationMenu(null);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: EDITION.productName, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] },
      { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
    ]),
  );
}

/* ───────────── renderer health: crash recovery, hang watchdog (PLT-0126/0127/0128) ───────────── */
async function crashDialog(reason: string, offerSafe: boolean): Promise<void> {
  if (!win) return;
  const id = randomUUID().slice(0, 8);
  mlog('ERROR', `renderer gone (${reason}); report ${id}`);
  const buttons = offerSafe ? ['Restart in safe mode', 'Restart', 'Open log folder', 'Quit'] : ['Restart', 'Open log folder', 'Quit'];
  const r = await dialog.showMessageBox(win, {
    type: 'error',
    title: EDITION.productName,
    message: 'Suture & Steel has stopped',
    detail: `The game hit a problem (${reason}) and will resume at your last autosave.${offerSafe ? '\n\nIt has happened more than once in the last ten minutes — safe mode uses the lowest graphics settings.' : ''}\n\nReport id: ${id}`,
    buttons,
    defaultId: 0,
    noLink: true,
  });
  const choice = buttons[r.response];
  if (choice === 'Open log folder') {
    void shell.openPath(paths.logs);
    return crashDialog(reason, offerSafe);
  }
  if (choice === 'Quit') {
    quitting = true;
    return app.quit();
  }
  if (choice === 'Restart in safe mode') {
    quitting = true;
    app.relaunch({ args: [...process.argv.slice(1), '--safe-mode'] });
    return app.exit(0);
  }
  recovered = true;
  void win.loadURL('app://game/index.html');
}

function watchRenderer(w: BrowserWindow): void {
  w.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || quitting) return;
    const r = onCrash(health, Date.now());
    health = r.state;
    saveHealth();
    if (r.offerSafeMode) void crashDialog(details.reason, true);
    else {
      // First crash: reload straight back to the last autosave, no dialog.
      mlog('ERROR', `renderer gone (${details.reason}); reloading`);
      recovered = true;
      void w.loadURL('app://game/index.html');
    }
  });
  app.on('child-process-gone', (_e, d) => {
    if (d.type === 'GPU') mlog('ERROR', `GPU process gone (${d.reason}, exit ${d.exitCode})`);
  });
  let hangAsked = false;
  const checkHang = async () => {
    if (!win || quitting || hangAsked || !win.isVisible() || win.isMinimized()) return;
    if (Date.now() - lastHeartbeat < 10_000) return;
    hangAsked = true;
    mlog('ERROR', 'renderer unresponsive for >10 s');
    const r = await dialog.showMessageBox(win, { type: 'warning', title: EDITION.productName, message: 'Suture & Steel is not responding', detail: 'You can wait, or restart at your last autosave.', buttons: ['Wait', 'Restart'], defaultId: 0, noLink: true });
    if (r.response === 1) {
      // Crash the renderer deliberately so Crashpad captures its state, then recover.
      win.webContents.forcefullyCrashRenderer();
    }
    lastHeartbeat = Date.now();
    hangAsked = false;
  };
  setInterval(() => void checkHang(), 2000);
}

/* ───────────── window ───────────── */
function createWindow(): void {
  const screens = screen.getAllDisplays().map(toScreen);
  const st = restoreState(parseState(existsSync(windowFile) ? readFileSync(windowFile, 'utf8') : null), screens);
  windowed = st.bounds;
  const s = storedSettings();
  const wanted: DisplayMode = args.windowed || safeMode ? 'windowed' : args.fullscreen ? 'fullscreen' : ['windowed', 'borderless', 'fullscreen'].includes(s.displayMode as string) ? (s.displayMode as DisplayMode) : st.mode;
  win = new BrowserWindow({
    ...st.bounds,
    minWidth: 960,
    minHeight: 540,
    show: false,
    title: EDITION.productName,
    backgroundColor: '#070505',
    autoHideMenuBar: true,
    useContentSize: true,
    icon: OS === 'linux' ? join(app.getAppPath(), 'desktop', 'build', 'icons', '512x512.png') : undefined,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
      devTools: DEV,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  const w = win;
  w.setMenuBarVisibility(false);
  // Keep the per-edition window title ("Suture & Steel Demo", PLT-0060) instead of the page <title>.
  w.on('page-title-updated', (e) => e.preventDefault());
  mode = 'windowed';

  // Hardening (PLT-0015).
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e, url) => {
    if (!DEV || !url.startsWith('app://game/')) e.preventDefault();
  });
  w.webContents.on('will-redirect', (e) => e.preventDefault());
  w.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = input.key.toLowerCase();
    const mod = input.control || input.meta;
    if (args.kiosk && input.control && input.shift && input.alt && k === 'q') {
      kioskForceQuit = true;
      void requestClose();
      return e.preventDefault();
    }
    if (!DEV && ((mod && (k === 'r' || (input.shift && k === 'i'))) || k === 'f5' || (input.alt && input.meta && k === 'i'))) return e.preventDefault();
    if (k === 'f12' && !input.alt && !steam.available) {
      e.preventDefault();
      void takeScreenshot().then((p) => p && mlog('INFO', `screenshot ${p}`));
    }
  });
  w.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    void requestClose();
  });
  w.on('focus', () => w.webContents.send('ss:focus', true));
  w.on('blur', () => w.webContents.send('ss:focus', false));
  w.on('enter-full-screen', () => {
    if (mode === 'windowed') mode = 'fullscreen';
    w.webContents.send('ss:window-state', currentState());
  });
  w.on('leave-full-screen', () => {
    if (!w.isSimpleFullScreen()) mode = 'windowed';
    w.webContents.send('ss:window-state', currentState());
  });
  w.on('resized', () => mode === 'windowed' && (windowed = w.getNormalBounds()));
  w.on('moved', () => mode === 'windowed' && (windowed = w.getNormalBounds()));
  w.once('ready-to-show', () => {
    if (wanted !== 'windowed') applyMode(wanted, s.monitor !== undefined && typeof s.monitor === 'number' && s.monitor >= 0 ? s.monitor : st.displayId);
    else if (st.maximized) w.maximize();
    w.show();
    setTimeout(() => {
      health = onHealthy(health);
      saveHealth();
    }, HEALTHY_AFTER_MS);
  });
  watchRenderer(w);
  void w.loadURL('app://game/index.html');
  if (SMOKE_OUT) runSmoke(w);
}

/* ───────────── headless smoke (CI / scripts/desktop-smoke.mjs) ───────────── */
function runSmoke(w: BrowserWindow): void {
  w.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      let result: unknown;
      try {
        result = await w.webContents.executeJavaScript(`(async () => {
          const p = window.__platform?.platform;
          const w = p ? await p.storage.write('smoke.json', '{"ok":true}') : null;
          return {
            bridge: typeof window.ssBridge,
            nodeInPage: typeof window.require !== 'undefined' || typeof window.process !== 'undefined',
            kind: p?.kind, storage: p?.storage.backend, os: p?.os, edition: window.__platform?.build.edition,
            build: window.__platform?.build.id, write: w, title: document.title,
            canvas: !!document.querySelector('canvas#game'), fatal: document.getElementById('fatal')?.textContent ?? null,
            csp: await fetch(location.href).then(r => r.headers.get('content-security-policy')).catch(e => 'fetch failed: ' + e),
          };
        })()`);
      } catch (err) {
        result = { error: String(err) };
      }
      const onDisk = existsSync(join(paths.saves, 'smoke.json'));
      try {
        writeFileSync(SMOKE_OUT!.replace(/\.json$/, '.png'), (await w.webContents.capturePage()).toPNG());
      } catch {
        // screenshot is informational
      }
      writeFileSync(SMOKE_OUT!, JSON.stringify({ result, onDisk, savesDir: paths.saves, windowTitle: w.getTitle() }, null, 2));
      quitting = true;
      app.quit();
    }, 4000);
  });
}

/* ───────────── lifecycle ───────────── */
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});
app.on('before-quit', (e) => {
  if (quitting) return;
  // Cmd+Q / system shutdown path goes through the same confirmation + flush.
  e.preventDefault();
  void requestClose();
});
app.on('window-all-closed', () => app.quit());
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault());
});
powerMonitor.on('suspend', () => win?.webContents.send('ss:suspend', true));
powerMonitor.on('resume', () => win?.webContents.send('ss:suspend', false));

void app.whenReady().then(async () => {
  if (mustExit) return;
  let gpu = 'unknown';
  try {
    const info = (await app.getGPUInfo('basic')) as { gpuDevice?: { vendorId: number; deviceId: number; active?: boolean }[]; auxAttributes?: { glRenderer?: string } };
    gpu = info.auxAttributes?.glRenderer ?? JSON.stringify(info.gpuDevice?.find((d) => d.active) ?? info.gpuDevice?.[0] ?? {});
  } catch {
    // ignore
  }
  const settingsNow = storedSettings();
  fileLog = new RotatingLog(paths.logs, () =>
    [
      `# ${EDITION.productName} ${__BUILD_ID__}`,
      `# os=${osType()} ${osRelease()} ${process.arch} electron=${process.versions.electron} chrome=${process.versions.chrome}`,
      `# locale=${app.getLocale()} steam=${steam.available ? 'on' : 'off'} safeMode=${safeMode}`,
      `# gpu=${gpu} features=${JSON.stringify(app.getGPUFeatureStatus())}`,
      `# settings preset=${String(settingsNow.preset ?? 'default')} displayMode=${String(settingsNow.displayMode ?? 'default')} vsync=${launchSwitches.vsync !== false}`,
    ].join('\n'),
  );
  fileLog.write(early.splice(0));

  if (launch.offerSafeMode && !safeMode) {
    const r = await dialog.showMessageBox({ type: 'warning', title: EDITION.productName, message: 'Suture & Steel did not start properly last time.', detail: 'Start in safe mode? Safe mode uses the lowest graphics settings in a window. You can raise them again in Options.', buttons: ['Start in safe mode', 'Start normally'], defaultId: 0, noLink: true });
    safeMode = r.response === 0;
  }
  mlog('INFO', `launch: edition=${EDITION.id} safeMode=${safeMode} kiosk=${args.kiosk} dev=${DEV} user=${USER_NS}`);

  protocol.handle('app', async (req) => {
    const file = resolveAppFile(GAME_ROOT, req.url);
    if (!file) return new Response('Not found', { status: 404 });
    try {
      const body = readFileSync(file);
      return new Response(body, { headers: { 'content-type': mimeFor(file), 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  registerIpc();
  installMenu();
  createWindow();
});
