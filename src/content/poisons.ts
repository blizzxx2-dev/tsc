/**
 * Poison variants (ENG-0267): each venom's look as a colour ramp — the ink of its spreading veins,
 * the stain the vein-web shader lays, the motes that run for the heart and the bite's core. The
 * antidote a venom needs is its `color` (the tincture); the ramp is only how it reads on the table.
 */
export type PoisonId = 'spider' | 'serpent' | 'wyrm' | 'nightshade';

export interface PoisonLook {
  /** Vein ink. */
  ink: string;
  /** Stain tint for the vein-web shader (linear RGB). */
  stain: [number, number, number];
  /** Motes running for the heart. */
  mote: string;
  /** The bite's core. */
  core: string;
}

export const POISONS: Record<PoisonId, PoisonLook> = {
  spider: { ink: '#140a1e', stain: [0.08, 0.03, 0.12], mote: '#e0b040', core: '#2a1030' },
  serpent: { ink: '#0e1a0a', stain: [0.05, 0.1, 0.03], mote: '#90e060', core: '#1a3010' },
  wyrm: { ink: '#1e120a', stain: [0.12, 0.06, 0.02], mote: '#ff9a40', core: '#3a1a08' },
  nightshade: { ink: '#0a0e1e', stain: [0.03, 0.05, 0.12], mote: '#9ab8ff', core: '#101a30' },
};

/** The default look for a venom's antidote colour. */
export const poisonFor = (color: 'green' | 'violet', poison?: PoisonId): PoisonLook => POISONS[poison ?? (color === 'green' ? 'serpent' : 'spider')];
