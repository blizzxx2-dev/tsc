import { describe, expect, it } from 'vitest';
import { addScrubSecret, formatEntry, Logger, RING_SIZE, scrub } from '../src/platform/log';
import { FLAG_DEFAULTS, parseFlagOverrides } from '../src/platform/flags';
import { Achievements, type AchievementState } from '../src/platform/achievements';
import { NoSteam } from '../src/platform/web';
import { presenceFor, tokensVdf, PRESENCE_TOKENS } from '../src/platform/richpresence';
import { makeReport, parseDsn, sentryEnvelope } from '../src/platform/crash';
import { DisplayChangeGuard, DISPLAY_CONFIRM_MS, type DisplayConfig } from '../src/platform/display';
import { BTN, PadMapper, stickToVelocity, type PadState } from '../src/platform/gamepad';
import { BUILD, buildLabel, makeBuildInfo } from '../src/platform/build';
import { storeUrl } from '../src/platform/editions';
import { platform } from '../src/platform';
import { OverlayGate } from '../src/platform/overlay';
import { EVENT_CHANNELS, INVOKE_CHANNELS, SEND_CHANNELS } from '../src/platform/bridge';
import type { FrameSource } from '../src/core/input';
import type { SteamPlatform } from '../src/platform/types';

describe('PII scrubbing', () => {
  it('removes user names from Windows, macOS and Linux paths', () => {
    expect(scrub('C:\\Users\\Jürgen Ünïcødé\\AppData\\Roaming\\suture-and-steel\\x')).toBe('C:\\Users\\<user>\\AppData\\Roaming\\suture-and-steel\\x');
    expect(scrub('at file:///C:/Users/bob/app.asar/main.js')).toBe('at file:///C:/Users/<user>/app.asar/main.js');
    expect(scrub('{"p":"C:\\\\Users\\\\alice\\\\x"}')).toBe('{"p":"C:\\\\Users\\\\<user>\\\\x"}');
    expect(scrub('/Users/claire/Library/Logs/suture-and-steel')).toBe('/Users/<user>/Library/Logs/suture-and-steel');
    expect(scrub('/home/dave/.local/share/suture-and-steel')).toBe('/home/<user>/.local/share/suture-and-steel');
  });

  it('removes SteamIDs and registered secrets (persona, machine name)', () => {
    expect(scrub('player 76561198012345678 joined')).toBe('player <steamid> joined');
    addScrubSecret('DESKTOP-K1LL3R');
    addScrubSecret('xX_Surgeon_Xx');
    expect(scrub('host desktop-k1ll3r, persona xX_Surgeon_Xx')).toBe('host <redacted>, persona <redacted>');
  });
});

describe('logger', () => {
  it('records level, category, timestamp and frame; keeps the last 2,000 lines', () => {
    const l = new Logger(() => new Date('2026-09-25T10:00:00Z'));
    l.frame = 42;
    const sunk: string[] = [];
    l.addSink((line) => sunk.push(line));
    l.info('save', 'wrote /home/eve/x');
    expect(sunk[0]).toBe('2026-09-25T10:00:00.000Z [INFO ] #42 save: wrote /home/<user>/x');
    for (let i = 0; i < RING_SIZE + 10; i++) l.debug('x', `n${i}`);
    l.minLevel = 'debug';
    for (let i = 0; i < RING_SIZE + 10; i++) l.debug('x', `n${i}`);
    const lines = l.lines();
    expect(lines).toHaveLength(RING_SIZE);
    expect(lines.at(-1)).toContain(`n${RING_SIZE + 9}`);
    expect(lines[0]).toContain('n10');
    expect(formatEntry({ t: 't', frame: 0, level: 'error', cat: 'c', msg: 'm', data: new Error('boom') })).toContain('Error: boom');
  });
});

describe('build info and flags', () => {
  it('formats the build id as version+sha.date', () => {
    const b = makeBuildInfo('demo', '1.0.2', 'abcdef12', '20261101');
    expect(b.id).toBe('1.0.2+abcdef12.20261101');
    expect(buildLabel(b)).toBe('Demo 1.0.2 · abcdef12');
    expect(BUILD.edition).toBe('demo');
  });

  it('parses flag overrides, ignoring unknown flags', () => {
    expect(
      parseFlagOverrides([
        ['watermark', '1'],
        ['qaTools', 'false'],
        ['nope', '1'],
      ]),
    ).toEqual({ watermark: true, qaTools: false });
    expect(FLAG_DEFAULTS.challengeMode).toBe(false);
  });

  it('store links fall back to a search when the app id is unassigned', () => {
    expect(storeUrl(0)).toMatch(/search/);
    expect(storeUrl(123)).toBe('https://store.steampowered.com/app/123/');
  });

  it('the web/no-op platform runs headless', async () => {
    expect(platform.kind).toBe('web');
    expect(platform.steam.available).toBe(false);
    expect(await platform.steam.setAchievement('X', true)).toBe(false);
    expect(platform.window.state()).toBeNull();
    const w = await platform.storage.write('t.json', '1');
    expect(w.ok).toBe(true);
    expect(platform.storage.read('t.json')).toBe('1');
  });
});

class FakeSteam implements SteamPlatform {
  available = false;
  readonly appId = 1;
  readonly steamId = null;
  readonly personaName = null;
  readonly language = null;
  readonly isDeck = false;
  readonly ownsFullGame = false;
  unlocked = new Set<string>();
  private cb: ((c: boolean) => void) | null = null;
  private base = new NoSteam(() => undefined);
  achievementState = (id: string) => (this.unlocked.has(id) ? true : undefined);
  setRichPresence = () => undefined;
  openStore = (id: number) => this.base.openStore(id);
  openWebPage = (u: string) => this.base.openWebPage(u);
  showKeyboard = () => Promise.resolve(false);
  timeline = () => undefined;
  setAchievement(id: string, on: boolean): Promise<boolean> {
    if (!this.available) return Promise.resolve(false);
    if (on) this.unlocked.add(id);
    else this.unlocked.delete(id);
    return Promise.resolve(true);
  }
  onConnected(cb: (c: boolean) => void): void {
    this.cb = cb;
  }
  connect(): void {
    this.available = true;
    this.cb?.(true);
  }
}

describe('achievements', () => {
  const win = (opId: string, rank: 'S' | 'XS' = 'S', litanyUsed = true) => ({
    type: 'operation-end' as const,
    opId,
    won: true,
    rank,
    score: 1,
    assisted: false,
    litanyUsed,
  });

  it('unlocks from game events, queues offline, flushes when Steam connects', async () => {
    const steam = new FakeSteam();
    const state: AchievementState = {};
    let persisted = 0;
    const a = new Achievements('demo', steam, state, () => persisted++);
    expect(a.handle(win('op1-1'))).toEqual(['FIRST_PATIENT']);
    expect(a.handle(win('op1-1'))).toEqual([]);
    expect(a.handle(win('op1-5', 'XS', false)).sort()).toEqual(['HOUR_OF_MATINS', 'NO_STILLNESS', 'RANK_XS']);
    expect(a.handle({ type: 'operation-end', opId: 'op2-5', won: false, rank: null, score: 0, assisted: false, litanyUsed: false })).toEqual([]);
    expect(a.queue).toHaveLength(4);
    expect(persisted).toBeGreaterThan(0);
    steam.connect();
    await new Promise((r) => setTimeout(r, 0));
    expect(a.queue).toEqual([]);
    expect([...steam.unlocked].sort()).toEqual(['FIRST_PATIENT', 'HOUR_OF_MATINS', 'NO_STILLNESS', 'RANK_XS']);
    await a.resetAll();
    expect(steam.unlocked.size).toBe(0);
    expect(a.unlocked).toEqual([]);
  });

  it('assisted runs do not earn the purist achievement', () => {
    const a = new Achievements('demo', new FakeSteam(), {}, () => undefined);
    expect(a.handle({ ...win('op2-5', 'S', false), assisted: true })).not.toContain('NO_STILLNESS');
    expect(a.handle({ type: 'chapter-complete', chapter: 1 })).toEqual(['CHAPTER_TWO']);
  });
});

describe('rich presence', () => {
  it('maps activities to tokens with substitutions', () => {
    expect(presenceFor({ kind: 'menu' })).toEqual({ steam_display: '#Status_Menu', chapter: null, patient: null });
    expect(presenceFor({ kind: 'operating', chapter: 'II', patient: 'Gravehound' })).toEqual({
      steam_display: '#Status_Operating',
      chapter: 'II',
      patient: 'Gravehound',
    });
    expect(presenceFor({ kind: 'story', chapter: 'I' }).steam_display).toBe('#Status_Story');
  });

  it('generates Steam token files where every token used in game is defined', () => {
    for (const set of ['demo', 'full'] as const) {
      const vdf = tokensVdf(set);
      for (const t of ['#Status_Menu', '#Status_Story', '#Status_Operating']) expect(vdf).toContain(`"${t}"`);
      expect(PRESENCE_TOKENS[set]['#Status_Operating']).toContain('%patient%');
    }
  });
});

describe('crash reports', () => {
  it('parses DSNs and builds a scrubbed Sentry envelope', () => {
    expect(parseDsn('nope')).toBeNull();
    const dsn = parseDsn('https://abc123@o42.ingest.sentry.io/777')!;
    expect(dsn).toEqual({ protocol: 'https', publicKey: 'abc123', host: 'o42.ingest.sentry.io', projectId: '777' });
    const err = new Error('failed at C:\\Users\\mallory\\save.json');
    const r = makeReport(err, 'fatal', 'windows');
    expect(r.message).toBe('Error: failed at C:\\Users\\<user>\\save.json');
    const { url, body } = sentryEnvelope(r, dsn);
    expect(url).toBe('https://o42.ingest.sentry.io/api/777/envelope/?sentry_key=abc123&sentry_version=7');
    const [header, item, event] = body.split('\n').map((l) => JSON.parse(l));
    expect(header.event_id).toBe(r.eventId);
    expect(item.type).toBe('event');
    expect(event.release).toBe(`suture-and-steel-demo@${BUILD.id}`);
    expect(body).not.toContain('mallory');
  });
});

describe('display-change confirmation', () => {
  const W: DisplayConfig = { mode: 'windowed', monitor: -1 };
  const F: DisplayConfig = { mode: 'fullscreen', monitor: 2 };

  it('reverts unless confirmed within 15 s', async () => {
    const applied: DisplayConfig[] = [];
    let asked = 0;
    const g = new DisplayChangeGuard(
      async (c) => void applied.push(c),
      async (ms) => {
        asked = ms;
        return false;
      },
    );
    expect(await g.change(W, F)).toEqual(W);
    expect(applied).toEqual([F, W]);
    expect(asked).toBe(DISPLAY_CONFIRM_MS);
  });

  it('keeps a confirmed change and ignores no-op changes', async () => {
    const applied: DisplayConfig[] = [];
    const g = new DisplayChangeGuard(
      async (c) => void applied.push(c),
      async () => true,
    );
    expect(await g.change(W, F)).toEqual(F);
    expect(await g.change(F, F)).toEqual(F);
    expect(applied).toEqual([F]);
  });
});

describe('gamepad backend', () => {
  const pad = (axes: number[], pressed: number[] = []): PadState => ({
    index: 0,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    connected: true,
    mapping: 'standard',
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  });

  it('applies a radial deadzone and response curve', () => {
    expect(stickToVelocity(0.1, 0.1, 1000, 1)).toEqual({ vx: 0, vy: 0 });
    const full = stickToVelocity(1, 0, 1000, 1.5);
    expect(full.vx).toBeCloseTo(1000);
    expect(stickToVelocity(0.6, 0, 1000, 1.5).vx).toBeLessThan(stickToVelocity(0.6, 0, 1000, 0).vx);
  });

  it('turns buttons into press/hold, tool cycling and pause edges', () => {
    const m = new PadMapper();
    let f = m.frame([pad([1, 0], [BTN.A, BTN.RB, BTN.START])], 0.5, 1000, 0);
    expect(f.dx).toBeCloseTo(500);
    expect(f.left).toBe(true);
    expect(f.wheel).toBe(1);
    expect(f.keys).toEqual(['Escape']);
    f = m.frame([pad([0, 0], [BTN.A, BTN.RB, BTN.START])], 0.5, 1000, 0);
    expect(f.wheel).toBe(0); // held, not a new edge
    expect(f.keys).toEqual([]);
    expect(f.left).toBe(true);
    f = m.frame([pad([0, 0], [BTN.LT, BTN.Y])], 0.016, 1000, 0);
    expect(f).toMatchObject({ left: false, right: true, keys: ['Tab'] });
    expect(m.frame([null, { ...pad([1, 1]), connected: false }], 1, 1000, 0).active).toBe(false);
  });
});

describe('Steam overlay gate (PLT-0042)', () => {
  const fakeInput = () => {
    const calls: [boolean, number | undefined][] = [];
    const input = {
      replay: null as FrameSource | null,
      pos: { x: 640, y: 360 },
      device: 'kbm' as const,
      notifyOverlay: (active: boolean, t?: number) => calls.push([active, t]),
    };
    return { input, calls };
  };

  it('pauses, releases held input and feeds empty frames while the overlay is up, then restores the devices', () => {
    const { input, calls } = fakeInput();
    let paused = 0;
    let now = 1000;
    const gate = new OverlayGate(
      input,
      () => paused++,
      () => now,
    );
    expect(gate.up).toBe(false);
    gate.set(true);
    expect(paused).toBe(1);
    expect(calls).toEqual([[true, 1000]]);
    expect(input.replay).not.toBeNull();
    now = 1016;
    const f = input.replay!.next()!;
    expect(f).toMatchObject({ t: 1016, events: [], sticks: { lx: 0, ly: 0, rx: 0, ry: 0 }, device: 'kbm', start: { x: 640, y: 360 } });
    expect(f.dt).toBeGreaterThan(0);
    // Repeated activations are idempotent; closing restores live input without a second pause.
    gate.set(true);
    expect(paused).toBe(1);
    gate.set(false);
    expect(gate.up).toBe(false);
    expect(input.replay).toBeNull();
    expect(calls.at(-1)).toEqual([false, 1016]);
    expect(paused).toBe(1);
  });

  it('leaves a recording replay in place', () => {
    const { input } = fakeInput();
    const replay: FrameSource = { next: () => null };
    input.replay = replay;
    const gate = new OverlayGate(
      input,
      () => undefined,
      () => 0,
    );
    gate.set(true);
    expect(input.replay).toBe(replay);
    gate.set(false);
    expect(input.replay).toBe(replay);
  });

  it('the bridge allow-lists carry the overlay event and the timeline channel', () => {
    expect(EVENT_CHANNELS).toContain('ss:overlay');
    expect(SEND_CHANNELS).toContain('ss:steam-timeline');
    expect(INVOKE_CHANNELS).toContain('ss:window-size');
    expect(() => new NoSteam().timeline({ kind: 'op-start', title: 'x', icon: 'steam_marker', priority: 1 })).not.toThrow();
  });
});
