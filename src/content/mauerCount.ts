import { atLeast } from './flags';
import { onlyIf, say } from './story';

/** The ford held (CON-0228): at least seven of its wounded brought out alive. */
export const FORD_HELD = atLeast('fordSaved', 7);

/**
 * Mauer's head-count (NAR-0179): if the ford took three, every count after it is three lower, to
 * the end of the campaign. `held` is his line when the ford held, `lost` when it did not.
 */
export const mauerCount = (held: string, lost: string) => [...onlyIf(FORD_HELD, say('mauer', held)), ...onlyIf({ not: FORD_HELD }, say('mauer', lost))];
