/** Art dev pages reachable with `?scene=<name>`: artview (UI kit board), fleshlab (flesh look-dev), shaderlab (every organ × people) and portraits (expression rig board / staging demo). */
import type { Scene } from '../core/scene';
import { ArtViewScene } from './artview';
import { FleshLabScene } from './fleshlab';
import { ShaderLabScene } from './shaderlab';
import { PortraitLabScene } from './portraitLab';

export function artDevScene(name: string | null): Scene | null {
  if (name === 'artview') return new ArtViewScene();
  if (name === 'fleshlab') return new FleshLabScene();
  if (name === 'shaderlab') return new ShaderLabScene();
  if (name === 'portraits') return new PortraitLabScene();
  return null;
}
