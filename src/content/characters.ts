/** The cast. Portraits are procedural placeholders until final art lands. */
export type CharacterId =
  | 'kreuzer'
  | 'ilse'
  | 'haller'
  | 'stroh'
  | 'mauer'
  | 'patient'
  | 'narrator'
  | 'choir'
  // Chapters III–V (NAR-0113).
  | 'precentor'
  | 'orsa'
  | 'reiss'
  | 'tallert'
  | 'motherSuperior'
  | 'burgomaster';

export interface Character {
  name: string;
  /** Name-plate and backlight colour. */
  color: string;
  /** Silhouette style for the placeholder portrait. */
  silhouette: 'hood' | 'coif' | 'cap' | 'hat' | 'helm' | 'bare' | 'none';
  title?: string;
  /** Portrait material colours. */
  cloth?: string;
  skin?: string;
  hair?: string;
  /** 0 none, 1 full beard, 2 goatee + moustache, 3 stubble. */
  beard?: number;
}

export const ASSISTANT_NAME = 'Sister Ilse';

export const CAST: Record<CharacterId, Character> = {
  kreuzer: { name: 'Dr. Kreuzer', color: '#c8a060', silhouette: 'cap', cloth: '#3a2a20', hair: '#2a1a10', title: 'Apothecary-Surgeon, Hospice of Saint Ildra' },
  ilse: { name: 'Sister Ilse', color: '#9fd3a8', silhouette: 'coif', cloth: '#3e454e', skin: '#d8b098', title: 'Nursing Sister of the Merciful Order' },
  haller: { name: 'Master Haller', color: '#a0a8c8', silhouette: 'bare', cloth: '#26302a', skin: '#c8ac98', hair: '#d8d4cc', beard: 1, title: 'Guild Surgeon, retired (mostly)' },
  stroh: { name: 'Inquisitor Stroh', color: '#d05040', silhouette: 'hat', cloth: '#161214', skin: '#c0a090', hair: '#1a1210', beard: 2, title: 'Ash Tribunal' },
  mauer: { name: 'Captain Mauer', color: '#c8b070', silhouette: 'helm', cloth: '#5a2618', skin: '#c88a70', hair: '#3a2416', beard: 3, title: 'Kessendorf Watch' },
  patient: { name: 'Patient', color: '#a89c80', silhouette: 'bare', cloth: '#4a4038' },
  narrator: { name: '', color: '#e8dcc0', silhouette: 'none' },
  choir: { name: '???', color: '#b060ff', silhouette: 'hood', cloth: '#2a2630', skin: '#a89890' },
  // Chapters III–V (NAR-0113). Name-plate colours stay clear of the reserved curse-violet except the Precentor's own.
  precentor: { name: 'The Precentor', color: '#9a70d8', silhouette: 'hood', cloth: '#1c1822', skin: '#c8b8a8', hair: '#8a8a90', title: 'Aurel Vennholt, struck from the Guild rolls' },
  orsa: { name: 'Orsa Flintvein', color: '#d08a50', silhouette: 'bare', cloth: '#4a3a2a', skin: '#b88a6a', hair: '#6a3a1a', title: 'Foreman of the Flintvein delvers' },
  reiss: { name: 'Widow Reiss', color: '#c8c0d8', silhouette: 'coif', cloth: '#1a1a22', skin: '#e0c8b8', title: 'Aldegund Reiss, the charity seat of the Council' },
  tallert: { name: 'Registrar Tallert', color: '#b8a888', silhouette: 'cap', cloth: '#2a2a30', skin: '#d0b8a0', hair: '#5a5048', title: 'Oswin Tallert, Hall of Records' },
  motherSuperior: { name: 'The Mother Superior', color: '#a8c8c0', silhouette: 'coif', cloth: '#2a3038', skin: '#d8c0a8', title: 'Convent of the Merciful Order' },
  burgomaster: { name: 'The Burgomaster', color: '#e0c060', silhouette: 'hat', cloth: '#4a2020', skin: '#d8a890', hair: '#a8a098', beard: 1, title: 'Kessendorf, who signs things on Fridays' },
};

/**
 * The named patients' own busts (ART-0115…0123 for the demo, ART-0128 for Chapters III–V): the
 * demo cast by design, everyone else seeded from their name, so no two patients share a face.
 */
const NAMED_PATIENTS: Record<string, Omit<Character, 'name'>> = {
  Jost: { color: '#b89868', silhouette: 'cap', cloth: '#4a3422', skin: '#c89478', hair: '#4a3020', beard: 3 },
  Pieter: { color: '#c8a070', silhouette: 'cap', cloth: '#5a2618', skin: '#d0a488', hair: '#6a4a2a' },
  Anno: { color: '#a08868', silhouette: 'bare', cloth: '#2a2420', skin: '#8a6a58', hair: '#2a1a12' },
  'Unknown vagrant': { color: '#9a9480', silhouette: 'hood', cloth: '#3a3a30', skin: '#c8b8a0', beard: 1 },
  Emmerich: { color: '#a8b0d0', silhouette: 'cap', cloth: '#2a3a6a', skin: '#e0c0a8', hair: '#a07040' },
  Henning: { color: '#90a870', silhouette: 'hood', cloth: '#34402a', skin: '#c89c80', hair: '#5a4028', beard: 3 },
  Jorg: { color: '#d0b060', silhouette: 'helm', cloth: '#6a2a1a', skin: '#c88a70', hair: '#3a2416', beard: 2 },
  Tomas: { color: '#b0a078', silhouette: 'bare', cloth: '#3a3428', skin: '#d0a080', hair: '#5a3a1a' },
  // Species (ART-0128): the orc crossbowmen grey-green, the dwarf delvers ruddy and bearded.
  Ushkar: { color: '#8a9a78', silhouette: 'bare', cloth: '#3a3a2a', skin: '#7a8a70', hair: '#1a1a14' },
  Grisk: { color: '#8a9a78', silhouette: 'helm', cloth: '#3a3a2a', skin: '#708068', hair: '#1a1a14' },
  Brakka: { color: '#c08050', silhouette: 'bare', cloth: '#4a3a2a', skin: '#b8866a', hair: '#8a4a1a', beard: 1 },
};

const SKINS = ['#e0c0a8', '#d0a488', '#c89478', '#b88a6a', '#9a7058', '#7a5444'];
const CLOTHS = ['#4a3422', '#2a3038', '#3a2a30', '#34402a', '#4a2020', '#2a2a30', '#5a4a38'];
const HAIRS = ['#1a1210', '#3a2416', '#6a4a2a', '#a07040', '#8a8a90', '#d8d4cc'];

/** A named patient's bust; the generic patient when there is no name. */
export function patientLook(name: string | undefined): Character {
  if (!name) return CAST.patient;
  const key = Object.keys(NAMED_PATIENTS).find((k) => name.startsWith(k));
  if (key) return { name, ...NAMED_PATIENTS[key] };
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  const pick = <T>(xs: readonly T[], shift: number): T => xs[(h >>> shift) % xs.length];
  const veiled = /Sister|Widow|Mother|nun|Nun/.test(name);
  const armed = /Watch|pikeman|Pikeman|Sergeant|Captain|Ensign|guard|soldier|crossbow/i.test(name);
  const silhouette: Character['silhouette'] = veiled ? 'coif' : armed ? pick(['helm', 'cap'] as const, 3) : pick(['bare', 'cap', 'hood', 'bare'] as const, 5);
  return { name, color: pick(['#b89868', '#a8b090', '#c0a080', '#9aa0b8', '#b8a0a0'], 7), silhouette, cloth: pick(CLOTHS, 11), skin: pick(SKINS, 13), hair: pick(HAIRS, 17), beard: veiled ? 0 : (h >>> 19) % 4 };
}
