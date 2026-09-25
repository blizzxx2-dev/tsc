import type { Backdrop } from './story';
import type { CharacterId } from './characters';

/**
 * Period artwork (public domain; see public/art/CREDITS.md) keyed by use.
 * Paths are relative to the site root. Missing entries fall back to procedural art.
 */
export interface ArtRef {
  file: string;
  /** Crop focus 0..1 (x, y) when the image is covered into a frame. */
  focus?: [number, number];
  /** 0 = keep original colours, 1 = fully toned to ink and paper. */
  sepia?: number;
}

export const BACKDROP_ART: Partial<Record<Backdrop | 'title' | 'results', ArtRef>> = {};
export const PORTRAIT_ART: Partial<Record<CharacterId, ArtRef>> = {};

export const artUrl = (a: ArtRef): string => `${import.meta.env.BASE_URL}art/${a.file}`;
