/** The cast. Portraits are procedural placeholders until final art lands. */
export type CharacterId = 'kreuzer' | 'ilse' | 'haller' | 'stroh' | 'mauer' | 'patient' | 'narrator' | 'choir';

export interface Character {
  name: string;
  /** Name-plate and backlight colour. */
  color: string;
  /** Silhouette style for the placeholder portrait. */
  silhouette: 'hood' | 'coif' | 'cap' | 'hat' | 'helm' | 'bare' | 'none';
  title?: string;
}

export const ASSISTANT_NAME = 'Sister Ilse';

export const CAST: Record<CharacterId, Character> = {
  kreuzer: { name: 'Dr. Kreuzer', color: '#c8a060', silhouette: 'cap', title: 'Apothecary-Surgeon, Hospice of Saint Ildra' },
  ilse: { name: 'Sister Ilse', color: '#9fd3a8', silhouette: 'coif', title: 'Nursing Sister of the Merciful Order' },
  haller: { name: 'Master Haller', color: '#a0a8c8', silhouette: 'bare', title: 'Guild Surgeon, retired (mostly)' },
  stroh: { name: 'Inquisitor Stroh', color: '#d05040', silhouette: 'hat', title: 'Order of the Pyre' },
  mauer: { name: 'Captain Mauer', color: '#c8b070', silhouette: 'helm', title: 'Kessendorf Watch' },
  patient: { name: 'Patient', color: '#a89c80', silhouette: 'bare' },
  narrator: { name: '', color: '#e8dcc0', silhouette: 'none' },
  choir: { name: '???', color: '#b060ff', silhouette: 'hood' },
};
