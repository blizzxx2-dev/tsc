/** Art dev pages reachable with `?scene=<name>`: artview (UI kit board) and fleshlab (flesh look-dev). */
import type { Scene } from '../core/scene';
import { ArtViewScene } from './artview';
import { FleshLabScene } from './fleshlab';

export function artDevScene(name: string | null): Scene | null {
  if (name === 'artview') return new ArtViewScene();
  if (name === 'fleshlab') return new FleshLabScene();
  return null;
}
