/**
 * Audio entry point. The game talks to one `Audio` (an AudioSystem): a WebAudio
 * engine with a bus mixer, snapshots and ducking, designed procedurally
 * synthesised SFX per event (recorded assets replace them via the manifest),
 * adaptive procedural music, ambiences, heartbeat sonification and captions.
 * See src/audio/ and docs/audio/.
 *
 * Sounds are addressed by event id (src/audio/events.ts). The simulation pushes
 * ids into `op.cues`; the legacy short cue names remain valid aliases.
 */
import type { EventId } from '../audio/events';
import { AudioSystem } from '../audio/system';

export type Cue = EventId;

export class Audio extends AudioSystem {}
