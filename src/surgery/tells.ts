import type { Cue } from '../core/audio';

/**
 * Every audio tell has a visual twin (accessibility). This checklist names,
 * for each cue the simulation can raise and each boss tell, what is heard and
 * what is seen. A test fails if the sim raises a cue that is not listed here
 * or if either channel is missing.
 */
export interface Tell {
  id: string;
  audio: string;
  visual: string;
}

export const CUE_TELLS: Record<Cue, Tell> = {
  cool: { id: 'cool', audio: 'bright chime', visual: 'gilt COOL popup with a star-burst' },
  good: { id: 'good', audio: 'soft chime', visual: 'GOOD popup / "Found!" popup on a lens reveal' },
  bad: { id: 'bad', audio: 'dull knock', visual: 'orange BAD popup and a 2 px shake' },
  miss: { id: 'miss', audio: 'low thud', visual: 'red MISS popup' },
  cut: { id: 'cut', audio: 'blade rasp', visual: 'blood droplets and the cut carved in the surface layer' },
  stitch: { id: 'stitch', audio: 'thread pull', visual: 'stitch mark on the wound' },
  squelch: { id: 'squelch', audio: 'wet squelch', visual: 'pool vanishes / pus spray particles' },
  pluck: { id: 'pluck', audio: 'tongs clack', visual: 'held object follows the cursor' },
  burn: { id: 'burn', audio: 'sizzle', visual: 'sparks and smoke at the brand tip' },
  inject: { id: 'inject', audio: 'plunger hiss', visual: '+25 popup and the vial cooldown shading' },
  heartbeat: { id: 'heartbeat', audio: 'heartbeat thump', visual: 'ECG trace, pulsing heart medallion, vitals turn amber' },
  flatline: { id: 'flatline', audio: 'flatline tone', visual: 'flat ECG and "The Patient Is Lost" banner' },
  litany: { id: 'litany', audio: 'choral swell', visual: 'sepia ripple, gold star medallion and Litany popup' },
  bell: { id: 'bell', audio: 'hand-bell', visual: '"Steady hands!" callout / Operation Complete banner' },
  select: { id: 'select', audio: 'tray click', visual: 'tray slot glow and tool tooltip' },
  alarm: { id: 'alarm', audio: 'alarm bell', visual: 'timer turns red / red danger pulse at critical vitals' },
};

/** Boss and hazard tells (sim state the scene renders; sound from the matching cue). */
export const HAZARD_TELLS: readonly Tell[] = [
  { id: 'matins-open', audio: 'shroud tearing (burn cue on contact)', visual: 'the eye opens and the ring turns orange' },
  { id: 'lauds-hymn', audio: 'bell as the verse begins', visual: 'expanding lilac Hymn ring' },
  { id: 'hexfire-rekindle', audio: 'danger callout voice line', visual: 'green flicker on the burn 0.8 s before it rekindles' },
  { id: 'larynx-verse', audio: 'hummed verse', visual: 'rippling rings on the fold and a waveform while it hums' },
  { id: 'heart-beat-window', audio: 'heartbeat thump', visual: 'green/red ring around the heart during arrhythmia' },
  { id: 'eggsac-hatch', audio: 'danger callout voice line', visual: 'sac trembles faster; red countdown ring' },
];
