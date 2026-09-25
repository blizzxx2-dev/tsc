/**
 * The codex (NAR-0079…NAR-0086, NAR-0016, NAR-0048): what Kreuzer has learned, written up in the
 * hospice's commonplace book. Data only; the codex scene renders it. Every unlock refers to a real
 * operation, story scene or chapter (tests/content-codex.test.ts walks the campaign). Bodies are
 * ≤ 180 words; `more` is a second paragraph with its own unlock. Woodcut ids name art requests
 * (docs/narrative/art-requests.md); the gallery falls back to a plate with the title until they land.
 */
import type { Rank } from '../surgery/types';

export type CodexCategory = 'People' | 'Places' | 'Afflictions' | 'Instruments' | 'The Hours' | 'Orders';

export const CODEX_CATEGORIES: readonly CodexCategory[] = ['People', 'Places', 'Afflictions', 'Instruments', 'The Hours', 'Orders'];

/** When an entry (or its second paragraph) becomes readable. */
export type CodexUnlock =
  /** Readable from the first boot. */
  | { kind: 'start' }
  /** After this operation is won, optionally at this rank or better. */
  | { kind: 'op'; op: string; rank?: Rank }
  /** After this story scene has been read. */
  | { kind: 'story'; story: string }
  /** After this chapter (1-based) is complete. */
  | { kind: 'chapter'; chapter: number }
  /** After a persistent story flag is set (see KNOWN_STORY_FLAGS). */
  | { kind: 'flag'; flag: string };

export interface CodexEntry {
  id: string;
  title: string;
  category: CodexCategory;
  unlock: CodexUnlock;
  /** ≤ 180 words. */
  body: string;
  /** A second paragraph with its own unlock (people: an S rank or the chapter's end). */
  more?: { unlock: CodexUnlock; body: string };
  /** Folk-remedy sidebar (NAR-0085): a quack cure, in the voice of the street. */
  remedy?: string;
  /** Woodcut plate id. */
  image: string;
  /** Locked silhouette: the title shows, the body does not, until unlocked. */
  silhouette?: boolean;
}

/** Story flags the sim can set (`op.setStoryFlag`) that an unlock may name. */
export const KNOWN_STORY_FLAGS: readonly string[] = ['thrallKept'];

const start: CodexUnlock = { kind: 'start' };
const op = (id: string, rank?: Rank): CodexUnlock => ({ kind: 'op', op: id, rank });
const story = (id: string): CodexUnlock => ({ kind: 'story', story: id });
const chapter = (n: number): CodexUnlock => ({ kind: 'chapter', chapter: n });

// ------------------------------------------------------------------ People (NAR-0080)

const PEOPLE: CodexEntry[] = [
  {
    id: 'kreuzer',
    title: 'Doctor Kreuzer',
    category: 'People',
    unlock: start,
    image: 'wc-kreuzer',
    body: 'Apothecary-surgeon, sworn at Weissburg, lately of the Hospice of Saint Ildra. Weissburg taught him the rules of the craft and the fees that go with them; he came to Kessendorf, by his own account, because it was somewhere too poor to afford either. His hands are steady and his letters are in order. His anatomy is better than a guild surgeon’s ought to be, which is the first thing Master Haller noticed and the first thing the Inquisitor will.',
    more: {
      unlock: chapter(1),
      body: 'He has a stillness. Haller taught it him as a rite from the old offices — “still your heart and the world waits” — and told him never to use it where the Tribunal could see. He used it on the page-boy Emmerich with the Inquisitor in the yard. The candles stopped. Somebody counted.',
    },
  },
  {
    id: 'ilse',
    title: 'Sister Ilse',
    category: 'People',
    unlock: start,
    image: 'wc-ilse',
    body: 'Nursing sister of the Merciful Order, keeper of the instruments, the ledgers and the Master’s temper. She took the Order’s three vows — refuse no one, go unarmed, keep the ledger honest — and keeps them with a dryness that passes for humour. She boils the linen, counts the tools before and after, and has a column in the ledger for “fees, vegetable”. It is the longest column.',
    more: {
      unlock: op('op1-5', 'S'),
      body: 'The Order teaches that a sister must never halt a soul when it is its time to depart. Ilse has seen the Doctor halt a room. She has said nothing about it to anyone, which is the first lie she has ever told by silence, and she is keeping a tally of those too.',
    },
  },
  {
    id: 'haller',
    title: 'Master Haller',
    category: 'People',
    unlock: start,
    image: 'wc-haller',
    body: 'Guild surgeon, retired — mostly. He runs the hospice on the Widow Reiss’s money and his own contempt for the Guild that trained him. He does not praise; when he says “hm” it is a hymn. He struck a surgeon from the rolls twenty years ago for a heresy he has never named, and he has taught only one pupil since.',
    more: {
      unlock: chapter(1),
      body: 'The Litany was Haller’s before it was Kreuzer’s. He learned it, he says, from a man who is no longer a surgeon, the week before he made sure of that. He has never used it in front of a witness, and he told Kreuzer that the Tribunal does not distinguish between a prayer and a spell.',
    },
  },
  {
    id: 'stroh',
    title: 'Inquisitor Stroh',
    category: 'People',
    unlock: story('s1-4'),
    image: 'wc-stroh',
    body: 'Officer of the Ash Tribunal in Kessendorf: one Inquisitor, two sergeants, a clerk and a seal. He is not cruel for pleasure; he is thorough, which is worse. He keeps paper — depositions, certificates, lists of what witnesses saw — and paper is patient. He dines with the Burgomaster on Thursdays. He believes pestilence has a sponsor, and so, he is coming to think, does skill.',
    more: {
      unlock: chapter(2),
      body: 'When the Lauds thing screamed in the muster tent, every candle stopped flickering. The flames stood still for eight heartbeats. He counted. He has written the count down, and the names of everyone present, and he has not yet decided what it is evidence of.',
    },
  },
  {
    id: 'mauer',
    title: 'Captain Mauer',
    category: 'People',
    unlock: story('s1-2'),
    image: 'wc-mauer',
    body: 'Captain of the Kessendorf Watch: forty-odd citizens under arms on the Timber Road, paid by the council late and by the season. He counts everything — men, mules, witnesses, the cook — because the council does not. He swears by Saint Oswy’s wheel and wants only one thing of a surgeon: “Is he fit to march?”',
    more: {
      unlock: op('op2-5', 'S'),
      body: 'Twelve went out with the timber caravan; twelve came back, eleven walking. Mauer wrote the letter himself. He has decided that whatever the Doctor does in the tent is the Doctor’s affair and the council’s bill, and he has told the Inquisitor so, in front of forty witnesses.',
    },
  },
  {
    id: 'orsa',
    title: 'Orsa Flintvein',
    category: 'People',
    unlock: op('op2-2'),
    image: 'wc-orsa',
    body: 'Mountain-folk prospector, brought to the muster camp from a cave-in at a black seam. Every knot in her beard is a debt given or owed, and she has told the Sister that a beard is a ledger and nobody cuts one. She names her mines like children. The rock that fell on her, she says, went black as a wet eye and had a pulse.',
    more: {
      unlock: op('op2-2', 'S'),
      body: 'She tied a knot for the Doctor before she could sit up, and another, smaller, for the Sister’s brandy. She has offered to show him the seam. She has not offered to go back in first.',
    },
  },
  {
    id: 'horned-folk',
    title: 'The Horned Folk',
    category: 'People',
    unlock: op('op1-2'),
    image: 'wc-horned-folk',
    body: 'Forest people of the Grauwald with antlered or horned skulls; a people with their own quarrels, not a faction of anything. They fletch arrows with fish-hook barbs that must be nicked free before they can be drawn, and they keep antler-tallies: a notch cut in the owner’s antler for every arrow that has stuck in an enemy, so a raider’s rank can be read from across a clearing. A heavily notched antler is an old, careful archer. A smooth one is a boy, and boys shoot first.',
    more: {
      unlock: story('s1-2'),
      body: 'Townsfolk children are sometimes born with horn-buds. In law they are “hornfolk”, natural and harmless. A child whose buds come late is “late-turned”, and belongs, in law, to the Tribunal.',
    },
  },
];

// ------------------------------------------------------------------ Instruments (NAR-0081)

const INSTRUMENTS: CodexEntry[] = [
  {
    id: 'lancet',
    title: 'The Lancet',
    category: 'Instruments',
    unlock: start,
    image: 'wc-lancet',
    body: 'A short blade with a leaf-shaped point, ground on a Weissburg stone and kept in a horn case. It opens along the inked line, lances a ripe bubo with a single touch, and nicks a barbed head free of the flesh it has hooked. The Guild teaches that a cut should be made once and be sorry never. Usage: keep to the line; start at the glowing end; a wandering stroke is a second wound.',
  },
  {
    id: 'tongs',
    title: 'The Tongs',
    category: 'Instruments',
    unlock: start,
    image: 'wc-tongs',
    body: 'Brass tongs with a spring in the handle, a smith’s pattern adopted by surgeons because it does not slip when wet. They draw out what does not belong: arrowheads, bolts, lead shot, fangs, splinters of rock, the black eschar of a burn. Usage: seize and pull well clear of the body in one motion; a barb must be nicked first or it tears.',
  },
  {
    id: 'leech',
    title: 'The Leech-Pipe',
    category: 'Instruments',
    unlock: op('op1-1'),
    image: 'wc-leech',
    body: 'A glass pipe with a bulb of oiled bladder, named for the leeches it replaced. Held over pooled blood, pus or black bile it draws them off so the wound beneath can be seen and closed. Ilse boils it after every case and will not say what it smells of. Usage: drain before you stitch; you cannot close what you cannot see.',
  },
  {
    id: 'thread',
    title: 'Gut Thread',
    category: 'Instruments',
    unlock: op('op1-1'),
    image: 'wc-thread',
    body: 'Sheep-gut thread on a curved needle, bought by the hank from the Tanners’ Rows and dear enough to be counted. A zig-zag across the wound, stroke on stroke, closes it so the humours stay in and the bad air stays out. Usage: cross the wound again and again, moving along it; one smooth pass earns the best marks, and a stitch pulled through is worse than none.',
  },
  {
    id: 'salve',
    title: 'Saint’s Salve',
    category: 'Instruments',
    unlock: op('op1-1'),
    image: 'wc-salve',
    body: 'A balm of honey, turpentine and beeswax stirred under the Saint’s candle; the Order’s recipe, and the only thing the Order sells. It seals small nicks, checks creeping rot and finishes a burn once the eschar is plucked. The pot is small and refills slowly from the crock. Usage: brush, do not pour; salve over dead flesh only feeds the festering.',
  },
  {
    id: 'tincture',
    title: 'The Tincture',
    category: 'Instruments',
    unlock: op('op1-3'),
    image: 'wc-tincture',
    body: 'A cordial in a brass syringe: spirits of wine, foxglove, a little poppy, and whatever the apothecary added last. Held to clean flesh it steadies a failing pulse; held on a bite it draws the venom before it spreads. Other colours are drawn for other ills. Usage: hold it to the flesh, away from the wound; a man who does not need it will shake with it.',
  },
  {
    id: 'brand',
    title: 'The Cautery Brand',
    category: 'Instruments',
    unlock: op('op1-4'),
    image: 'wc-brand',
    body: 'An iron with a chisel head, kept in the brazier. It seals vessels, burns out what crawls in a sore, and — the Master discovered — sears curse-writing off the skin stroke by stroke. It grows too hot to hold if used without pause. Usage: hold it on the grub or the sigil until it stops; never linger on bare flesh; burn the grubs, not the man.',
  },
  {
    id: 'lens',
    title: 'The Scrying Lens',
    category: 'Instruments',
    unlock: op('op2-2'),
    image: 'wc-lens',
    body: 'An old glass in a brass ring, ground by a lens-grinder who left no name. Passed slowly over the body it shimmers where something hides beneath the skin, and held still it brings the thing to light. Haller swears it is optics. The Inquisitor has not yet asked to see it. Usage: pass slowly; hold still over the shimmer; then open or pull as the thing demands.',
  },
  {
    id: 'litany',
    title: 'The Litany of Stillness',
    category: 'Instruments',
    unlock: op('op1-5'),
    image: 'wc-litany',
    body: 'Not an instrument, though it lives on the tray. A rite from the old offices: a five-pointed star drawn in the air, and the world waits — for eight heartbeats, once in an operation. Haller taught it to Kreuzer and told him never to use it where the Tribunal could see. The Order says a sister must never halt a soul; the Litany halts the room. Usage: draw the star with the right hand; work quickly; say nothing afterwards.',
  },
];

// ------------------------------------------------------------------ Afflictions (NAR-0082, NAR-0085)

const AFFLICTIONS: CodexEntry[] = [
  {
    id: 'blade-wounds',
    title: 'Blade Wounds',
    category: 'Afflictions',
    unlock: op('op1-1'),
    image: 'wc-blade',
    body: 'The Tuesday trade of the Crooked Goose: a knife across the forearm, a slash to the flank, a pool of blood in the straw. A deep cut bleeds until it is closed; a shallow one seals with salve. Drain the pool, stitch the long cuts in one pass, salve the nicks. A drover who pays in turnips will live to be cut again.',
  },
  {
    id: 'barbed-arrows',
    title: 'Barbed Arrows',
    category: 'Afflictions',
    unlock: op('op1-2'),
    image: 'wc-arrow',
    body: 'Horned-folk heads are barbed like fish-hooks. Torn straight out they take a mouthful of flesh with them and the wound bleeds worse than the arrow ever did. Two nicks with the lancet at the entry wound free the barbs; then the tongs, pulled well clear. A crossbow bolt has no barbs and comes straight. Every barb that sticks is a notch on somebody’s antler.',
    remedy: 'Street cure: push it through and out the other side. This is why the militia has a surgeon and the Grauwald has crows.',
  },
  {
    id: 'powder-burns',
    title: 'Powder Burns',
    category: 'Afflictions',
    unlock: op('op1-3'),
    image: 'wc-powder',
    body: 'A burst barrel in the proof-house: powder-fire across the chest, and lead driven under the skin where it cannot be seen. The burn crusts to a black eschar that must be plucked off with the tongs before the raw flesh is salved. The shot is found by opening along the inked line. The Guild will bill the apprentice for the barrel.',
    remedy: 'Street cure: butter, applied thickly, and a prayer to Saint Hedda. The butter keeps the heat in. The Saint keeps her own counsel.',
  },
  {
    id: 'buboes',
    title: 'Pestilent Humours',
    category: 'Afflictions',
    unlock: op('op1-4'),
    image: 'wc-bubo',
    body: 'The plague of the poor quarters: bad air gathered in the groin and armpit until it ripens into buboes that swell and burst. Lance each one with a single touch before it bursts of its own accord, drain the pus, salve the sore. The Rows cough first and are seen last. The Tribunal counts a plague case as evidence of a sponsor.',
    remedy: 'Street cure: a side of beef hoisted on a flagpole to draw the bad air out of the house. By the third day the beef has drawn a good deal, none of it out of the patient.',
  },
  {
    id: 'rot',
    title: 'The Rot',
    category: 'Afflictions',
    unlock: op('op1-4'),
    image: 'wc-rot',
    body: 'Festering flesh that darkens and creeps, the humours gone bad at the edge of a wound. It spreads if left and returns if the salve is thin. Brush Saint’s Salve over every patch, quickly, and again where it crawls back; where something has died in the wound, cut it out first. Salve over dead flesh only feeds it.',
    remedy: 'Street cure: a penitent’s whip across the shoulders for the fever, on the reasoning that pain drives out pain. It drives out the penitent’s week’s wages, paid to the brotherhood.',
  },
  {
    id: 'grubs',
    title: 'Grubs in the Sore',
    category: 'Afflictions',
    unlock: op('op1-4'),
    image: 'wc-grub',
    body: 'Fly-larvae in an old sore, fat and quick, burrowing when the light finds them. The brand: hold it on each one until it stops moving, and lift it before it sears the man. The Tribunal’s cells breed them; so does any bed that is not turned. Ilse turns every bed.',
  },
  {
    id: 'gravehound-bite',
    title: 'Gravehound Bite',
    category: 'Afflictions',
    unlock: op('op2-1'),
    image: 'wc-gravehound',
    body: 'The lean corpse-eating hounds of the barrow-fields bite and hold; their fangs lodge and their spit carries a venom that spreads from the wound and drags on the heart. Tincture on the bite first, until it draws; then the tongs for every fang; then the claw rakes, drained and stitched one by one. Soldiers call any grave-robbing beast a corpse-eater and shoot first.',
  },
  {
    id: 'hexstone',
    title: 'Hexstone',
    category: 'Afflictions',
    unlock: op('op2-2'),
    image: 'wc-hexstone',
    body: 'Black glass that grows in certain seams, wet-looking, with a heartbeat — never green, never glowing. It sings when struck and buds flesh near it. Shards driven under the skin cannot be seen; the Scrying Lens shimmers where they lie, and the tongs draw them out. Around each shard the flesh spoils and must be cleaned. Orsa says the seam had a pulse. The seam did.',
  },
  {
    id: 'brood-venom',
    title: 'Web-Spinner Venom and Brood',
    category: 'Afflictions',
    unlock: op('op2-3'),
    image: 'wc-brood',
    body: 'The great web-spinners of the old web-trees — brood-mothers, the foresters say — bite twice and lay in the living. The venom numbs from the neck downward and needs the tincture at once; the egg sacs beneath the skin must be lanced with a single touch and the hatchlings seared before they scatter. A deep sac hides from the eye and needs the lens. The bite also raises a fever-bubo.',
    remedy: 'Street cure: a live spider swallowed in a spoon of treacle, to set a thief against a thief. The treacle is the only part with an argument for it.',
  },
  {
    id: 'sigils',
    title: 'Curse-Sigils',
    category: 'Afflictions',
    unlock: op('op1-5'),
    image: 'wc-sigil',
    body: 'Writing that moves on the skin: the Hollow Choir’s hymns “set” into a host by a cantor, stroke by stroke, and drawing on him while they stand. Every stroke of every sigil must be traced with the brand to sear it out; a lash is thrown at the surgeon’s hands while any stroke remains. One mark is common to every host — an eye with a stroke through it. The Choir’s sign for “the watcher is closed”.',
  },
];

// ------------------------------------------------------------------ Places and Orders (NAR-0083, NAR-0048)

const PLACES: CodexEntry[] = [
  {
    id: 'kessendorf',
    title: 'Kessendorf, the Free City',
    category: 'Places',
    unlock: start,
    image: 'wc-kessendorf',
    body: 'A walled river-city of thirty thousand souls on the Kessen, three days’ ride from anywhere important. It bought its freedom from a prince three hundred and twelve years ago with a cartload of silver and a promise to keep the eastern road open, and it keeps the road open, mostly by hiring other people. Money smells of tanbark and saltpetre. Twelve guilds sit on the council; a thirteenth seat is kept for the charities. Pyres burn the autumn dead outside the east gate.',
  },
  {
    id: 'hospice',
    title: 'The Hospice of Saint Ildra',
    category: 'Places',
    unlock: start,
    image: 'wc-hospice',
    body: 'A ward of twenty beds by the east gate, whitewashed stone because stone does not burn, a courtyard well, boiled linen, and an operating theatre that was once a chapel. The ledger has a column for “fees, vegetable”. Master Haller runs it; the Widow Reiss pays for it; Sister Ilse keeps it. The Saint’s candle is never allowed out, and the key to the dead-room hangs beside it.',
  },
  {
    id: 'grauwald',
    title: 'The Grauwald',
    category: 'Places',
    unlock: story('s2-1'),
    image: 'wc-grauwald',
    body: 'The grey forest east of the city, through which the Timber Road runs and the horned folk hunt. The Watch clears it of raiders before the spring caravans, every spring, and the raiders come back every autumn. Web-trees stand in the old growth. Foresters go in by day and count each other coming out.',
  },
  {
    id: 'barrow-fields',
    title: 'The Barrow-Fields',
    category: 'Places',
    unlock: story('s2-1'),
    image: 'wc-barrows',
    body: 'Grave-mounds older than the city on the far side of the Grauwald: turf, standing stones, and the lean hounds that dig there. The Choir’s lay-cantors sing to the dead among the barrows, and something followed the scouts out. The Watch does not camp within sight of them. The mules will not graze there.',
  },
  {
    id: 'carriage',
    title: 'The Carriage Without a Crest',
    category: 'Places',
    unlock: story('s1-5'),
    image: 'wc-carriage',
    body: 'Near midnight a carriage stopped at the hospice gate and left a page-boy with the choir singing in him. Its door panel had been planed smooth where a crest should be — not worn, not painted over: planed, on purpose, by a carpenter who was paid to do it well. Kessendorf has perhaps forty households that keep a carriage and a crest to plane off it. It pulled away before anyone thought to ask whose it was. The Doctor has begun a list.',
  },
];

const ORDERS: CodexEntry[] = [
  {
    id: 'hollow-choir',
    title: 'The Hollow Choir',
    category: 'Orders',
    unlock: op('op2-4'),
    image: 'wc-choir',
    body: 'A heretic congregation that believes the canonical hours, sung perfectly and into living flesh, make a curse that lives. They are not devil-worshippers; there is no god behind them. The hymns are the source. Cantors in grey robes with burn-scarred throats carry an Hour to a host and set it; lay-cantors sing to the dead in the barrow-fields, carry messages, and swallow them if caught. Silence-sigils on a lay-cantor’s chest ignite if he confesses. Somebody with money, candles and patient lists supplies them. The Doctor has a list for that too.',
  },
  {
    id: 'merciful-order',
    title: 'The Merciful Order',
    category: 'Orders',
    unlock: start,
    image: 'wc-order',
    body: 'Saint Ildra kept a lamp burning in a plague-house for forty nights and carried the keys of the dead to their families so that no one else would have to open those doors. Her emblem is a candle and a key. Her Order keeps hospices in every free city, owns no land, sits on no council and lives on patrons. Sisters vow to refuse no one, go unarmed, and keep the ledger honest. They are taught never to halt a soul when it is its time to depart.',
  },
  {
    id: 'ash-tribunal',
    title: 'The Ash Tribunal',
    category: 'Orders',
    unlock: story('s1-4'),
    image: 'wc-tribunal',
    body: 'A chartered office, not a church: a court of witch-finders licensed by the council to investigate sorcery, curses and unlicensed miracles, to hold suspects and to bring them to trial. Its sentence for proven witchcraft is the pyre at the east gate — hence Ash. It does not distinguish between a prayer and a spell: anything that works too well is evidence. Its charter must be renewed on the council roll every new year. Nobody has checked lately.',
  },
  {
    id: 'watch',
    title: 'The Kessendorf Watch',
    category: 'Orders',
    unlock: story('s1-2'),
    image: 'wc-watch',
    body: 'Forty-odd citizens under arms, the city’s share of the Long Muster: the standing levy the League of Free Cities called nine years ago and never stood down. The Watch keeps the Timber Road, dies for it, and is paid late. It counts its own dead because the council does not. Its captain swears by Saint Oswy, patron of carters, whose wheel has one spoke missing.',
  },
];

// ------------------------------------------------------------------ The Hours (NAR-0084)

const HOURS: CodexEntry[] = [
  {
    id: 'hours',
    title: 'The Hours: an Overview',
    category: 'The Hours',
    unlock: op('op1-5'),
    image: 'wc-hours',
    body: 'A malison is a living curse: an hour of the old Office sung perfectly into living flesh by the Hollow Choir, until it wakes and fights for its host. There are eight Hours, as there are eight offices of the day, from the night vigil to the last prayer before sleep. Each behaves as its hour does. The Choir believes the whole Office, sung into a whole city in one night, would still all suffering: a quiet night and a perfect end. The Doctor has met two.',
  },
  {
    id: 'matins',
    title: 'Matins',
    category: 'The Hours',
    unlock: op('op1-5'),
    image: 'wc-matins',
    body: 'The night vigil. In the page-boy Emmerich it was a shrouded mass beneath the ribs with one eye that opened on a rhythm — the rhythm of the hymn — and shed motes into the flesh around it while the eye was shut. Only the open eye can be hurt, and only with the brand. It whispers the vigil while it fights. It was the first Hour the Doctor met, and the first time the candles stopped.',
    more: { unlock: op('op1-5', 'S'), body: 'Sear it while the eye is open; salve the motes while it is shut; and never wait for it to blink twice. It learns the brand.' },
  },
  {
    id: 'lauds',
    title: 'Lauds',
    category: 'The Hours',
    unlock: op('op2-5'),
    image: 'wc-lauds',
    body: 'Dawn praise, sung in answer. In Jorg the standard-bearer it was two linked bodies that answered each other across the chest, and a ring of small lights — its Voices — that circled and sang. While any Voice sings the heart is shrouded; silence every one with the brand and it lies bare. It flares at dawn. It carried on the antiphon the lay-cantor had swallowed: who keeps the watch before the sun.',
    more: { unlock: op('op2-5', 'S'), body: 'The Voices answer the brand as they answer each other: one silenced, the next sings louder. Take them in a ring, not at random.' },
  },
  ...(['Prime', 'Terce', 'Sext', 'None', 'Vespers', 'Compline'] as const).map(
    (title): CodexEntry => ({
      id: title.toLowerCase(),
      title,
      category: 'The Hours',
      unlock: chapter(5),
      image: `wc-${title.toLowerCase()}`,
      silhouette: true,
      body: 'An Hour the Doctor has not yet met.',
    }),
  ),
];

export const CODEX: readonly CodexEntry[] = [...PEOPLE, ...INSTRUMENTS, ...AFFLICTIONS, ...PLACES, ...ORDERS, ...HOURS];

export const codexEntry = (id: string): CodexEntry | undefined => CODEX.find((e) => e.id === id);

/** What the player has done so far, as the unlock rules see it. */
export interface CodexProgress {
  /** Operations won, with the best rank. */
  won: Readonly<Record<string, Rank>>;
  /** Story scenes read. */
  stories: readonly string[];
  /** Chapters completed (1-based). */
  chapters: readonly number[];
  flags: readonly string[];
}

const RANK_ORDER: readonly Rank[] = ['C', 'B', 'A', 'S', 'XS'];
const rankAtLeast = (have: Rank, want: Rank): boolean => RANK_ORDER.indexOf(have) >= RANK_ORDER.indexOf(want);

export function unlocked(u: CodexUnlock, p: CodexProgress): boolean {
  switch (u.kind) {
    case 'start':
      return true;
    case 'op': {
      const r = p.won[u.op];
      return r !== undefined && (!u.rank || rankAtLeast(r, u.rank));
    }
    case 'story':
      return p.stories.includes(u.story);
    case 'chapter':
      return p.chapters.includes(u.chapter);
    case 'flag':
      return p.flags.includes(u.flag);
  }
}

/** Entries readable now (silhouettes are listed but not readable). */
export const codexUnlocked = (p: CodexProgress): CodexEntry[] => CODEX.filter((e) => unlocked(e.unlock, p));

/** The ids an unlock condition refers to, for the audit test. */
export function unlockRefs(u: CodexUnlock): { ops: string[]; stories: string[]; chapters: number[]; flags: string[] } {
  return { ops: u.kind === 'op' ? [u.op] : [], stories: u.kind === 'story' ? [u.story] : [], chapters: u.kind === 'chapter' ? [u.chapter] : [], flags: u.kind === 'flag' ? [u.flag] : [] };
}

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
