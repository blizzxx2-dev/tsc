/**
 * Epilogue cards (NAR-0159): after the ending, a woodcut caption for each of twelve people, in the
 * variant their story earned — survives, dies or absent (gone from Kessendorf). Fates come from the
 * ending and the flags; no card runs past fifty words. Some variants are rare by design.
 */
import { endingFor, endingInputs, type Ending } from './endings';
import type { FlagReader } from './flags';
import { n, onlyIf, type StoryDef } from './story';

export type Fate = 'survives' | 'dies' | 'absent';
export type WonEnding = Exclude<Ending, 'perfect'>;

export interface EpilogueCard {
  name: string;
  survives: string;
  dies: string;
  absent: string;
  /** The variant for an ending and the flags. */
  fate(e: WonEnding, f: Pick<FlagReader, 'get'>): Fate;
}

export const EPILOGUE: Record<string, EpilogueCard> = {
  kreuzer: {
    name: 'Dr. Kreuzer',
    survives: 'DR. KREUZER kept the hospice of Saint Ildra for twenty years, and never once drew the star again where anyone could see.',
    dies: 'DR. KREUZER died at his table in his sixtieth year, a needle in his hand. The patient lived.',
    absent: 'DR. KREUZER was never seen in Kessendorf again. The delvings tell of a surgeon who works by lamplight and charges in stories.',
    fate: (e) => (e === 'exile' ? 'absent' : 'survives'),
  },
  ilse: {
    name: 'Sister Ilse',
    survives: 'SISTER ILSE refused the convent three times, and ran the ward as she pleased. Her ledger is kept in the Guildhall still.',
    dies: 'SISTER ILSE died of the sweating fever in the fifth summer after, nursing the last of the sick. Nobody else did.',
    absent: 'SISTER ILSE left the Order and the city in one morning, on a cart, with a surgeon and a very small crate of lead dishes.',
    fate: (e) => (e === 'exile' ? 'absent' : 'survives'),
  },
  haller: {
    name: 'Master Haller',
    survives: 'MASTER HALLER taught at the Guildhall until his eightieth year, loudly. He never once admitted he was proud of anyone.',
    dies: 'MASTER HALLER did not see the next spring. The Guild rang its bell for him; he would have hated the fuss.',
    absent: 'MASTER HALLER retired to his sister’s orchard, and wrote to the hospice every week, mostly to complain.',
    fate: (_e, f) => (f.get('hallerFate') === 'lost' ? 'dies' : f.get('hallerFate') === 'scarred' ? 'absent' : 'survives'),
  },
  stroh: {
    name: 'Inquisitor Stroh',
    survives: 'INQUISITOR STROH kept his office, and his ledger, and a molar in a small silver box. He closed more cases than he opened.',
    dies: 'INQUISITOR STROH was found at his desk one winter, pen in hand, the last entry unfinished: “I was wrong about—”.',
    absent: 'INQUISITOR STROH was recalled to the Tribunal seat. His report on Kessendorf ran to a single line, which he never let anyone read.',
    fate: (e) => (e === 'exile' ? 'absent' : 'survives'),
  },
  mauer: {
    name: 'Captain Mauer',
    survives: 'CAPTAIN MAUER counted his men every morning for eleven more years. The number only ever went down by retirement.',
    dies: 'CAPTAIN MAUER fell at the Penny Stair in a riot over bread. Every man he had left carried him home.',
    absent: 'CAPTAIN MAUER, his leg stiff from the stone, gave up the Watch and kept bees. He counts them too.',
    fate: (_e, f) => (f.get('mauerFate') === 'maimed' ? 'absent' : 'survives'),
  },
  orsa: {
    name: 'Orsa Flintvein',
    survives: 'ORSA FLINTVEIN dug eleven more mines and named every one after somebody who owed her. None ever fell in.',
    dies: 'ORSA FLINTVEIN was lost in a flooded seam, far below the Kreuzer Hope. The delvers still leave her a lamp.',
    absent: 'ORSA FLINTVEIN went north with her pick and her tunnel-maps, and was not seen in Kessendorf again.',
    fate: (e) => (e === 'exile' ? 'survives' : 'absent'),
  },
  precentor: {
    name: 'Aurel Vennholt',
    survives: 'AUREL VENNHOLT lived out his years in a Tribunal cell, asking each morning for news of the patients. He never sang again.',
    dies: 'AUREL VENNHOLT died in his cell in the first frost, quietly, awake, and without a hymn.',
    absent: 'AUREL VENNHOLT was taken to the Tribunal seat under guard. What they did with a man who wrote an Office, nobody says.',
    fate: (e) => (e === 'pyre' ? 'absent' : 'survives'),
  },
  reiss: {
    name: 'The Widow Reiss',
    survives: 'THE WIDOW REISS kept her seat, and her charity, and her silence. The hospice’s candles came from elsewhere after that.',
    dies: 'THE WIDOW REISS was found in a coaching inn on the Weissburg road, with a book of hymns and no pulse.',
    absent: 'THE WIDOW REISS left Kessendorf in a carriage without a crest, and her seat on the council stood empty for a year.',
    fate: () => 'absent',
  },
  liesl: {
    name: 'Liesl',
    survives: 'LIESL, the founder’s girl, grew up with a certificate that said “natural”, and wore her horns under a cap until she stopped caring.',
    dies: 'LIESL did not live to see ten. The certificate was true; the Tribunal was thorough.',
    absent: 'LIESL was sent to the convent in the hills “for her own keeping”. Her mother walks there every Sunday.',
    fate: (_e, f) => (f.get('hornchildCertificate') === 'turned' ? 'absent' : 'survives'),
  },
  emmerich: {
    name: 'Emmerich',
    survives: 'EMMERICH, the page-boy, became a clerk at the Hall of Records, and sleeps with a candle lit to this day.',
    dies: 'EMMERICH died young, of an ordinary fever. His mother keeps the candle he slept by, and lights it every Hollow Night.',
    absent: 'EMMERICH went to sea, as far from any choir as a boy can get.',
    fate: () => 'survives',
  },
  tomas: {
    name: 'Tomas',
    survives: 'TOMAS, the scout, kept the arm, and threw with it, and taught his children to count the stitches on it.',
    dies: 'TOMAS went back to the barrow-fields the next spring and did not come back.',
    absent: 'TOMAS took his arm east to the Vennmark companies, where they pay double for a scout who has been bitten and lived.',
    fate: (e) => (e === 'exile' ? 'absent' : 'survives'),
  },
  burgomaster: {
    name: 'The Burgomaster',
    survives: 'THE BURGOMASTER signed everything he was given on Fridays, including, on one occasion, his own resignation. It was refused.',
    dies: 'THE BURGOMASTER died of a surfeit of Thursday dinners, and was mourned by several cooks.',
    absent: 'THE BURGOMASTER took a long holiday in Weissburg while the council decided what, exactly, he had signed.',
    fate: (e) => (e === 'pardon' ? 'survives' : 'absent'),
  },
};

/** The card text each person gets for an ending and the flags. */
export function epilogueFor(e: WonEnding, f: Pick<FlagReader, 'get'>): { id: string; fate: Fate; text: string }[] {
  return Object.entries(EPILOGUE).map(([id, c]) => {
    const fate = c.fate(e, f);
    return { id, fate, text: c[fate] };
  });
}

/** The epilogue as a narration scene: every variant, each shown only when it is the one earned. */
export const EPILOGUE_STORY: StoryDef = {
  id: 's5-epilogue',
  place: 'Afterwards',
  backdrop: 'hospice',
  lines: Object.entries(EPILOGUE).flatMap(([, c]) =>
    (['survives', 'dies', 'absent'] as const).flatMap((fate) => onlyIf((f: FlagReader) => c.fate(endingFor(endingInputs(f)), f) === fate, n(c[fate]))),
  ),
};
