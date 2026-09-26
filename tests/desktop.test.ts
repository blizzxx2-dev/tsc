import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { resolvePaths, userNamespace, isSafeName } from '../desktop/src/paths';
import { gpuSwitches, parseArgs } from '../desktop/src/args';
import { onCrash, onHealthy, onLaunch, parseHealth, initialHealth, CRASH_WINDOW_MS } from '../desktop/src/health';
import { parseWindowSize, restoreState, sizedState, type Screen } from '../desktop/src/windowstate';
import { buildCsp, dsnOrigin, resolveAppFile } from '../desktop/src/csp';
import { crc32, zip } from '../desktop/src/zip';
import { atomicWrite, readAll } from '../desktop/src/fsstore';
import { RotatingLog } from '../desktop/src/logfile';
import { decode, encode, freshProfile, readProfile } from '../src/core/save/codec';

const tmp = () => mkdtempSync(join(tmpdir(), 'ss-test-'));
const valid = (_n: string, t: string) => decode(t, 'profile').ok;

describe('OS paths', () => {
  it('Windows: roaming saves, local logs/cache, no Documents', () => {
    const p = resolvePaths(
      'windows',
      { APPDATA: 'C:\\Users\\Jürgen Ünïcødé\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\Jürgen Ünïcødé\\AppData\\Local' },
      'C:\\Users\\Jürgen Ünïcødé',
      'demo',
      'local',
    );
    expect(p.saves).toBe('C:\\Users\\Jürgen Ünïcødé\\AppData\\Roaming\\suture-and-steel\\demo\\local');
    expect(p.settings).toBe(p.saves);
    expect(p.logs).toBe('C:\\Users\\Jürgen Ünïcødé\\AppData\\Local\\suture-and-steel\\logs\\demo');
    expect(p.cache).toBe('C:\\Users\\Jürgen Ünïcødé\\AppData\\Local\\suture-and-steel\\cache\\demo');
    expect(p.demoSaves).toBe('C:\\Users\\Jürgen Ünïcødé\\AppData\\Roaming\\suture-and-steel\\demo\\local');
    expect(Object.values(p).some((v) => /Documents|OneDrive/i.test(v))).toBe(false);
  });

  it('macOS: Application Support and Library/Logs', () => {
    const p = resolvePaths('mac', {}, '/Users/ana', 'full', 'steam-abc');
    expect(p.saves).toBe('/Users/ana/Library/Application Support/suture-and-steel/full/steam-abc');
    expect(p.logs).toBe('/Users/ana/Library/Logs/suture-and-steel/full');
    expect(p.demoSaves).toBe('/Users/ana/Library/Application Support/suture-and-steel/demo/steam-abc');
  });

  it('Linux: XDG data/config/state/cache with defaults and overrides', () => {
    const p = resolvePaths('linux', {}, '/home/deck', 'demo', 'local');
    expect(p.saves).toBe('/home/deck/.local/share/suture-and-steel/demo/local');
    expect(p.settings).toBe('/home/deck/.config/suture-and-steel/demo/local');
    expect(p.logs).toBe('/home/deck/.local/state/suture-and-steel/demo/logs');
    expect(p.cache).toBe('/home/deck/.cache/suture-and-steel/demo');
    const q = resolvePaths('linux', { XDG_DATA_HOME: '/data', XDG_CONFIG_HOME: 'relative/ignored' }, '/home/deck', 'demo', 'local');
    expect(q.saves).toBe('/data/suture-and-steel/demo/local');
    expect(q.settings).toBe('/home/deck/.config/suture-and-steel/demo/local');
  });

  it('namespaces saves per Steam user and rejects unsafe file names', () => {
    expect(userNamespace(null, (s) => s)).toBe('local');
    expect(userNamespace('76561198000000000', () => 'a1b2c3d4e5f6a7b8')).toBe('steam-a1b2c3d4e5f6');
    for (const n of ['profile.json', 'slot1.json.bak', 'settings.json']) expect(isSafeName(n)).toBe(true);
    for (const n of ['../x', '..', 'a/b', 'a\\b', '.hidden', '', 'x'.repeat(80)]) expect(isSafeName(n)).toBe(false);
  });
});

describe('command line', () => {
  it('parses the documented flags and ignores the rest', () => {
    const a = parseArgs([
      '--fullscreen',
      '--windowed',
      '--safe-mode',
      '--reset-settings',
      '--log-level=debug',
      '--gl-backend=d3d11',
      '--flag=watermark=1',
      '--kiosk',
      '-psn_0_123',
      'C:\\x',
      '--gl-backend=evil',
    ]);
    expect(a).toMatchObject({
      windowed: true,
      fullscreen: false,
      safeMode: true,
      resetSettings: true,
      kiosk: true,
      logLevel: 'debug',
      glBackend: 'd3d11',
      flags: { watermark: '1' },
      dev: false,
    });
    expect(parseArgs(['--log-level=loud']).logLevel).toBeNull();
  });

  it('asks for the discrete graphics card, except in safe mode, on the software renderer or with --integrated-gpu', () => {
    expect(gpuSwitches({ safeMode: false, glBackend: null })).toEqual(['force_high_performance_gpu']);
    expect(gpuSwitches({ safeMode: false, glBackend: 'd3d11' })).toEqual(['force_high_performance_gpu']);
    expect(gpuSwitches({ safeMode: true, glBackend: null })).toEqual([]);
    expect(gpuSwitches({ safeMode: false, glBackend: 'swiftshader' })).toEqual([]);
    expect(parseArgs(['--integrated-gpu']).integratedGpu).toBe(true);
    expect(gpuSwitches(parseArgs(['--integrated-gpu']))).toEqual([]);
  });
});

describe('launch health → safe mode', () => {
  it('offers safe mode after two consecutive failed launches', () => {
    let s = initialHealth();
    let r = onLaunch(s);
    expect(r.offerSafeMode).toBe(false);
    s = r.state; // crashed before healthy
    r = onLaunch(s);
    expect(r.offerSafeMode).toBe(false);
    r = onLaunch(r.state);
    expect(r.offerSafeMode).toBe(true);
    expect(onLaunch(onHealthy(r.state)).offerSafeMode).toBe(false);
    expect(parseHealth('garbage')).toEqual(initialHealth());
  });

  it('offers safe mode after two renderer crashes within ten minutes', () => {
    const t0 = 1_000_000;
    const a = onCrash(initialHealth(), t0);
    expect(a.offerSafeMode).toBe(false);
    expect(onCrash(a.state, t0 + 60_000).offerSafeMode).toBe(true);
    expect(onCrash(a.state, t0 + CRASH_WINDOW_MS + 1).offerSafeMode).toBe(false);
  });
});

describe('window state', () => {
  const primary: Screen = { id: 1, primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  const second: Screen = { id: 2, bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, workArea: { x: 1920, y: 0, width: 2560, height: 1400 } };

  it('restores onto the same monitor, clamped to its work area', () => {
    const s = restoreState({ mode: 'windowed', displayId: 2, bounds: { x: 4000, y: 1300, width: 1600, height: 900 } }, [primary, second]);
    expect(s.displayId).toBe(2);
    expect(s.bounds).toEqual({ x: 2880, y: 500, width: 1600, height: 900 });
  });

  it('falls back to the primary display when the stored monitor is gone', () => {
    const s = restoreState({ mode: 'borderless', displayId: 2, bounds: { x: 2500, y: 100, width: 1280, height: 720 } }, [primary]);
    expect(s.displayId).toBe(1);
    expect(s.mode).toBe('borderless');
    expect(s.bounds.x + s.bounds.width).toBeLessThanOrEqual(1920);
  });

  it('defaults to fullscreen centred on the primary display', () => {
    expect(restoreState(null, [primary])).toEqual({ mode: 'fullscreen', displayId: 1, maximized: false, bounds: { x: 320, y: 160, width: 1280, height: 720 } });
  });

  it("size presets (UIX-0105): parsed from the setting, centred on the window's display, shrunk to its work area", () => {
    expect(parseWindowSize('1600x900')).toEqual({ w: 1600, h: 900 });
    expect(parseWindowSize('800x600')).toBeNull();
    expect(parseWindowSize('1600 x 900')).toBeNull();
    expect(parseWindowSize(1600)).toBeNull();
    const base = restoreState({ mode: 'windowed', displayId: 2, maximized: true, bounds: { x: 2000, y: 100, width: 1280, height: 720 } }, [primary, second]);
    const s = sizedState(base, 1600, 900, [primary, second]);
    expect(s).toEqual({ mode: 'windowed', displayId: 2, maximized: false, bounds: { x: 1920 + 480, y: 250, width: 1600, height: 900 } });
    // A preset larger than the monitor fills its work area instead of spilling off screen.
    const big = sizedState(restoreState(null, [primary]), 2560, 1440, [primary]);
    expect(big.bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1040 });
    // Unknown display id: the primary display.
    expect(sizedState({ ...base, displayId: 99 }, 1280, 720, [primary, second]).displayId).toBe(1);
  });
});

describe('app:// protocol and CSP', () => {
  it('serves only files inside the game root', () => {
    const root = '/opt/game/dist';
    expect(resolveAppFile(root, 'app://game/')).toBe('/opt/game/dist/index.html');
    expect(resolveAppFile(root, 'app://game/assets/index.js')).toBe('/opt/game/dist/assets/index.js');
    expect(resolveAppFile(root, 'app://game/../../etc/passwd')).toBe('/opt/game/dist/etc/passwd'); // URL parser normalises
    expect(resolveAppFile(root, 'app://game/%2e%2e/%2e%2e/etc/passwd')).toBe('/opt/game/dist/etc/passwd'); // decoded dots cannot climb out either
    expect(resolveAppFile(root, 'app://evil/index.html')).toBeNull();
    expect(resolveAppFile(root, 'file:///etc/passwd')).toBeNull();
  });

  it("CSP defaults to 'self' and only adds the crash endpoint", () => {
    const csp = buildCsp([dsnOrigin('https://k@o1.ingest.sentry.io/5')!]);
    expect(csp.startsWith("default-src 'self'")).toBe(true);
    expect(csp).toContain("connect-src 'self' https://o1.ingest.sentry.io");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-eval'"); // only 'wasm-unsafe-eval' (the KTX2 transcoder)
  });
});

describe('support bundle zip', () => {
  it('writes a valid stored zip', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const z = zip({ 'logs/game.log': 'hello', 'saves/profile.json': '{}' });
    expect(z.readUInt32LE(0)).toBe(0x04034b50);
    const eocd = z.length - 22;
    expect(z.readUInt32LE(eocd)).toBe(0x06054b50);
    expect(z.readUInt16LE(eocd + 10)).toBe(2);
    const cdOffset = z.readUInt32LE(eocd + 16);
    expect(z.readUInt32LE(cdOffset)).toBe(0x02014b50);
    expect(z.toString('utf8')).toContain('hello');
  });
});

describe('atomic save files', () => {
  it('keeps the previous valid file as .bak and removes temp debris on read', () => {
    const dir = tmp();
    const a = encode('profile', { ...freshProfile('demo', 'a'), playtime: 1 });
    const b = encode('profile', { ...freshProfile('demo', 'b'), playtime: 2 });
    atomicWrite(dir, 'profile.json', a, valid);
    atomicWrite(dir, 'profile.json', b, valid);
    expect(readFileSync(join(dir, 'profile.json'), 'utf8')).toBe(b);
    expect(readFileSync(join(dir, 'profile.json.bak'), 'utf8')).toBe(a);
    // A corrupt current file never replaces a good backup.
    writeFileSync(join(dir, 'profile.json'), 'garbage');
    atomicWrite(dir, 'profile.json', b, valid);
    expect(readFileSync(join(dir, 'profile.json.bak'), 'utf8')).toBe(a);
    writeFileSync(join(dir, 'profile.json.tmp'), 'half');
    expect(Object.keys(readAll(dir)).sort()).toEqual(['profile.json', 'profile.json.bak']);
    expect(existsSync(join(dir, 'profile.json.tmp'))).toBe(false);
    expect(() => atomicWrite(dir, '../escape.json', a, valid)).toThrow();
    rmSync(dir, { recursive: true, force: true });
  });

  it('power-cut simulation: killing the writer mid-write never leaves an unreadable save', async () => {
    const dir = tmp();
    const bundle = join(dir, 'fsstore.cjs');
    await build({ entryPoints: ['desktop/src/fsstore.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent' });
    const saves = join(dir, 'saves');
    // Large profiles make each write take long enough to be interrupted part-way.
    const driver = join(dir, 'driver.cjs');
    writeFileSync(
      driver,
      `const { atomicWrite } = require(${JSON.stringify(bundle)});
       const valid = (n, t) => { try { return JSON.parse(t).format === 'suture-and-steel'; } catch { return false; } };
       const [a, b] = [process.argv[2], process.argv[3]].map((f) => require('fs').readFileSync(f, 'utf8'));
       for (let i = 0; ; i++) atomicWrite(${JSON.stringify(saves)}, 'profile.json', i % 2 ? a : b, valid);`,
    );
    const mk = (n: number) => {
      const p = freshProfile('demo', `gen${n}`);
      p.unlocks = Array.from({ length: 20000 }, (_, i) => `unlock.${n}.${i}`);
      const f = join(dir, `p${n}.json`);
      writeFileSync(f, encode('profile', p));
      return f;
    };
    const [fa, fb] = [mk(1), mk(2)];
    // A save already exists when the writer starts (the case a power cut can destroy).
    atomicWrite(saves, 'profile.json', readFileSync(fa, 'utf8'), valid);
    for (let round = 0; round < 12; round++) {
      const child = spawn(process.execPath, [driver, fa, fb], { stdio: 'ignore' });
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
      child.kill('SIGKILL');
      await new Promise((r) => child.on('exit', r));
      const files = readAll(saves);
      const main = readProfile(files['profile.json'] ?? null, 'demo', 't');
      const bak = readProfile(files['profile.json.bak'] ?? null, 'demo', 't');
      expect(main ?? bak, `round ${round}: ${Object.keys(files).join(',')}`).not.toBeNull();
      expect(readdirSync(saves).some((n) => n.endsWith('.tmp'))).toBe(false);
    }
    rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});

describe('rotating log files', () => {
  it('rotates at the size limit, keeps five files, each with a header', () => {
    const dir = tmp();
    const log = new RotatingLog(dir, () => '# header build=1', 'game', 2000, 5);
    for (let i = 0; i < 200; i++) log.write([`line ${i} ${'x'.repeat(40)}`]);
    const files = readdirSync(dir).sort();
    expect(files).toEqual(['game.1.log', 'game.2.log', 'game.3.log', 'game.4.log', 'game.log']);
    for (const f of files) {
      const text = readFileSync(join(dir, f), 'utf8');
      expect(text.startsWith('# header build=1')).toBe(true);
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(2000);
    }
    expect(readFileSync(join(dir, 'game.log'), 'utf8')).toContain('line 199');
    // A new launch starts a fresh file.
    new RotatingLog(dir, () => '# header build=2', 'game', 2000, 5);
    expect(readFileSync(join(dir, 'game.log'), 'utf8').trim()).toBe('# header build=2');
    expect(readFileSync(join(dir, 'game.1.log'), 'utf8')).toContain('line 199');
    rmSync(dir, { recursive: true, force: true });
  });
});
