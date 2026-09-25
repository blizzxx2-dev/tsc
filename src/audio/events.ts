/**
 * Audio events: the single table every sound in the game is played through.
 * The simulation pushes event ids into `op.cues`; scenes call `audio.play(id)`.
 * Each id names a designed sound (synthesised recipe in `sfx.ts`, or a recorded
 * asset from the manifest when one is mapped), with its bus, variation, voice
 * limit, priority, ducking and caption.
 */

export type BusId = 'music' | 'world' | 'hud' | 'ui' | 'vo' | 'ambience';

/** What a sound ducks when it plays (see DUCKING in mixer.ts). */
export type DuckKind = 'bark' | 'sting' | 'boss' | 'knell';

export interface EventDef {
  bus: BusId;
  /** Base level in dB (0 = recipe level). */
  db?: number;
  /** Number of variations (no immediate repeat). Default 4. */
  vars?: number;
  /** ± random pitch in cents. */
  cents?: number;
  /** ± random gain in dB. */
  jitterDb?: number;
  /** Max simultaneous voices of this event. */
  limit?: number;
  /** 0..100; higher survives stealing. */
  prio?: number;
  /** Closed caption shown when captions are on. */
  caption?: string;
  duck?: DuckKind;
  /** A looped event, started with startLoop(). */
  loop?: boolean;
  /** Minimum seconds between plays. */
  cooldown?: number;
  /** Relevant to play (telegraphs, alarms, state): must have a visual counterpart. */
  gameplay?: boolean;
  /** Legacy cue that resolves to a designed event. */
  alias?: string;
  /** Recorded asset keys (manifest) that replace the recipe when loaded. */
  assets?: readonly string[];
}

const E = <T extends Record<string, EventDef>>(t: T): T => t;

export const EVENTS = E({
  // ------------------------------------------------ legacy cue names (pre-AUD-0007), kept as aliases
  cool: { bus: 'hud', alias: 'sfx.rate.cool' },
  good: { bus: 'hud', alias: 'sfx.rate.good' },
  bad: { bus: 'hud', alias: 'sfx.rate.bad' },
  miss: { bus: 'hud', alias: 'sfx.rate.miss' },
  cut: { bus: 'world', alias: 'sfx.lancet.cut' },
  stitch: { bus: 'world', alias: 'sfx.thread.pierce' },
  squelch: { bus: 'world', alias: 'sfx.lancet.open' },
  pluck: { bus: 'world', alias: 'sfx.tongs.grabFlesh' },
  burn: { bus: 'world', alias: 'sfx.burn.crack' },
  inject: { bus: 'world', alias: 'sfx.tincture.done' },
  heartbeat: { bus: 'world', alias: 'sfx.heart.beat' },
  flatline: { bus: 'hud', alias: 'sfx.death.knell' },
  litany: { bus: 'hud', alias: 'sfx.litany.invoke' },
  bell: { bus: 'hud', alias: 'sfx.malison.unmade' },
  select: { bus: 'ui', alias: 'ui.tab' },
  alarm: { bus: 'hud', alias: 'sfx.vitals.warn30' },

  // ------------------------------------------------ Lancet
  'sfx.lancet.touch': { bus: 'world', limit: 2, prio: 30, cents: 60 },
  'sfx.lancet.cut': { bus: 'world', limit: 3, prio: 50, cents: 80, jitterDb: 1.5 },
  'sfx.lancet.open': { bus: 'world', limit: 2, prio: 60, cents: 60, caption: '[Flesh parts wetly]' },
  'sfx.lancet.slip': { bus: 'world', limit: 2, prio: 55, cents: 50, caption: '[The lancet slips]', gameplay: true },
  'sfx.lancet.air': { bus: 'world', limit: 2, prio: 40, cents: 100 },
  'sfx.lancet.nick': { bus: 'world', limit: 2, prio: 55, cents: 60 },
  'loop.lancet.cut': { bus: 'world', loop: true, prio: 45 },
  // ------------------------------------------------ Tongs
  'sfx.tongs.click': { bus: 'world', limit: 2, prio: 20, cents: 80 },
  'sfx.tongs.grabFlesh': { bus: 'world', limit: 2, prio: 45, cents: 70 },
  'sfx.tongs.grabHard': { bus: 'world', limit: 2, prio: 45, cents: 70 },
  'loop.tongs.strain': { bus: 'world', loop: true, prio: 40 },
  'sfx.extract.arrow': { bus: 'world', limit: 2, prio: 70, cents: 60, caption: '[Arrow wrenched free]' },
  'sfx.extract.bolt': { bus: 'world', limit: 2, prio: 70, cents: 60, caption: '[Bolt wrenched free]' },
  'sfx.extract.shot': { bus: 'world', limit: 2, prio: 70, cents: 60, caption: '[Lead shot pops free]' },
  'sfx.extract.tooth': { bus: 'world', limit: 2, prio: 70, cents: 60, caption: '[Fang scrapes free]' },
  'sfx.extract.glass': { bus: 'world', limit: 2, prio: 70, cents: 60, caption: '[Glass tinkles free]' },
  'sfx.extract.shard': { bus: 'world', limit: 2, prio: 70, cents: 60 },
  'sfx.extract.hexstone': { bus: 'world', limit: 2, prio: 75, cents: 30, caption: '[Hexstone chimes as it tears free]' },
  'sfx.tongs.dish': { bus: 'world', limit: 2, prio: 30, cents: 80 },
  // ------------------------------------------------ Leech-Pipe
  'loop.leech.suck': { bus: 'world', loop: true, prio: 45 },
  'sfx.leech.slurp': { bus: 'world', limit: 3, prio: 50, cents: 80 },
  // ------------------------------------------------ Gut Thread
  'sfx.thread.pierce': { bus: 'world', limit: 4, prio: 50, cents: 20 },
  'sfx.thread.zip': { bus: 'world', limit: 3, prio: 30, cents: 80 },
  'sfx.thread.knot': { bus: 'world', limit: 2, prio: 60, cents: 40, caption: '[Thread knotted]' },
  // ------------------------------------------------ Saint's Salve
  'sfx.salve.lid': { bus: 'world', limit: 1, prio: 20, cents: 60 },
  'loop.salve.smear': { bus: 'world', loop: true, prio: 35 },
  'sfx.salve.seal': { bus: 'world', limit: 2, prio: 55, cents: 30 },
  // ------------------------------------------------ Tincture
  'sfx.tincture.clink': { bus: 'world', limit: 1, prio: 20, cents: 60 },
  'loop.tincture.plunge': { bus: 'world', loop: true, prio: 45 },
  'sfx.tincture.done': { bus: 'world', limit: 2, prio: 65, cents: 20, caption: '[Tincture takes hold]' },
  'sfx.tincture.ready': { bus: 'hud', limit: 1, prio: 25, caption: '[Tincture ready]', gameplay: true },
  // ------------------------------------------------ Cautery Brand
  'loop.brand.ember': { bus: 'world', loop: true, prio: 20 },
  'loop.brand.sizzle': { bus: 'world', loop: true, prio: 50 },
  'sfx.brand.quench': { bus: 'world', limit: 2, prio: 35, cents: 80 },
  // ------------------------------------------------ Scrying Lens
  'loop.lens.hum': { bus: 'world', loop: true, prio: 30 },
  'sfx.lens.found': { bus: 'world', limit: 2, prio: 70, caption: '[Something revealed]', gameplay: true },
  // ------------------------------------------------ Tool pick-up
  'sfx.tool.lancet': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.tongs': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.leech': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.thread': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.salve': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.tincture': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.brand': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.lens': { bus: 'ui', limit: 1, prio: 40, cents: 40 },
  'sfx.tool.deny': { bus: 'ui', limit: 1, prio: 40, cents: 60 },
  // ------------------------------------------------ Bleeding
  'loop.bleed.trickle': { bus: 'world', loop: true, prio: 25 },
  'sfx.blood.drip': { bus: 'world', limit: 3, prio: 10, cents: 200 },
  'sfx.blood.flooded': { bus: 'world', limit: 1, prio: 55, cooldown: 1.5, caption: '[Blood floods the wound]', gameplay: true },
  // ------------------------------------------------ Embedded
  'sfx.hexstone.pulse': { bus: 'world', limit: 2, prio: 45, caption: '[The hexstone whispers]', gameplay: true },
  'sfx.barb.tear': { bus: 'world', limit: 1, prio: 80, caption: '[Barbs tear the flesh]' },
  // ------------------------------------------------ Burns
  'sfx.burn.crack': { bus: 'world', limit: 3, prio: 45, cents: 100 },
  'loop.burn.bed': { bus: 'world', loop: true, prio: 20 },
  'sfx.burn.dressed': { bus: 'world', limit: 2, prio: 55, cents: 30 },
  // ------------------------------------------------ Plague
  'sfx.bubo.creak': { bus: 'world', limit: 2, prio: 35, caption: '[A bubo swells, creaking]', gameplay: true },
  'sfx.bubo.lance': { bus: 'world', limit: 2, prio: 65, cents: 60 },
  'sfx.bubo.burst': { bus: 'world', limit: 1, prio: 80, caption: '[A bubo bursts]' },
  'loop.rot.creep': { bus: 'world', loop: true, prio: 20 },
  'sfx.rot.purged': { bus: 'world', limit: 2, prio: 55, cents: 30 },
  // ------------------------------------------------ Venom
  'loop.venom.hiss': { bus: 'world', loop: true, prio: 30 },
  'sfx.venom.neutralise': { bus: 'world', limit: 2, prio: 65, caption: '[Venom fizzes, neutralised]' },
  // ------------------------------------------------ Grubs & spiderlings
  'loop.grub.chitter': { bus: 'world', loop: true, prio: 30, limit: 3, caption: '[Grub chitters beneath the skin]' },
  'sfx.grub.burrow': { bus: 'world', limit: 2, prio: 30, cents: 100 },
  'sfx.grub.seared': { bus: 'world', limit: 3, prio: 60, cents: 120 },
  'sfx.grub.plucked': { bus: 'world', limit: 3, prio: 55, cents: 120 },
  'loop.spider.skitter': { bus: 'world', loop: true, prio: 30, limit: 4, caption: '[Spiderlings skitter]' },
  'sfx.spider.seared': { bus: 'world', limit: 3, prio: 55, cents: 150 },
  // ------------------------------------------------ Curse-sigil
  'loop.sigil.whisper': { bus: 'world', loop: true, prio: 30, caption: '[A curse-sigil chants in whispers]' },
  'sfx.sigil.crack': { bus: 'world', limit: 2, prio: 55, cents: 80 },
  'sfx.sigil.broken': { bus: 'world', limit: 1, prio: 80, caption: '[The curse shatters]' },
  'sfx.sigil.lash': { bus: 'world', limit: 2, prio: 60, cents: 60, caption: '[The curse lashes out]', gameplay: true },
  // ------------------------------------------------ Egg sacs
  'loop.eggsac.pulse': { bus: 'world', loop: true, prio: 40, caption: '[An egg sac throbs]' },
  'sfx.eggsac.lance': { bus: 'world', limit: 2, prio: 65, cents: 60 },
  'sfx.eggsac.hatch': { bus: 'world', limit: 1, prio: 80, caption: '[The egg sac hatches]' },
  // ------------------------------------------------ Patient
  'sfx.patient.moan': { bus: 'world', limit: 1, prio: 35, cooldown: 6, cents: 60 },
  'sfx.patient.pain': { bus: 'world', limit: 1, prio: 60, cooldown: 1.2, cents: 80, caption: '[The patient cries out]' },
  'sfx.patient.relief': { bus: 'world', limit: 1, prio: 50 },
  'sfx.patient.death': { bus: 'world', limit: 1, prio: 90 },
  // ------------------------------------------------ Malison of Matins
  'loop.matins.drone': { bus: 'world', loop: true, prio: 70, caption: '[The Malison drones]' },
  'sfx.matins.shroud': { bus: 'world', limit: 1, prio: 85, caption: '[The shroud parts — a choir swells]', gameplay: true },
  'sfx.malison.rend': { bus: 'world', limit: 2, prio: 80, caption: '[The Malison rends flesh]', gameplay: true, duck: 'boss' },
  'sfx.matins.shriek': { bus: 'world', limit: 1, prio: 75, cooldown: 0.9, caption: '[The Malison shrieks]' },
  'sfx.matins.shed': { bus: 'world', limit: 1, prio: 80, caption: '[Hexlings are shed]', gameplay: true },
  'sfx.matins.split': { bus: 'world', limit: 1, prio: 90, caption: '[The Malison splits apart]', duck: 'boss' },
  'sfx.matins.rejoinWarn': { bus: 'world', limit: 1, prio: 90, caption: '[The shard whispers — it will rejoin]', gameplay: true },
  'sfx.matins.rejoin': { bus: 'world', limit: 1, prio: 90, caption: '[The shards rejoin]', duck: 'boss' },
  'sfx.malison.unmade': { bus: 'world', limit: 1, prio: 95, caption: '[The Malison is unmade — a bell tolls]', duck: 'boss' },
  // ------------------------------------------------ Malison of Lauds
  'loop.lauds.voice': { bus: 'world', loop: true, prio: 60, limit: 6, caption: '[The Voices sing]' },
  'sfx.lauds.silenced': { bus: 'world', limit: 2, prio: 80, caption: '[A Voice is silenced]' },
  'sfx.lauds.recall': { bus: 'world', limit: 1, prio: 85, caption: '[It calls its Voices back]', gameplay: true },
  'sfx.lauds.hymn': { bus: 'world', limit: 1, prio: 90, caption: '[The Hymn rises — a verse is coming]', gameplay: true },
  'sfx.lauds.hymnBlast': { bus: 'world', limit: 1, prio: 85, caption: '[The verse tears the flesh]', duck: 'boss' },
  'sfx.lauds.submerge': { bus: 'world', limit: 1, prio: 85, caption: '[It sinks beneath the skin]', gameplay: true },
  'sfx.lauds.surface': { bus: 'world', limit: 1, prio: 85, caption: '[It surfaces]' },
  'sfx.lauds.shatter': { bus: 'world', limit: 1, prio: 95, caption: '[It shatters into hexstone]', duck: 'boss' },
  'sfx.lauds.death': { bus: 'world', limit: 1, prio: 95 },
  // ------------------------------------------------ Hour bells
  'sfx.bell.matins': { bus: 'hud', limit: 1, prio: 90, caption: '[Bell tolls for Matins]' },
  'sfx.bell.lauds': { bus: 'hud', limit: 1, prio: 90, caption: '[Bells peal for Lauds]' },
  'sfx.bell.prime': { bus: 'hud', limit: 1, prio: 90, caption: '[Bell rings Prime]' },
  'sfx.bell.terce': { bus: 'hud', limit: 1, prio: 90, caption: '[Bell rings Terce]' },
  'sfx.bell.sext': { bus: 'hud', limit: 1, prio: 90, caption: '[Bells ring Sext]' },
  'sfx.bell.none': { bus: 'hud', limit: 1, prio: 90, caption: '[The death-bell tolls None]' },
  'sfx.bell.vespers': { bus: 'hud', limit: 1, prio: 90, caption: '[Bells ring Vespers]' },
  'sfx.bell.compline': { bus: 'hud', limit: 1, prio: 90, caption: '[A deep bell tolls Compline]' },
  // ------------------------------------------------ Ratings & combos
  'sfx.rate.cool': { bus: 'hud', limit: 2, prio: 65, cents: 15, duck: 'sting' },
  'sfx.rate.good': { bus: 'hud', limit: 2, prio: 60, cents: 15, duck: 'sting' },
  'sfx.rate.bad': { bus: 'hud', limit: 2, prio: 60, cents: 30, duck: 'sting' },
  'sfx.rate.miss': { bus: 'hud', limit: 2, prio: 65, cents: 20, duck: 'sting' },
  'sfx.combo.tier': { bus: 'hud', limit: 1, prio: 60 },
  'sfx.combo.break': { bus: 'hud', limit: 1, prio: 55, caption: '[A string snaps — chain broken]' },
  // ------------------------------------------------ Vitals, death, timer, phases
  'sfx.vitals.warn60': { bus: 'hud', limit: 1, prio: 85, caption: '[Hand-bell: vitals weakening]', gameplay: true },
  'sfx.vitals.warn30': { bus: 'hud', limit: 1, prio: 90, caption: '[Hand-bell: vitals failing]', gameplay: true },
  'sfx.vitals.warn15': { bus: 'hud', limit: 1, prio: 95, caption: '[Frantic bell: death is near]', gameplay: true },
  'sfx.death.knell': { bus: 'hud', limit: 1, prio: 100, caption: '[A death knell]', duck: 'knell' },
  'sfx.timer.tick': { bus: 'hud', limit: 2, prio: 50, vars: 2, gameplay: true },
  'sfx.timer.up': { bus: 'hud', limit: 1, prio: 95, caption: '[Time is up]' },
  'sfx.phase.clear': { bus: 'hud', limit: 1, prio: 60 },
  'sfx.vitals.heal': { bus: 'hud', limit: 1, prio: 50 },
  'sfx.vitals.hurt': { bus: 'world', limit: 2, prio: 50, cooldown: 0.4 },
  'sfx.heart.beat': { bus: 'world', limit: 2, prio: 70, vars: 1, caption: '[Heartbeat quickens]', gameplay: true },
  'sfx.heart.pulseTick': { bus: 'hud', limit: 2, prio: 30, vars: 1 },
  'loop.tinnitus': { bus: 'hud', loop: true, prio: 10 },
  // ------------------------------------------------ Litany of Stillness
  'loop.litany.trail': { bus: 'hud', loop: true, prio: 60 },
  'sfx.litany.vertex': { bus: 'hud', limit: 3, prio: 60, vars: 1 },
  'sfx.litany.fizzle': { bus: 'hud', limit: 1, prio: 60, caption: '[The sign falters]' },
  'sfx.litany.spent': { bus: 'hud', limit: 1, prio: 60 },
  'sfx.litany.invoke': { bus: 'hud', limit: 1, prio: 95, caption: '[“Be still…” — a choir swells]' },
  'sfx.litany.endWarn': { bus: 'hud', limit: 1, prio: 90, caption: '[Stillness is ending]', gameplay: true },
  'sfx.litany.exhale': { bus: 'hud', limit: 1, prio: 80 },
  // ------------------------------------------------ Boss/Hymn helpers
  // ------------------------------------------------ UI
  'ui.hover': { bus: 'ui', limit: 2, prio: 5, cents: 100 },
  'ui.confirm': { bus: 'ui', limit: 2, prio: 40, cents: 40 },
  'ui.back': { bus: 'ui', limit: 1, prio: 35, cents: 60 },
  'ui.tab': { bus: 'ui', limit: 2, prio: 30, cents: 80 },
  'ui.slider': { bus: 'ui', limit: 2, prio: 20, cents: 60 },
  'ui.toggle': { bus: 'ui', limit: 1, prio: 30, cents: 40 },
  'ui.error': { bus: 'ui', limit: 1, prio: 40 },
  'ui.pauseOpen': { bus: 'ui', limit: 1, prio: 50 },
  'ui.pauseClose': { bus: 'ui', limit: 1, prio: 50 },
  'ui.save': { bus: 'ui', limit: 1, prio: 30 },
  'ui.vn.advance': { bus: 'ui', limit: 1, prio: 20, cents: 80 },
  'ui.vn.blip': { bus: 'ui', limit: 2, prio: 5, cents: 60, vars: 1 },
  'ui.vn.pageTurn': { bus: 'ui', limit: 1, prio: 40 },
  'ui.vn.whoosh': { bus: 'ui', limit: 1, prio: 35 },
  'ui.vn.portrait': { bus: 'ui', limit: 1, prio: 20 },
  'ui.results.tally': { bus: 'ui', limit: 2, prio: 30, cents: 30 },
  'loop.results.roll': { bus: 'ui', loop: true, prio: 30 },
  'ui.results.seal': { bus: 'ui', limit: 1, prio: 70, vars: 1 },
  'ui.results.best': { bus: 'ui', limit: 1, prio: 70, caption: '[A flourish: a new best]' },
  'ui.brief.unroll': { bus: 'ui', limit: 1, prio: 40 },
  'loop.brief.quill': { bus: 'ui', loop: true, prio: 20 },
  'ui.brief.scrubIn': { bus: 'ui', limit: 1, prio: 60, caption: '[Hands scrubbed; instruments rattle]' },
  // ------------------------------------------------ Ambience emitters & beds
  'loop.curse.bed': { bus: 'ambience', loop: true, prio: 30 },
  'loop.amb.hospice': { bus: 'ambience', loop: true, prio: 15 },
  'loop.amb.street': { bus: 'ambience', loop: true, prio: 15 },
  'loop.amb.theatre': { bus: 'ambience', loop: true, prio: 15 },
  'loop.amb.chapel': { bus: 'ambience', loop: true, prio: 15 },
  'loop.amb.night': { bus: 'ambience', loop: true, prio: 15 },
  'loop.amb.camp': { bus: 'ambience', loop: true, prio: 15 },
  'amb.bell': { bus: 'ambience', limit: 1, prio: 10, cents: 50, caption: '[A distant church bell]' },
  'amb.dog': { bus: 'ambience', limit: 1, prio: 10, cents: 150 },
  'amb.crow': { bus: 'ambience', limit: 1, prio: 10, cents: 150 },
  'amb.cough': { bus: 'ambience', limit: 1, prio: 10, cents: 150, caption: '[Distant coughing]' },
  'amb.watchman': { bus: 'ambience', limit: 1, prio: 10, caption: '[A watchman calls the hour]' },
  'amb.drunk': { bus: 'ambience', limit: 1, prio: 10, caption: '[Drunken singing, far off]' },
  'amb.cart': { bus: 'ambience', limit: 1, prio: 10 },
  'amb.owl': { bus: 'ambience', limit: 1, prio: 10, cents: 60 },
  'amb.drip': { bus: 'ambience', limit: 2, prio: 5, cents: 200 },
  'amb.armour': { bus: 'ambience', limit: 1, prio: 10 },
  'amb.horse': { bus: 'ambience', limit: 1, prio: 10 },
  'amb.choirHum': { bus: 'ambience', limit: 1, prio: 10 },
});

export type EventId = keyof typeof EVENTS;

export const eventDef = (id: EventId): EventDef => EVENTS[id];

/** Follow legacy aliases to the designed event. */
export function resolveEvent(id: EventId): EventId {
  let cur: EventId = id;
  for (let i = 0; i < 4; i++) {
    const a = (EVENTS[cur] as EventDef).alias;
    if (!a || !isEventId(a)) return cur;
    cur = a;
  }
  return cur;
}

export const isEventId = (s: string): s is EventId => Object.prototype.hasOwnProperty.call(EVENTS, s);

/** Every id in the table, for tooling (event-list export, parity audit, dev report). */
export const ALL_EVENTS = Object.keys(EVENTS) as EventId[];
