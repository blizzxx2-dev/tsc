import type { Audio } from './audio';
import type { Input } from './input';
import type { Gfx } from '../render/gfx';

export interface Game {
  input: Input;
  audio: Audio;
  gfx: Gfx;
  /** Replace the active scene. */
  go(scene: Scene): void;
}

export interface Scene {
  enter?(game: Game): void;
  update(dt: number, game: Game): void;
  render(g: Gfx, game: Game): void;
}
