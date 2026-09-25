import { EDITION } from '../platform/build';
import { AFTERMATH, FAILURE } from './aftermath';
import { LATER_AFTERMATH } from './aftermath-later';
import type { StoryDef } from './story';

/**
 * Edition-aware lookups for narrative content that is keyed by operation id. Chapters III–V
 * content sits behind `EDITION === 'full'` so demo bundles drop it (PLT-0057, check:demo-bundle).
 */
export const aftermathFor = (opId: string): StoryDef | undefined => AFTERMATH[opId] ?? (EDITION === 'full' ? LATER_AFTERMATH[opId] : undefined);

export const failureFor = (opId: string): StoryDef | undefined => FAILURE[opId];
