/** The cast. Portraits are procedural placeholders until final art lands. */
export type CharacterId = 'kreuzer' | 'ilse' | 'haller' | 'stroh' | 'mauer' | 'patient' | 'narrator' | 'choir';

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
};
