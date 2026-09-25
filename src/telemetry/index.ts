/**
 * Opt-in, local-only telemetry scaffolding. Installed by main.ts; records nothing until the player
 * (or a tester via the ` console: `telemetry on`) grants consent. Events are validated against
 * schema v1 in tests, batched by TelemetryQueue and delivered to a LocalTransport (localStorage) —
 * there is no network endpoint until the ingest backend (QAT-0096) exists.
 */
import { CAMPAIGN } from '../content/campaign';
import type { StoryDef } from '../content/story';
import type { Game, Scene } from '../core/scene';
import { settings } from '../core/settings';
import { save } from '../scenes/flow';
import { DemoEndScene } from '../scenes/demoend';
import { OperationScene } from '../scenes/operation';
import { StoryScene } from '../scenes/story';
import { TitleScene } from '../scenes/title';
import { allows, DEFAULT_CONFIG, loadPrefs, readConfig, savePrefs, storageConfigSource, type RemoteConfig, type TelemetryPrefs } from './config';
import { EventFactory, uuid, type Assists, type EventProps, type Flavour, type TelemetryEvent } from './events';
import { TelemetryObserver, type SceneInfo } from './observer';
import { LocalTransport, MemoryStore, TelemetryQueue, type KeyValue } from './queue';
import type { EventName } from './schema';

type TGame = Game & { scene: Scene | null };

export interface TelemetryHandle {
  enabled(): boolean;
  setEnabled(on: boolean): void;
  resetInstallId(): string;
  /** Queued plus locally delivered events (newest last). */
  dump(): TelemetryEvent[];
  flush(): Promise<boolean>;
}

function storage(): KeyValue {
  try {
    const ls = window.localStorage;
    const probe = '__telemetry_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) };
  } catch {
    return new MemoryStore();
  }
}

export function osFamily(ua: string, platform = ''): 'windows' | 'macos' | 'linux' | 'steamos' | 'other' {
  const s = `${platform} ${ua}`.toLowerCase();
  if (s.includes('steamos') || s.includes('steam deck')) return 'steamos';
  if (s.includes('win')) return 'windows';
  if (s.includes('mac')) return 'macos';
  if (s.includes('linux') || s.includes('x11')) return 'linux';
  return 'other';
}

export function gpuFamily(renderer: string): 'nvidia' | 'amd' | 'intel' | 'apple' | 'qualcomm' | 'software' | 'other' | 'unknown' {
  const r = renderer.toLowerCase();
  if (!r) return 'unknown';
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software')) return 'software';
  if (r.includes('nvidia') || r.includes('geforce') || r.includes('quadro')) return 'nvidia';
  if (r.includes('amd') || r.includes('radeon') || r.includes('ati ')) return 'amd';
  if (r.includes('intel')) return 'intel';
  if (r.includes('apple')) return 'apple';
  if (r.includes('adreno') || r.includes('qualcomm')) return 'qualcomm';
  return 'other';
}

function renderer(gl: WebGL2RenderingContext): string {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch {
    return '';
  }
}

const flavour = (): Flavour => {
  const f = import.meta.env.VITE_FLAVOUR as string | undefined;
  if (f === 'playtest' || f === 'qa' || f === 'dev' || f === 'release') return f;
  if (import.meta.env.DEV) return 'dev';
  return import.meta.env.MODE === 'qa' ? 'qa' : 'release';
};

const assists = (): Assists => ({ timer: settings.timerAssist, litanyKey: settings.litanyKey });

function chapterOpening(story: StoryDef): number | undefined {
  const i = CAMPAIGN.findIndex((ch) => ch.steps[0]?.kind === 'story' && ch.steps[0].story.id === story.id);
  return i >= 0 ? i + 1 : undefined;
}

function sceneInfo(s: Scene): SceneInfo {
  if (s instanceof OperationScene) return { name: 'operation', op: s.op };
  if (s instanceof StoryScene) {
    const st = s as unknown as { story: StoryDef; i: number };
    return {
      name: 'story',
      story: {
        id: st.story.id,
        line: st.i,
        lines: st.story.lines.length,
        chapter: chapterOpening(st.story),
        prologue: CAMPAIGN[0]?.steps[0]?.kind === 'story' && CAMPAIGN[0].steps[0].story.id === st.story.id,
      },
    };
  }
  if (s instanceof TitleScene) return { name: 'title' };
  if (s instanceof DemoEndScene) return { name: 'demoend' };
  return { name: 'other' };
}

export function installTelemetry(game: TGame): TelemetryHandle {
  const store = storage();
  let prefs: TelemetryPrefs = loadPrefs(store);
  let config: RemoteConfig = { ...DEFAULT_CONFIG };
  const session = uuid();
  const t0 = performance.now();
  const factory = new EventFactory({
    session,
    install: prefs.install,
    build: (import.meta.env.VITE_BUILD_ID as string | undefined) ?? 'dev',
    flavour: flavour(),
  });
  const local = new LocalTransport(store);
  const queue = new TelemetryQueue(local, { storage: store });
  const on = () => prefs.consent === 'granted';

  const emit = <E extends EventName>(event: E, props: EventProps[E]) => {
    if (!on() || !allows(config, event)) return;
    queue.push(factory.make(event, props));
  };
  const observer = new TelemetryObserver(emit, assists);

  const sessionStart = () =>
    emit('session_start', {
      os: osFamily(navigator.userAgent, (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ''),
      gpuFamily: gpuFamily(renderer(game.gfx.gl)),
      locale: /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(navigator.language) ? navigator.language : 'und',
      edition: 'demo',
      viewport: { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight), dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100 },
    });

  // Session start: re-read the kill-switch config, then record the launch.
  const configUrl = import.meta.env.VITE_TELEMETRY_CONFIG_URL as string | undefined;
  const source = configUrl ? async () => (await fetch(configUrl, { cache: 'no-store' })).json() : storageConfigSource(store);
  void readConfig(source).then((c) => {
    config = c;
    sessionStart();
  });

  // Observe scene changes and per-frame operation state.
  let lastSettings = JSON.stringify(settings);
  const watchScene = (s: Scene) => {
    const w = s as Scene & { __telemetry?: boolean };
    if (w.__telemetry) return;
    w.__telemetry = true;
    const update = s.update.bind(s);
    s.update = (dt, g) => {
      update(dt, g);
      if (!on()) return;
      if (s instanceof StoryScene) observer.storyLine((s as unknown as { i: number }).i);
      observer.tick();
      queue.tick();
      const now = JSON.stringify(settings);
      if (now !== lastSettings) {
        const before = JSON.parse(lastSettings) as Record<string, number | boolean>;
        const after = JSON.parse(now) as Record<string, number | boolean>;
        const changes: Record<string, number | boolean> = {};
        for (const k of Object.keys(after)) if (after[k] !== before[k]) changes[k] = after[k];
        lastSettings = now;
        emit('settings_changed', { changes });
      }
    };
  };
  const go = game.go.bind(game);
  game.go = (scene: Scene) => {
    const hadSave = save.progress.chapter > 0 || save.progress.step > 0;
    watchScene(scene);
    go(scene);
    if (on()) observer.onScene(sceneInfo(scene), hadSave);
  };
  if (game.scene) {
    watchScene(game.scene);
    if (on()) observer.onScene(sceneInfo(game.scene));
  }

  // The wishlist button opens the store page.
  const open = window.open.bind(window);
  window.open = (url?: string | URL, ...rest) => {
    if (on() && String(url ?? '').includes('store.steampowered.com'))
      emit('wishlist_click', { source: game.scene instanceof DemoEndScene ? 'demo_end' : 'other' });
    return open(url, ...rest);
  };

  window.addEventListener('pagehide', () => {
    if (!on()) return;
    observer.onQuit();
    emit('quit', { scene: game.scene ? sceneInfo(game.scene).name : 'none', sessionSeconds: Math.round((performance.now() - t0) / 100) / 10 });
    void queue.flushOnQuit();
  });

  return {
    enabled: on,
    setEnabled(v: boolean) {
      const was = on();
      prefs = { ...prefs, consent: v ? 'granted' : 'denied' };
      savePrefs(store, prefs);
      if (v !== was) {
        emit('consent_answered', { granted: v });
        if (v) sessionStart();
        else {
          queue.clear();
          local.clear();
        }
      }
    },
    resetInstallId() {
      prefs = { ...prefs, install: uuid() };
      savePrefs(store, prefs);
      factory.setInstall(prefs.install);
      queue.clear();
      local.clear();
      return prefs.install;
    },
    dump: () => [...local.read(), ...queue.snapshot()],
    flush: () => queue.flush(),
  };
}
