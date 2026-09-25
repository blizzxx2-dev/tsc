/**
 * Operation audio director. Observes the (DOM-free) simulation each frame and
 * turns it into sound: resolves the sim's cues with context (tool, ratings,
 * what just died or spawned), drives held-tool and ailment loops, schedules
 * the heartbeat, rings vitals alarms, ticks the clock, sets music layers and
 * boss sections, and applies the Litany, low-vitals and pause snapshots.
 */
import { dist, type Vec } from '../core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../surgery/lauds';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, LITANY_DURATION, onBody, TINCTURE_TIME, type Operation, type Popup } from '../surgery/operation';
import type { ToolId } from '../surgery/types';
import type { LoopHandle, PlayOpts } from './engine';
import { isEventId, type EventId } from './events';
import { countCorners, heartParams, HeartbeatScheduler } from './heartbeat';
import { dbToGain } from './mixer';
import type { HourId } from './music/themes';
import type { AudioSystem } from './system';

export interface PointerState {
  pos: Vec;
  down: boolean;
  pressed: boolean;
  released: boolean;
  rightDown: boolean;
}

export interface OpFrame {
  op: Operation;
  dt: number;
  paused: boolean;
  /** ECG beat phase (0..1) and bpm from the scene. */
  beatPhase: number;
  bpm: number;
  input: PointerState;
  keyPressed: (code: string) => boolean;
}

/** Stereo position from a field x coordinate (−0.6…0.6). */
export const panOf = (x: number): number => Math.max(-0.6, Math.min(0.6, ((x - FIELD.cx) / FIELD.rx) * 0.6));

/** Patient voice type from the operation's patient line and race: 0 man, 1 woman, 2 elder, 3 deep (mountainfolk, hornfolk, giants). */
export function patientVoice(patient: string, race?: string): number {
  if (race === 'mountainfolk' || race === 'hornfolk' || race === 'giant') return 3;
  if (/\b(woman|girl|widow|mother|wife|maid|daughter|sister|abbess|nun|lady|goodwife|Frau|she|her)\b/i.test(patient)) return 1;
  if (/\b(old|elder|aged|grandfather|grandsire|greybeard|venerable)\b/i.test(patient)) return 2;
  return 0;
}

/** Popup label → designed resolution event, and the legacy cue it replaces that frame. */
const LABEL_EVENTS: Record<string, { id: EventId; covers?: string[]; delay?: number }> = {
  Arrow: { id: 'sfx.extract.arrow' },
  Bolt: { id: 'sfx.extract.bolt' },
  'Lead shot': { id: 'sfx.extract.shot' },
  Fang: { id: 'sfx.extract.tooth' },
  Shard: { id: 'sfx.extract.shard' },
  Glass: { id: 'sfx.extract.glass' },
  Hexstone: { id: 'sfx.extract.hexstone' },
  Torn: { id: 'sfx.barb.tear' },
  Nick: { id: 'sfx.lancet.nick', covers: ['cut'] },
  'Barbs freed': { id: 'sfx.lancet.nick', covers: ['cut'] },
  'Off the line': { id: 'sfx.lancet.slip' },
  Incision: { id: 'sfx.lancet.open', covers: ['squelch'] },
  Debrided: { id: 'sfx.burn.crack', covers: ['pluck'] },
  'Burn dressed': { id: 'sfx.burn.dressed' },
  Cleansed: { id: 'sfx.salve.seal' },
  'Rot purged': { id: 'sfx.rot.purged' },
  Sealed: { id: 'sfx.salve.seal' },
  Stitched: { id: 'sfx.thread.knot', delay: 0.08 },
  Closed: { id: 'sfx.thread.knot', delay: 0.08 },
  Drained: { id: 'sfx.leech.slurp', covers: ['squelch'] },
  Antidote: { id: 'sfx.venom.neutralise', covers: ['inject'] },
  Plucked: { id: 'sfx.grub.plucked' },
  'Curse broken': { id: 'sfx.sigil.broken', covers: ['burn'] },
  'Cast out': { id: 'sfx.brand.quench', covers: ['burn'] },
  'It rejoined': { id: 'sfx.matins.rejoin' },
  Silenced: { id: 'sfx.lauds.silenced', covers: ['burn'] },
  Hatched: { id: 'sfx.eggsac.hatch' },
};

const TOOL_SELECT: Record<ToolId, EventId> = {
  lancet: 'sfx.tool.lancet',
  tongs: 'sfx.tool.tongs',
  leech: 'sfx.tool.leech',
  thread: 'sfx.tool.thread',
  salve: 'sfx.tool.salve',
  tincture: 'sfx.tool.tincture',
  brand: 'sfx.tool.brand',
  lens: 'sfx.tool.lens',
};

const TOOL_KEYS: Record<string, ToolId> = { Digit1: 'lancet', Digit2: 'tongs', Digit3: 'leech', Digit4: 'thread', Digit5: 'salve', Digit6: 'tincture', Digit7: 'brand', Digit8: 'lens' };

const peek = <T>(o: object, k: string): T | undefined => (o as Record<string, unknown>)[k] as T | undefined;

export class OperationAudio {
  op: Operation | null = null;
  /** Cues and popups published on the sim bus since the last audio frame (several fixed steps may run per frame). */
  private cueBuf: string[] = [];
  private popBuf: Popup[] = [];
  private framePopups: Popup[] = [];
  private unsub: (() => void)[] = [];
  private known = new Set<Entity>();
  private loops = new Map<Entity | string, LoopHandle | null>();
  private heart = new HeartbeatScheduler();
  private lastVitals = 99;
  private warned = new Map<number, number>();
  private warnedOnce = new Set<number>();
  private lastCombo = 0;
  private lastPhase = -1;
  private lastStatus = '';
  private lastCallout = '';
  private lastSecond = -1;
  private lowVitals = false;
  private tinnitus: LoopHandle | null = null;
  private litanyWas = 0;
  private endWarned = false;
  private trail: Vec[] = [];
  private corners = 0;
  private wasRight = false;
  private paused = false;
  private boss: HourId | null = null;
  private hexT = new Map<Entity, number>();
  private shardAge = 0;
  private shardWarned = false;
  private buboR = new Map<Entity, number>();
  private sigilStage = new Map<Entity, number>();
  private laudsState = new Map<Entity, { submerged: boolean; hymn: boolean; voices: number }>();
  private matinsOpen = new Map<Entity, boolean>();
  private cueSet = new Set<string>();
  private cooldownWas = 0;
  private moanT = 0;
  private voice = 0;
  private stitchCount = new Map<object, number>();
  /** 0..1 pulse for the visual heartbeat (AUD-0118), decays after each beat. */
  visualBeat = 0;
  /** Seconds until the next scheduled beat reaches the speakers (for the visual pulse). */
  private beatAt: number[] = [];

  constructor(private sys: AudioSystem) {}

  private get engine() {
    return this.sys.engine;
  }

  begin(op: Operation): void {
    this.end();
    this.op = op;
    this.unsub.push(
      op.events.on('cue', (c) => this.cueBuf.push(c)),
      op.events.on('popup', (p) => this.popBuf.push({ ...p, t: 0 })),
    );
    this.voice = patientVoice(op.def.patient, op.def.race);
    this.lastVitals = op.vitals;
    this.boss = null;
    this.heart.reset();
    const ch = op.def.id.startsWith('op2') ? 2 : 1;
    this.sys.music.setState('op-intro', { chapter: ch, hour: undefined, won: undefined });
    this.sys.amb.set('theatre');
    this.engine.snapshots.pop('results');
    this.engine.snapshots.pop('vn');
    this.engine.snapshots.pop('menu');
  }

  /** Stop everything this director owns (scene exit, restart). */
  end(): void {
    for (const h of this.loops.values()) this.engine.stopLoop(h, 60);
    this.loops.clear();
    this.engine.stopLoop(this.tinnitus, 200);
    this.tinnitus = null;
    this.known.clear();
    this.hexT.clear();
    this.buboR.clear();
    this.sigilStage.clear();
    this.laudsState.clear();
    this.matinsOpen.clear();
    this.stitchCount.clear();
    this.warned.clear();
    this.warnedOnce.clear();
    this.trail = [];
    this.corners = 0;
    this.lastPhase = -1;
    this.lastStatus = '';
    this.lastCallout = '';
    this.lastCombo = 0;
    this.lastSecond = -1;
    this.litanyWas = 0;
    this.endWarned = false;
    this.shardWarned = false;
    this.shardAge = 0;
    for (const s of ['litany', 'lowVitals', 'pause'] as const) this.engine.snapshots.pop(s);
    this.sys.music.setLitany(false);
    this.lowVitals = false;
    this.paused = false;
    for (const u of this.unsub) u();
    this.unsub = [];
    this.cueBuf = [];
    this.popBuf = [];
    this.framePopups = [];
    this.op = null;
  }

  private play(id: EventId, o: PlayOpts = {}): void {
    if (id.startsWith('sfx.patient.') && !this.engine.prefs.patientVox) return;
    this.sys.play(id, o);
  }

  private loop(key: Entity | string, id: EventId, want: boolean, params: Record<string, number> = {}, pan?: number, fadeMs = 40): LoopHandle | null {
    const cur = this.loops.get(key);
    if (!want) {
      if (cur !== undefined) {
        this.engine.stopLoop(cur, fadeMs);
        this.loops.delete(key);
      }
      return null;
    }
    if (cur && cur.alive) {
      for (const [k, v] of Object.entries(params)) this.engine.setParam(cur, k, v);
      if (pan !== undefined) this.engine.setLoopPan(cur, pan);
      return cur;
    }
    const h = this.engine.startLoop(id, params, { pan });
    // Remember a refused loop too (voice limit), so we don't retry every frame.
    this.loops.set(key, h);
    return h;
  }

  // ------------------------------------------------------------------ frame

  frame(f: OpFrame): void {
    const op = f.op;
    if (op !== this.op) this.begin(op);
    const eng = this.engine;
    const now = eng.now;

    // Pause: freeze world loops in place and dip the mix.
    if (f.paused !== this.paused) {
      this.paused = f.paused;
      eng.snapshots.set('pause', f.paused);
      this.play(f.paused ? 'ui.pauseOpen' : 'ui.pauseClose');
      if (f.paused) this.sys.vo.pause();
      else this.sys.vo.resume();
    }
    if (f.paused) {
      this.cueBuf = [];
      this.popBuf = [];
      return;
    }

    const newPopups = this.popBuf;
    this.popBuf = [];
    this.framePopups = newPopups;
    const covered = new Set<string>();
    const died = [...this.known].filter((e) => !e.alive || !op.entities.includes(e));
    const born = op.entities.filter((e) => !this.known.has(e));
    for (const e of died) this.known.delete(e);
    for (const e of born) this.known.add(e);

    this.popupEvents(op, newPopups, covered, died);
    this.spawnEvents(op, born, covered);
    this.cues(op, f, covered, died, newPopups);
    this.toolLoops(op, f);
    this.ailments(op, f.dt);
    this.bosses(op, f.dt);
    this.vitals(op, f);
    this.litany(op, f);
    this.timer(op);
    this.progress(op);
    this.mixState(op, f.dt);
    this.lastVitals = op.vitals;
    void now;
  }

  // ------------------------------------------------------------------ cues

  private cues(op: Operation, f: OpFrame, covered: Set<string>, died: Entity[], popups: Popup[]): void {
    const played = new Set<string>();
    const frameCues = this.cueBuf;
    this.cueBuf = [];
    this.cueSet = new Set(frameCues);
    const tier = op.combo >= 20 ? 3 : op.combo >= 10 ? 2 : op.combo >= 5 ? 1 : 0;
    for (const c of frameCues) {
      if (played.has(c) || covered.has(c)) continue;
      played.add(c);
      const pos = f.input.pos;
      const pan = panOf(pos.x);
      switch (c) {
        case 'cool':
        case 'good':
        case 'bad':
        case 'miss': {
          const rp = popups.find((p) => p.rating === c);
          // A reveal pushes 'good' with no rating popup: that's the lens find.
          if (c === 'good' && !rp) {
            if (popups.some((p) => p.text === 'Found it!')) this.play('sfx.lauds.surface', { pan });
            else this.play('sfx.lens.found', { pan });
            break;
          }
          const at = this.engine.now + 0.04;
          this.play(`sfx.rate.${c}` as EventId, { at, pan: rp ? panOf(rp.pos.x) * 0.5 : 0, params: { tier: c === 'cool' || c === 'good' ? tier : 0 } });
          if ((c === 'bad' || c === 'miss') && rp && op.vitals < this.lastVitals - 2.5) this.play('sfx.patient.pain', { pan, params: { voice: this.voice } });
          break;
        }
        case 'cut':
          if (op.tool === 'lancet' && f.input.pressed) {
            this.play('sfx.lancet.touch', { pan });
            if (popups.some((p) => p.rating === 'miss')) this.play('sfx.lancet.air', { pan });
          } else this.play('sfx.lancet.cut', { pan });
          break;
        case 'squelch': {
          const sac = died.find((e) => e instanceof EggSac);
          if (sac) this.play('sfx.eggsac.lance', { pan: panOf(sac.pos.x) });
          else if (popups.some((p) => p.label === 'Lanced')) this.play('sfx.bubo.lance', { pan });
          else if (op.tool === 'leech') this.play('sfx.leech.slurp', { pan });
          else this.play('sfx.lancet.open', { pan });
          break;
        }
        case 'pluck': {
          const near = op.entities.find((e) => e.alive && dist(e.pos, pos) < 40 && (e instanceof Embedded || e instanceof Grub || e instanceof MalisonShard));
          this.play(near instanceof Embedded ? 'sfx.tongs.grabHard' : 'sfx.tongs.grabFlesh', { pan });
          break;
        }
        case 'burn': {
          const seared = died.find((e) => e instanceof Grub || e instanceof SpiderlingGrub);
          if (seared) this.play(seared instanceof SpiderlingGrub ? 'sfx.spider.seared' : 'sfx.grub.seared', { pan: panOf(seared.pos.x) });
          else if (op.entities.some((e) => (e instanceof Malison && e.open && dist(e.pos, pos) < e.radius) || (e instanceof LaudsMalison && dist(e.pos, pos) < e.radius))) this.play('sfx.matins.shriek', { pan });
          // Otherwise: brand contact — carried by the sizzle loop.
          break;
        }
        case 'inject':
          this.play('sfx.tincture.done', { pan });
          break;
        case 'stitch': {
          const step = this.stitchStep(op, pos);
          this.play('sfx.thread.pierce', { pan, params: { step } });
          this.play('sfx.thread.zip', { pan, at: this.engine.now + 0.06 });
          break;
        }
        case 'select':
          this.play(TOOL_SELECT[op.tool]);
          break;
        case 'litany':
          this.play('sfx.litany.invoke');
          break;
        case 'flatline':
          this.play('sfx.death.knell');
          this.play('sfx.patient.death', { params: { voice: this.voice } });
          if (op.timeLeft <= 0) this.play('sfx.timer.up');
          break;
        case 'bell':
          // Victory is carried by the music; the Malison's end has its own set (label events).
          break;
        case 'heartbeat':
        case 'alarm':
          break;
        default:
          if (isEventId(c)) this.play(c, { pan });
          else this.sys.play(c);
      }
    }
  }

  /** Semitone step along the wound being stitched (+1 per stitch, capped at 12). */
  private stitchStep(op: Operation, pos: Vec): number {
    let best: { line: object; count: number; d: number } | null = null;
    for (const e of op.entities) {
      const line = e instanceof Laceration ? e.stitch : e instanceof Incision ? e.stitch : null;
      if (!line || !line.marks.length) continue;
      const d = dist(line.marks[line.marks.length - 1], pos);
      if (!best || d < best.d) best = { line, count: line.count, d };
    }
    return Math.min(12, Math.max(0, (best?.count ?? 1) - 1));
  }

  private popupEvents(op: Operation, popups: Popup[], covered: Set<string>, died: Entity[]): void {
    for (const p of popups) {
      const pan = panOf(p.pos.x);
      if (p.rating && p.label) {
        const ev = LABEL_EVENTS[p.label];
        if (ev) {
          this.play(ev.id, { pan, at: ev.delay ? this.engine.now + ev.delay : undefined, params: p.label === 'Silenced' ? { note: this.voiceNote(died) } : undefined });
          for (const c of ev.covers ?? []) covered.add(c);
          if (ev.id.startsWith('sfx.extract.') || p.label === 'Plucked') this.play('sfx.tongs.dish', { pan, at: this.engine.now + 0.3 });
          if (p.label === 'Torn') this.play('sfx.patient.pain', { pan, params: { voice: this.voice } });
          continue;
        }
        if (p.label === 'Seared') {
          const s = died.find((e) => e instanceof SpiderlingGrub);
          this.play(s ? 'sfx.spider.seared' : 'sfx.grub.seared', { pan });
          covered.add('burn');
        } else if (p.label === 'Lanced') {
          this.play(died.some((e) => e instanceof EggSac) ? 'sfx.eggsac.lance' : 'sfx.bubo.lance', { pan });
          covered.add('squelch');
        } else if (p.label === 'Wounded') {
          if (op.entities.some((e) => e instanceof LaudsMalison && e.submerged)) this.play('sfx.lauds.submerge', { pan });
          else this.play('sfx.matins.shed', { pan });
        } else if (p.label === 'Malison unmade') {
          const lauds = died.some((e) => e instanceof LaudsMalison);
          this.play(lauds ? 'sfx.lauds.shatter' : 'sfx.malison.unmade', { pan });
          if (lauds) this.play('sfx.lauds.death', { pan, at: this.engine.now + 0.2 });
          else this.play('sfx.matins.split', { pan, at: this.engine.now + 0.15 });
          covered.add('burn');
        }
        continue;
      }
      // Plain popups: world events without a rating.
      const text = p.text;
      if (text === 'It burst!') this.play('sfx.bubo.burst', { pan });
      else if (text === 'The curse lashes out!') this.play('sfx.sigil.lash', { pan });
      else if (text === 'Found!') {
        this.play('sfx.lens.found', { pan });
        covered.add('good');
      } else if (text === 'Found it!') {
        this.play('sfx.lauds.surface', { pan });
        covered.add('good');
      } else if (text === 'The sign falters…') this.play('sfx.litany.fizzle');
      else if (text === 'The Litany is spent.' || text === 'Not now.') this.play('sfx.litany.spent');
      else if (/^-\d+$/.test(text)) {
        const amount = Number(text.slice(1));
        if (amount >= 5) this.play('sfx.vitals.hurt', { pan, params: { amount } });
      } else if (/^\+\d+$/.test(text)) this.play('sfx.vitals.heal', { params: { amount: Number(text.slice(1)) } });
    }
  }

  private voiceNote(died: Entity[]): number {
    const v = died.find((e) => e instanceof ChoirVoice);
    return v ? [0, 4, 7, 11, 14, 16][v.id % 6] : 0;
  }

  private spawnEvents(op: Operation, born: Entity[], covered: Set<string>): void {
    const found = op.entities.find((e) => (e instanceof Malison || e instanceof LaudsMalison) && e.alive);
    // Only a Malison already on the field can rend or sing new wounds open.
    const malison = found && !born.includes(found) ? found : undefined;
    for (const e of born) {
      if (e instanceof Laceration && malison) {
        if (malison instanceof LaudsMalison) {
          if (malison.hymnR >= 0) this.play('sfx.lauds.hymnBlast', { pan: panOf(e.pos.x) });
        } else if (dist(e.pos, malison.pos) < 90) {
          this.play('sfx.malison.rend', { pan: panOf(e.pos.x) });
          covered.add('cut');
          covered.add('sfx.malison.rend');
        }
      }
      if (e instanceof Grub && !(e instanceof SpiderlingGrub) && malison) this.play('sfx.grub.burrow', { pan: panOf(e.pos.x) });
      if (e instanceof MalisonShard) {
        this.shardAge = 0;
        this.shardWarned = false;
      }
      if (e instanceof ChoirVoice) {
        const st = this.laudsState.get(e.core);
        if (st && st.voices === 0 && !st.submerged) this.play('sfx.lauds.recall', { pan: panOf(e.core.pos.x) });
      }
    }
  }

  // ------------------------------------------------------------------ held tools

  private toolLoops(op: Operation, f: OpFrame): void {
    const { input } = f;
    const pos = input.pos;
    const pan = panOf(pos.x);
    const running = op.status === 'running';
    const speed = f.dt > 0 ? dist(pos, this.prevPos ?? pos) / f.dt : 0;
    this.prevPos = { ...pos };

    // Tool changes that the sim didn't voice (e.g. unavailable hotkey).
    for (const [code, tool] of Object.entries(TOOL_KEYS)) if (f.keyPressed(code) && !op.def.tools.includes(tool)) this.play('sfx.tool.deny');

    // Lancet: cutting loop while tracing an incision.
    const cutting = running && op.tool === 'lancet' && input.down && op.entities.some((e) => e instanceof Incision && e.state === 'mark' && e.project(pos).d < 34 && e.progress > 0);
    this.loop('lancet', 'loop.lancet.cut', cutting, { speed: Math.min(1, speed / 700) }, pan, 40);

    // Tongs: click on press/release; strain loop while pulling an object.
    if (running && op.tool === 'tongs' && (input.pressed || input.released) && onBody(pos)) this.play('sfx.tongs.click', { pan });
    const held = running && op.tool === 'tongs' && input.down ? op.entities.find((e): e is Embedded => e instanceof Embedded && e.grabbed) : undefined;
    this.loop('tongs', 'loop.tongs.strain', !!held, held ? { dist: Math.min(1, dist(held.pos, held.origin) / 70) } : {}, pan, 40);

    // Leech-pipe: suction over a pool.
    const pool = running && op.tool === 'leech' && input.down ? op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.alive && dist(pos, e.pos) < e.r + 10) : undefined;
    const ichor = pool ? (pool.ichor === 'blood' ? 0 : pool.ichor === 'pus' ? 1 : 2) : 0;
    if (pool && this.loops.get('leech') && this.leechIchor !== ichor) this.loop('leech', 'loop.leech.suck', false);
    this.leechIchor = ichor;
    this.loop('leech', 'loop.leech.suck', !!pool, pool ? { intensity: Math.min(1, pool.r / 60), ichor } : {}, pan, 40);

    // Salve: smear while brushing a salvable wound.
    const salving = running && op.tool === 'salve' && input.down && op.entities.some((e) => (e instanceof Rot || e instanceof Burn || (e instanceof Bubo && e.lanced) || (e instanceof Laceration && e.small)) && dist(e.pos, pos) < 70);
    if (running && op.tool === 'salve' && input.pressed && onBody(pos)) this.play('sfx.salve.lid', { pan, vol: 0.6 });
    this.loop('salve', 'loop.salve.smear', salving, { gate: Math.min(1, speed / 350) }, pan, 40);

    // Tincture: plunger while injecting; ready tick when the cooldown ends.
    const venomHold = op.tool === 'tincture' && input.down ? op.entities.find((e) => e instanceof Venom && dist(e.pos, pos) < 30) : undefined;
    const injecting = running && (op.injectT > 0 || !!venomHold);
    if (injecting && !this.loops.get('tincture')) this.play('sfx.tincture.clink', { pan, vol: 0.7 });
    this.loop('tincture', 'loop.tincture.plunge', injecting, { progress: op.injectT > 0 ? op.injectT / TINCTURE_TIME : Math.min(1, (peek<number>(venomHold ?? {}, 'holdT') ?? 0) / 0.9) }, pan, 40);
    if (this.cooldownWas > 0 && op.injectCooldown === 0 && op.def.tools.includes('tincture')) this.play('sfx.tincture.ready');
    this.cooldownWas = op.injectCooldown;

    // Cautery brand: ember hum in hand, sizzle on contact, quench on release.
    this.loop('ember', 'loop.brand.ember', running && op.tool === 'brand', {}, pan, 120);
    const branding = running && op.tool === 'brand' && input.down && onBody(pos);
    let material = 0;
    if (branding) {
      for (const e of op.entities) {
        if (!e.alive || e.hidden) continue;
        if ((e instanceof Malison || e instanceof LaudsMalison) && dist(e.pos, pos) < e.radius) material = 3;
        else if (e instanceof ChoirVoice && dist(e.pos, pos) < 22) material = 3;
        else if (e instanceof Sigil && e.segs.some((s) => distToSeg(pos, s.a, s.b) < 14)) material = Math.max(material, 2);
        else if (e instanceof Grub && dist(e.pos, pos) < 20) material = Math.max(material, 1);
      }
    }
    if (branding && this.loops.get('sizzle') && this.sizzleMat !== material) this.loop('sizzle', 'loop.brand.sizzle', false, {}, pan, 30);
    this.sizzleMat = material;
    const wasSizzling = !!this.loops.get('sizzle');
    this.loop('sizzle', 'loop.brand.sizzle', branding, { material }, pan, 40);
    if (wasSizzling && !branding) this.play('sfx.brand.quench', { pan, vol: 0.7 });

    // Scrying lens: hum while in hand, shimmer rising near hidden things.
    let prox = 0;
    if (op.tool === 'lens') for (const e of op.entities) if (e.alive && e.hidden) prox = Math.max(prox, 1 - dist(e.pos, pos) / 110);
    this.loop('lens', 'loop.lens.hum', running && op.tool === 'lens', { prox: Math.max(0, prox) }, pan, 120);

    // Blood flooding the wound under the thread.
    if (running && op.tool === 'thread' && input.down) {
      const flooded = op.entities.some((e) => e instanceof Laceration && distToSeg(pos, e.a, e.b) < 40 && op.entities.some((p) => p instanceof BloodPool && p.alive && p.r > 30 && dist(p.pos, e.pos) < p.r * 0.8));
      if (flooded) this.play('sfx.blood.flooded', { pan });
    }
  }
  private prevPos: Vec | null = null;
  private leechIchor = 0;
  private sizzleMat = 0;

  // ------------------------------------------------------------------ ailments

  private ailments(op: Operation, dt: number): void {
    const wdt = dt * op.timeScale;
    const live = new Set<Entity>(op.entities.filter((e) => e.alive));
    const running = op.status === 'running' || op.status === 'intro';
    // Per-entity loops: stop for anything gone.
    for (const [k, h] of this.loops) if (typeof k !== 'string' && !live.has(k)) {
      this.engine.stopLoop(h, 80);
      this.loops.delete(k);
    }
    // Bleeding trickle: one bed for all open lacerations.
    let bleed = 0;
    for (const e of live) if (e instanceof Laceration && !e.hidden) bleed += e.drain(op);
    this.loop('bleed', 'loop.bleed.trickle', running && bleed > 0, { severity: Math.min(1, bleed / 2) }, 0, 400);

    const burns = new Set<number>();
    let rot = 0;
    let grubs = 0;
    let spiders = 0;
    for (const e of live) {
      if (e.hidden) continue;
      const pan = panOf(e.pos.x);
      if (e instanceof Burn) burns.add(e.source === 'fire' ? 0 : e.source === 'acid' ? 1 : 2);
      else if (e instanceof Rot) rot++;
      else if (e instanceof Venom) this.loop(e, 'loop.venom.hiss', true, { spread: Math.min(1, (e.spreadR - 16) / 104) }, pan);
      else if (e instanceof SpiderlingGrub) {
        if (spiders++ < 4) this.loop(e, 'loop.spider.skitter', true, {}, pan);
      } else if (e instanceof Grub) {
        if (grubs++ < 3) this.loop(e, 'loop.grub.chitter', true, {}, pan);
      } else if (e instanceof Sigil) {
        this.loop(e, 'loop.sigil.whisper', true, {}, pan);
        const stage = Math.floor(e.progress * 4);
        const was = this.sigilStage.get(e) ?? 0;
        if (stage > was && stage < 4) this.play('sfx.sigil.crack', { pan });
        this.sigilStage.set(e, stage);
      } else if (e instanceof EggSac) {
        const hatchT = peek<number>(e, 'hatchT') ?? 18;
        this.loop(e, 'loop.eggsac.pulse', true, { urgency: Math.max(0, Math.min(1, 1 - hatchT / 18)) }, pan);
      } else if (e instanceof Bubo && !e.lanced) {
        const r0 = this.buboR.get(e) ?? e.r;
        if (e.r - r0 >= 3) {
          this.play('sfx.bubo.creak', { pan });
          this.buboR.set(e, e.r);
        } else if (!this.buboR.has(e)) this.buboR.set(e, e.r);
      } else if (e instanceof Embedded && e.kind === 'hexstone' && !e.grabbed) {
        const t = (this.hexT.get(e) ?? 3) + wdt;
        if (t >= 7) {
          this.play('sfx.hexstone.pulse', { pan });
          this.hexT.set(e, 0);
        } else this.hexT.set(e, t);
      }
    }
    for (const src of [0, 1, 2]) this.loop(`burn${src}`, 'loop.burn.bed', running && burns.has(src), { source: src }, 0, 600);
    this.loop('rot', 'loop.rot.creep', running && rot > 0, {}, 0, 600);

    // Pools growing: drips (rate-limited by the event's voice limit and a short gap).
    this.dripT -= dt;
    for (const e of live) {
      if (!(e instanceof BloodPool) || e.ichor !== 'blood') continue;
      const r0 = this.poolR.get(e) ?? e.r;
      if (e.r > r0 + 0.5 && this.dripT <= 0) {
        this.play('sfx.blood.drip', { pan: panOf(e.pos.x), vol: 0.7 });
        this.dripT = 0.35 + Math.random() * 0.4;
      }
      this.poolR.set(e, e.r);
    }

    // Triage by ear: the entity draining the most vitals gets a subtly louder loop.
    let worst: Entity | null = null;
    let worstDrain = 0;
    for (const e of live) {
      if (e.hidden) continue;
      const d = e.drain(op);
      if (d > worstDrain) {
        worstDrain = d;
        worst = e;
      }
    }
    const loud = worst instanceof Laceration ? 'bleed' : worst;
    for (const [k, h] of this.loops) {
      // Only ailment loops (per-entity, and the shared bleed bed); tool loops keep their level.
      if (!h || (typeof k === 'string' && k !== 'bleed')) continue;
      this.engine.setLoopGain(h, k === loud ? 1.5 : 1, 0.3);
    }
  }
  private dripT = 0;
  private poolR = new Map<Entity, number>();

  // ------------------------------------------------------------------ bosses

  private chapelT = 0;

  private bosses(op: Operation, dt: number): void {
    const wdt = dt * op.timeScale;
    if (this.chapelT > 0) {
      this.chapelT -= dt;
      if (this.chapelT <= 0) this.engine.setSpace('theatre');
    }
    const matins = op.entities.find((e): e is Malison => e instanceof Malison && e.alive);
    const lauds = op.entities.find((e): e is LaudsMalison => e instanceof LaudsMalison && e.alive);
    const shards = op.entities.filter((e) => e instanceof MalisonShard && e.alive);
    const hour: HourId | null = matins ? ((matins.hour as HourId) ?? 'matins') : lauds ? 'lauds' : shards.length ? 'matins' : null;
    if (hour && hour !== this.boss) {
      this.boss = hour;
      this.sys.music.setState('boss', { hour });
      this.sys.music.stinger('bossReveal');
      // The hour bell rings through the chapel, then the theatre returns.
      this.engine.setSpace('chapel');
      this.play(`sfx.bell.${hour}` as EventId);
      this.chapelT = hour === 'none' ? 15 : 7;
    }

    if (matins) {
      const was = this.matinsOpen.get(matins) ?? false;
      if (matins.open && !was) this.play('sfx.matins.shroud', { pan: panOf(matins.pos.x) });
      this.matinsOpen.set(matins, matins.open);
      this.loop(matins, 'loop.matins.drone', true, { open: matins.open ? 1 : 0 }, panOf(matins.pos.x), 800);
      this.sys.music.setSection(matins.open ? 'open' : 'veiled');
    }
    if (shards.length) {
      this.sys.music.setSection('shards');
      this.shardAge += wdt;
      if (this.shardAge >= 7 && !this.shardWarned) {
        this.shardWarned = true;
        this.play('sfx.matins.rejoinWarn', { pan: panOf(shards[0].pos.x) });
      }
    }
    if (lauds) {
      const st = this.laudsState.get(lauds) ?? { submerged: false, hymn: false, voices: lauds.livingVoices.length };
      const hymn = lauds.hymnR >= 0;
      if (hymn && !st.hymn && !this.cueSet.has('sfx.lauds.hymn')) this.play('sfx.lauds.hymn', { pan: panOf(lauds.pos.x) });
      if (lauds.submerged && !st.submerged && !this.framePopups.some((p) => p.label === 'Wounded')) this.play('sfx.lauds.submerge', { pan: panOf(lauds.pos.x) });
      st.hymn = hymn;
      st.submerged = lauds.submerged;
      st.voices = lauds.livingVoices.length;
      this.laudsState.set(lauds, st);
      this.sys.music.setSection(lauds.submerged ? 'submerged' : lauds.livingVoices.length ? 'choir' : 'exposed');
      for (const v of lauds.livingVoices) {
        this.loop(v, 'loop.lauds.voice', !lauds.submerged, { note: [0, 4, 7, 11, 14, 16][v.id % 6], silence: Math.min(1, v.silence / 1.2) }, panOf(v.pos.x), 60);
      }
    } else if (this.boss === 'lauds' && op.entities.some((e) => e instanceof Embedded && e.kind === 'hexstone')) this.sys.music.setSection('shattered');
  }

  // ------------------------------------------------------------------ vitals & heartbeat

  private vitals(op: Operation, f: OpFrame): void {
    const eng = this.engine;
    const prefs = eng.prefs;
    const v = op.vitals;
    const running = op.status === 'running';
    // Crossing alarms: period hand-bells, rate-limited to once per 5 s.
    if (running)
      for (const th of [60, 30, 15]) {
        if (this.lastVitals >= th && v < th) {
          const last = this.warned.get(th) ?? -99;
          const t = eng.captions.now;
          if (t - last >= 5 && !(prefs.reduceStress && this.warnedOnce.has(th))) {
            this.play(th === 60 ? 'sfx.vitals.warn60' : th === 30 ? 'sfx.vitals.warn30' : 'sfx.vitals.warn15');
            this.warned.set(th, t);
            this.warnedOnce.add(th);
          }
        }
      }
    // Moans while the patient suffers.
    this.moanT -= f.dt;
    if (running && v < 40 && this.moanT <= 0) {
      this.moanT = 7 + Math.random() * 6;
      this.play('sfx.patient.moan', { params: { voice: this.voice }, vol: 0.7 });
    }
    // Heartbeat: scheduled on the audio clock at the QRS spike.
    const mode = prefs.heartbeat;
    const bpmEff = f.bpm * op.timeScale;
    const beat = this.heart.update(f.beatPhase, bpmEff, eng.now);
    const audible = running && mode !== 'off' && (mode === 'always' || v < 45);
    if (beat && running) {
      const skip = v < 25 && Math.random() < 0.12;
      if (audible && !skip) {
        const p = heartParams(v, bpmEff);
        this.play('sfx.heart.beat', { at: beat.at, params: p, vol: mode === 'always' && v >= 45 ? 0.5 : 1, noCaption: v >= 45 });
        if (v < 30 || prefs.pulseTick) this.play('sfx.heart.pulseTick', { at: beat.at });
      }
      this.beatAt.push(beat.at);
    }
    // Visual heartbeat when the thump can't be heard.
    const muted = prefs.muted || prefs.sfx === 0 || prefs.master === 0 || mode === 'off' || !eng.ready;
    this.visualBeat = Math.max(0, this.visualBeat - f.dt * 4);
    while (this.beatAt.length && this.beatAt[0] <= eng.now + 0.005) {
      this.beatAt.shift();
      if (muted && running && v < 45) this.visualBeat = 1;
    }
    if (!eng.ready && running && v < 45 && f.beatPhase < 0.21 && f.beatPhase + (f.dt * bpmEff) / 60 >= 0.21) this.visualBeat = 1;
  }

  // ------------------------------------------------------------------ Litany

  private litany(op: Operation, f: OpFrame): void {
    const eng = this.engine;
    const { input } = f;
    // Star drawing: shimmering trail, a pentatonic step per vertex.
    if (input.rightDown) {
      // The first point is the first vertex; each sharp corner is the next (five for a star).
      if (!this.wasRight && op.status === 'running') this.play('sfx.litany.vertex', { params: { step: 0 } });
      this.trail.push({ ...input.pos });
      const c = Math.min(4, countCorners(this.trail));
      if (c > this.corners) this.play('sfx.litany.vertex', { params: { step: c } });
      this.corners = c;
    } else if (this.wasRight) {
      this.trail = [];
      this.corners = 0;
    }
    this.wasRight = input.rightDown;
    this.loop('trail', 'loop.litany.trail', input.rightDown && op.status === 'running', {}, panOf(input.pos.x), 50);

    const lt = op.litanyTime;
    if (lt > 0 && this.litanyWas <= 0) {
      eng.snapshots.push('litany');
      this.sys.music.setLitany(true);
      this.endWarned = false;
    }
    if (lt > 0 && lt <= 1.5 && !this.endWarned && this.litanyWas > 1.5) {
      this.endWarned = true;
      this.play('sfx.litany.endWarn');
      this.sys.music.litanyEnding();
    }
    if (lt <= 0 && this.litanyWas > 0) {
      eng.snapshots.pop('litany');
      this.sys.music.setLitany(false);
      this.play('sfx.litany.exhale');
    }
    this.litanyWas = lt;
    void LITANY_DURATION;
  }

  // ------------------------------------------------------------------ clock

  private timer(op: Operation): void {
    if (op.status !== 'running' || op.litanyTime > 0) return;
    const sec = Math.ceil(op.timeLeft);
    if (sec !== this.lastSecond) {
      const early = this.engine.prefs.timerTicksEarly;
      if (this.lastSecond !== -1 && sec < this.lastSecond) {
        if (sec <= 10 && sec > 0) this.play('sfx.timer.tick');
        else if (early && sec <= 30 && sec > 10) this.play('sfx.timer.tick', { vol: 0.45 });
      }
      this.lastSecond = sec;
    }
  }

  // ------------------------------------------------------------------ phases, combos, outcome

  private progress(op: Operation): void {
    if (op.phase !== this.lastPhase) {
      if (this.lastPhase >= 0 && op.status === 'running') {
        if (this.sys.music.track) this.sys.music.stinger('phaseClear');
        else this.play('sfx.phase.clear');
      }
      this.lastPhase = op.phase;
    }
    for (const tier of [5, 10, 20]) if (this.lastCombo < tier && op.combo >= tier) this.play('sfx.combo.tier', { params: { tier: tier === 5 ? 1 : tier === 10 ? 2 : 3 }, at: this.engine.now + 0.12 });
    if (this.lastCombo >= 5 && op.combo === 0) this.play('sfx.combo.break');
    this.lastCombo = op.combo;

    // Barks duck the music and ambience while the line is on screen (and voiced when recorded).
    const line = op.callouts[0] ?? '';
    const hold = Math.max(2.4, line.length * 0.055);
    if (line && line !== this.lastCallout) {
      const urgent = /!/.test(line);
      this.sys.vo.bark(line, hold, urgent);
    }
    // When the line is voiced, keep its panel up until the voice finishes.
    const left = line ? this.sys.vo.remaining() : 0;
    if (left > 0 && op.calloutT > hold - left - 0.1) op.calloutT = Math.max(0, hold - left - 0.1);
    this.lastCallout = line;

    if (op.status !== this.lastStatus) {
      if (op.status === 'running' && this.lastStatus === 'intro') {
        if (!this.boss) this.sys.music.setState('operation');
      } else if (op.status === 'won') {
        this.sys.music.setState('victory', { won: true });
        this.play('sfx.patient.relief', { params: { voice: this.voice }, at: this.engine.now + 0.8 });
      } else if (op.status === 'lost') this.sys.music.setState('failure', { won: false });
      this.lastStatus = op.status;
    }
  }

  // ------------------------------------------------------------------ mix

  private mixState(op: Operation, dt: number): void {
    const eng = this.engine;
    const v = op.vitals;
    const running = op.status === 'running';
    // Music layers from vitals, the clock and the chain.
    const tension = running ? Math.max(0, Math.min(1, (60 - v) / 30)) : 0;
    const danger = running ? Math.max(0, Math.min(1, (30 - v) / 15)) : 0;
    const m = this.sys.music;
    if (running) {
      m.setLayer('tension', tension);
      m.setLayer('danger', danger);
      m.setLayer('clock', op.timeLeft < 30 ? 1 : 0);
      m.setLayer('flow', op.combo >= 10 ? 1 : 0);
    }
    // Low vitals: shelf cut + tinnitus, with hysteresis; off under "reduce audio stress".
    const stress = !eng.prefs.reduceStress;
    if (!this.lowVitals && running && v < 30 && stress) this.lowVitals = true;
    else if (this.lowVitals && (v > 35 || !running || !stress)) this.lowVitals = false;
    eng.snapshots.set('lowVitals', this.lowVitals);
    if (this.lowVitals && !this.tinnitus) this.tinnitus = eng.startLoop('loop.tinnitus', {}, { fadeIn: 3 });
    else if (!this.lowVitals && this.tinnitus) {
      eng.stopLoop(this.tinnitus, 1500);
      this.tinnitus = null;
    }
    // Theatre bed ducks as tension rises; the curse bed follows corruption.
    this.sys.amb.setBedGain(dbToGain(-6 * Math.max(tension, danger)));
    const cursed = op.entities.some((e) => e instanceof Malison || e instanceof MalisonShard || e instanceof LaudsMalison) ? 0.7 : op.entities.some((e) => e instanceof Sigil) ? 0.25 : 0;
    this.sys.amb.setCurse(running ? cursed : 0, dt);
  }
}

function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
