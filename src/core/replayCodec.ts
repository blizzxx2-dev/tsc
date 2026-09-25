/**
 * Compact binary replays (ENG-0253, ENG-0257).
 *
 * An operation's input log (`InputLog`: every pointer sample, tick, tool switch and key action fed
 * to the simulation) is encoded as bytes:
 *
 * - a header with magic, format version, build id and content hash (ENG-0257): a replay from a
 *   build whose content differs refuses to load with a clear message instead of silently desyncing;
 * - one flag byte per pointer sample (button state, "prev is the last sample", "did not move",
 *   "same dt as last time", "a tick follows") so hovering or holding costs one byte per tick;
 * - positions as the change in velocity (second-order delta) in 1/8 px units, packed two to a byte
 *   when small, which is what live input is quantised to (`quantizePointer`, applied by the input
 *   layer) — a moving stroke costs about two bytes per tick; pointer dts on a 10 µs grid
 *   (`quantizeDt`) are varints, tick dts go in a tiny dictionary;
 * - `packReplay` then deflates the body (CompressionStream) for files and reports.
 *
 * Values off those grids (scripted bots, tests) fall back to exact float64s, so the encoding is
 * always lossless and a decoded log re-simulates to identical state hashes.
 */
import type { LogOp, OperationDef } from '../surgery/operation';
import type { InputLog } from '../surgery/replay';
import { DEFAULT_TUNING } from '../surgery/tuning';
import type { ToolId } from '../surgery/types';

export const REPLAY_MAGIC = 'SSRP';
export const REPLAY_FORMAT_VERSION = 1;
/** Pointer quantum: live input positions are rounded to 1/8 virtual px. */
export const POINTER_QUANTUM = 8;
/** Pointer dt quantum: 10 µs. */
export const DT_QUANTUM = 1e5;

export const quantize = (v: number): number => Math.round(v * POINTER_QUANTUM) / POINTER_QUANTUM;
/** Round a pointer position to the replay grid (live input does this before the simulation sees it). */
export const quantizePointer = (p: { x: number; y: number }): { x: number; y: number } => ({ x: quantize(p.x), y: quantize(p.y) });
export const quantizeDt = (dt: number): number => Math.round(dt * DT_QUANTUM) / DT_QUANTUM;

export interface ReplayHeader {
  version: number;
  /** `version+sha.date` of the build that recorded it. */
  build: string;
  /** Hash of the operation content the recording ran against. */
  content: string;
}

export interface EncodedReplay {
  header: ReplayHeader;
  log: InputLog;
}

const TOOLS: readonly ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];

// Pointer record: bit 7 set. Flags:
const P_DOWN = 0x40;
const P_PREV_SAME = 0x20;
const P_POS_SAME = 0x10;
const P_DT_SAME = 0x08;
const P_TICK = 0x04;
const P_NIBBLE = 0x02;
const P_EXT = 0x01;
// Extension byte (after a pointer record with P_EXT).
const X_PRESSED = 0x01;
const X_RELEASED = 0x02;
const X_RAW = 0x04;
// Other records: bit 7 clear, low 4 bits opcode.
const OP_TICKS = 1;
const OP_TOOL = 2;
const OP_CYCLE = 3;
const OP_QUICK = 4;
const OP_LITANY = 5;
const OP_HELP = 6;
const OP_WHEEL = 7;
const OP_TINCT = 8;
const OP_REVERSE = 9;
const OP_END = 15;
/** OP_TICKS flag: same dt as the previous tick (no dictionary index). */
const T_DT_SAME = 0x10;

class Writer {
  private buf = new Uint8Array(4096);
  n = 0;
  private f64 = new DataView(new ArrayBuffer(8));
  private grow(k: number): void {
    if (this.n + k <= this.buf.length) return;
    const b = new Uint8Array(Math.max(this.buf.length * 2, this.n + k));
    b.set(this.buf);
    this.buf = b;
  }
  byte(b: number): void {
    this.grow(1);
    this.buf[this.n++] = b & 255;
  }
  uvar(v: number): void {
    while (v >= 0x80) {
      this.byte((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }
    this.byte(v);
  }
  svar(v: number): void {
    this.uvar(v < 0 ? -2 * v - 1 : 2 * v);
  }
  float(v: number): void {
    this.grow(8);
    this.f64.setFloat64(0, v, true);
    for (let i = 0; i < 8; i++) this.buf[this.n++] = this.f64.getUint8(i);
  }
  str(s: string): void {
    const b = new TextEncoder().encode(s);
    this.uvar(b.length);
    this.grow(b.length);
    this.buf.set(b, this.n);
    this.n += b.length;
  }
  bytes(): Uint8Array {
    return this.buf.slice(0, this.n);
  }
}

class Reader {
  i = 0;
  private dv: DataView;
  constructor(private b: Uint8Array) {
    this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  }
  byte(): number {
    if (this.i >= this.b.length) throw new Error('replay file is truncated');
    return this.b[this.i++];
  }
  uvar(): number {
    let v = 0;
    let m = 1;
    for (;;) {
      const b = this.byte();
      v += (b & 0x7f) * m;
      if (b < 0x80) return v;
      m *= 0x80;
    }
  }
  svar(): number {
    const u = this.uvar();
    return u % 2 ? -(u + 1) / 2 : u / 2;
  }
  float(): number {
    if (this.i + 8 > this.b.length) throw new Error('replay file is truncated');
    const v = this.dv.getFloat64(this.i, true);
    this.i += 8;
    return v;
  }
  str(): string {
    const n = this.uvar();
    if (this.i + n > this.b.length) throw new Error('replay file is truncated');
    const s = new TextDecoder().decode(this.b.subarray(this.i, this.i + n));
    this.i += n;
    return s;
  }
  rest(): Uint8Array {
    return this.b.subarray(this.i);
  }
}

const onGrid = (v: number) => Number.isFinite(v) && Math.abs(v) < 1e6 && quantize(v) === v && !Object.is(v, -0);
const dtOnGrid = (v: number) => v >= 0 && v < 1e3 && quantizeDt(v) === v && !Object.is(v, -0);
const nib = (v: number) => v >= -8 && v <= 7;

/** Header fields up to (not including) the body; `deflated` marks a `packReplay` body. */
function writeHeader(w: Writer, log: InputLog, header: Omit<ReplayHeader, 'version'>, deflated: boolean): void {
  for (const c of REPLAY_MAGIC) w.byte(c.charCodeAt(0));
  w.uvar(REPLAY_FORMAT_VERSION);
  w.str(header.build);
  w.str(header.content);
  w.str(log.opId);
  w.str(JSON.stringify(log.opts));
  w.byte(deflated ? 1 : 0);
}

function writeBody(w: Writer, log: InputLog): void {
  // Dictionary of tick dts (a handful of values: 1/120, 1/60, hitstop fractions…).
  const dts: number[] = [];
  for (const o of log.ops) if (o[0] === 'u' && !dts.includes(o[1])) dts.push(o[1]);
  w.uvar(dts.length);
  for (const d of dts) w.float(d);

  let px = 0;
  let py = 0;
  let vx = 0;
  let vy = 0;
  let lastX = NaN;
  let lastY = NaN;
  let lastPdt = NaN;
  let lastUdt = NaN;
  const ops = log.ops;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    switch (o[0]) {
      case 'u': {
        let n = 1;
        while (i + n < ops.length && ops[i + n][0] === 'u' && (ops[i + n] as ['u', number])[1] === o[1]) n++;
        const same = o[1] === lastUdt;
        w.byte(OP_TICKS | (same ? T_DT_SAME : 0));
        if (!same) w.uvar(dts.indexOf(o[1]));
        w.uvar(n);
        lastUdt = o[1];
        i += n - 1;
        break;
      }
      case 'p': {
        const [, x, y, qx, qy, down, pressed, released, dt] = o;
        const prevSame = Object.is(qx, lastX) && Object.is(qy, lastY);
        const posSame = Object.is(x, lastX) && Object.is(y, lastY);
        const raw = !(posSame || (onGrid(x) && onGrid(y))) || !(prevSame || (onGrid(qx) && onGrid(qy)));
        const dtSame = Object.is(dt, lastPdt);
        const dtRaw = !dtSame && !dtOnGrid(dt);
        // A following tick with the previous tick's dt folds into this record.
        const next = ops[i + 1];
        const tick = !!next && next[0] === 'u' && next[1] === lastUdt && !(ops[i + 2]?.[0] === 'u' && ops[i + 2][1] === lastUdt);
        let X = 0;
        let Y = 0;
        let ddx = 0;
        let ddy = 0;
        if (!raw && !posSame) {
          X = Math.round(x * POINTER_QUANTUM);
          Y = Math.round(y * POINTER_QUANTUM);
          ddx = X - px - vx;
          ddy = Y - py - vy;
        }
        const nibble = !raw && !posSame && nib(ddx) && nib(ddy);
        const ext = pressed || released || raw || dtRaw;
        w.byte(0x80 | (down ? P_DOWN : 0) | (prevSame ? P_PREV_SAME : 0) | (posSame ? P_POS_SAME : 0) | (dtSame ? P_DT_SAME : 0) | (tick ? P_TICK : 0) | (nibble ? P_NIBBLE : 0) | (ext ? P_EXT : 0));
        if (ext) w.byte((pressed ? X_PRESSED : 0) | (released ? X_RELEASED : 0) | (raw ? X_RAW : 0) | (dtRaw ? 0x08 : 0));
        if (!dtSame) {
          if (dtRaw) w.float(dt);
          else w.uvar(Math.round(dt * DT_QUANTUM));
        }
        if (raw) {
          if (!posSame) {
            w.float(x);
            w.float(y);
          }
          if (!prevSame) {
            w.float(qx);
            w.float(qy);
          }
        } else {
          if (!prevSame) {
            w.svar(Math.round(qx * POINTER_QUANTUM) - px);
            w.svar(Math.round(qy * POINTER_QUANTUM) - py);
          }
          if (!posSame) {
            if (nibble) w.byte(((ddx + 8) << 4) | (ddy + 8));
            else {
              w.svar(ddx);
              w.svar(ddy);
            }
          }
        }
        // Predictor: grid samples track velocity; raw samples reset it.
        if (posSame) vx = vy = 0;
        else if (raw) {
          vx = vy = 0;
          px = Math.round(x * POINTER_QUANTUM);
          py = Math.round(y * POINTER_QUANTUM);
        } else {
          vx = X - px;
          vy = Y - py;
          px = X;
          py = Y;
        }
        lastX = x;
        lastY = y;
        lastPdt = dt;
        if (tick) i++;
        break;
      }
      case 't':
        w.byte(OP_TOOL);
        w.uvar(Math.max(0, TOOLS.indexOf(o[1])));
        break;
      case 'c':
        w.byte(OP_CYCLE);
        w.svar(o[1]);
        break;
      case 'q':
        w.byte(OP_QUICK);
        break;
      case 'l':
        w.byte(OP_LITANY);
        break;
      case 'h':
        w.byte(OP_HELP);
        break;
      case 'w':
        w.byte(OP_WHEEL);
        w.float(o[1]);
        break;
      case 'k':
        w.byte(OP_TINCT);
        break;
      case 'r':
        w.byte(OP_REVERSE);
        break;
    }
  }
  w.byte(OP_END);
}

function readBody(r: Reader): LogOp[] {
  const dts: number[] = [];
  for (let i = r.uvar(); i > 0; i--) dts.push(r.float());
  const ops: LogOp[] = [];
  let px = 0;
  let py = 0;
  let vx = 0;
  let vy = 0;
  let lastX = NaN;
  let lastY = NaN;
  let lastPdt = NaN;
  let lastUdt = NaN;
  for (;;) {
    const b = r.byte();
    if (b & 0x80) {
      const ext = b & P_EXT ? r.byte() : 0;
      const raw = (ext & X_RAW) !== 0;
      const posSame = (b & P_POS_SAME) !== 0;
      const prevSame = (b & P_PREV_SAME) !== 0;
      const dt = b & P_DT_SAME ? lastPdt : ext & 0x08 ? r.float() : r.uvar() / DT_QUANTUM;
      let x = lastX;
      let y = lastY;
      let qx = lastX;
      let qy = lastY;
      if (raw) {
        if (!posSame) {
          x = r.float();
          y = r.float();
        }
        if (!prevSame) {
          qx = r.float();
          qy = r.float();
        }
      } else {
        if (!prevSame) {
          qx = (px + r.svar()) / POINTER_QUANTUM;
          qy = (py + r.svar()) / POINTER_QUANTUM;
        }
        if (!posSame) {
          let ddx: number;
          let ddy: number;
          if (b & P_NIBBLE) {
            const n = r.byte();
            ddx = (n >> 4) - 8;
            ddy = (n & 15) - 8;
          } else {
            ddx = r.svar();
            ddy = r.svar();
          }
          vx += ddx;
          vy += ddy;
          px += vx;
          py += vy;
          x = px / POINTER_QUANTUM;
          y = py / POINTER_QUANTUM;
        }
      }
      if (posSame) vx = vy = 0;
      else if (raw) {
        vx = vy = 0;
        px = Math.round(x * POINTER_QUANTUM);
        py = Math.round(y * POINTER_QUANTUM);
      }
      lastX = x;
      lastY = y;
      lastPdt = dt;
      ops.push(['p', x, y, qx, qy, b & P_DOWN ? 1 : 0, ext & X_PRESSED ? 1 : 0, ext & X_RELEASED ? 1 : 0, dt]);
      if (b & P_TICK) ops.push(['u', lastUdt]);
      continue;
    }
    const op = b & 0x0f;
    if (op === OP_END) break;
    switch (op) {
      case OP_TICKS: {
        const dt = b & T_DT_SAME ? lastUdt : dts[r.uvar()];
        lastUdt = dt;
        for (let n = r.uvar(); n > 0; n--) ops.push(['u', dt]);
        break;
      }
      case OP_TOOL:
        ops.push(['t', TOOLS[r.uvar()] ?? 'lancet']);
        break;
      case OP_CYCLE:
        ops.push(['c', r.svar()]);
        break;
      case OP_QUICK:
        ops.push(['q']);
        break;
      case OP_LITANY:
        ops.push(['l']);
        break;
      case OP_HELP:
        ops.push(['h']);
        break;
      case OP_WHEEL:
        ops.push(['w', r.float()]);
        break;
      case OP_TINCT:
        ops.push(['k']);
        break;
      case OP_REVERSE:
        ops.push(['r']);
        break;
      default:
        throw new Error(`replay file is corrupt (opcode ${op} at byte ${r.i - 1})`);
    }
  }
  return ops;
}

/** Encode a log with its header (uncompressed body). Lossless: `decodeReplay(encodeReplay(x)).log` deep-equals `x`. */
export function encodeReplay(log: InputLog, header: Omit<ReplayHeader, 'version'>): Uint8Array {
  const w = new Writer();
  writeHeader(w, log, header, false);
  writeBody(w, log);
  return w.bytes();
}

interface Parsed {
  header: ReplayHeader;
  opId: string;
  opts: InputLog['opts'];
  deflated: boolean;
  reader: Reader;
}

function parse(bytes: Uint8Array): Parsed {
  const r = new Reader(bytes);
  const magic = String.fromCharCode(r.byte(), r.byte(), r.byte(), r.byte());
  if (magic !== REPLAY_MAGIC) throw new Error('This is not a Suture & Steel replay file.');
  const version = r.uvar();
  if (version > REPLAY_FORMAT_VERSION) throw new Error(`This replay was saved in format ${version}, newer than this build reads (${REPLAY_FORMAT_VERSION}). Update the game to watch it.`);
  const build = r.str();
  const content = r.str();
  const opId = r.str();
  const opts = JSON.parse(r.str()) as InputLog['opts'];
  const deflated = r.byte() === 1;
  return { header: { version, build, content }, opId, opts, deflated, reader: r };
}

/** Read only the header (to check compatibility before decoding the body). */
export function readReplayHeader(bytes: Uint8Array): ReplayHeader & { opId: string } {
  const p = parse(bytes);
  return { ...p.header, opId: p.opId };
}

const checkContent = (h: ReplayHeader, expect?: { content: string; build?: string }) => {
  if (expect && h.content !== expect.content)
    throw new Error(`This replay was recorded on build ${h.build} with different operation content (${h.content}); this build (${expect.build ?? 'current'}) has ${expect.content}. It cannot be replayed here.`);
};

/**
 * Decode an uncompressed replay. With `expect`, a replay whose content hash differs from this
 * build's refuses to load, naming both builds, since it would desync (ENG-0257).
 */
export function decodeReplay(bytes: Uint8Array, expect?: { content: string; build?: string }): EncodedReplay {
  const p = parse(bytes);
  checkContent(p.header, expect);
  if (p.deflated) throw new Error('compressed replay: use unpackReplay');
  return { header: p.header, log: { version: 1, opId: p.opId, opts: p.opts, ops: readBody(p.reader) } };
}

async function pipe(data: Uint8Array, stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }): Promise<Uint8Array> {
  const out = new Response(stream.readable).arrayBuffer();
  const w = stream.writable.getWriter();
  await w.write(data);
  await w.close();
  return new Uint8Array(await out);
}

/** Encode and deflate the body: the file format for saved replays and bug reports. */
export async function packReplay(log: InputLog, header: Omit<ReplayHeader, 'version'>): Promise<Uint8Array> {
  const body = new Writer();
  writeBody(body, log);
  const z = await pipe(body.bytes(), new CompressionStream('deflate-raw') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> });
  const w = new Writer();
  writeHeader(w, log, header, true);
  const head = w.bytes();
  const out = new Uint8Array(head.length + z.length);
  out.set(head);
  out.set(z, head.length);
  return out;
}

/** Decode a packed (or plain) replay, checking the content hash when `expect` is given. */
export async function unpackReplay(bytes: Uint8Array, expect?: { content: string; build?: string }): Promise<EncodedReplay> {
  const p = parse(bytes);
  checkContent(p.header, expect);
  if (!p.deflated) return decodeReplay(bytes, expect);
  const body = await pipe(p.reader.rest(), new DecompressionStream('deflate-raw') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> });
  return { header: p.header, log: { version: 1, opId: p.opId, opts: p.opts, ops: readBody(new Reader(body)) } };
}

/** FNV-1a hash of a string, hex (content hashes for replay headers). */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Content hash of an operation as this build runs it: its definition (spawn functions by source)
 * and the default tuning tables. Two builds that would simulate a recording differently disagree.
 */
export function contentHash(def: OperationDef): string {
  const fn = (_k: string, v: unknown) => (typeof v === 'function' ? String(v) : v);
  return hashString(JSON.stringify(def, fn) + JSON.stringify(DEFAULT_TUNING));
}
