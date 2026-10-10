// Map data shapes. Maps are plain data: a tile grid plus object placements in world units.

import type { ShadowSpec } from '../iso/shadows';

export type SpriteKind = 'bld' | 'prop' | 'int' | 'char' | 'veh';

export interface Placement {
  /** Sprite key as in art/source/cache.py, e.g. 'bld/office_tower', 'prop/lamp', 'veh/taxi'. */
  sprite: `${SpriteKind}/${string}`;
  /** Render direction index (0–7 → SE, S, SW, W, NW, N, NE, E). */
  dir: number;
  /** Walk phase for characters (0 idle, +0.6 walk1, −0.6 walk2), as in scene.py. */
  walk: number;
  /** Ground anchor in world units. */
  x: number;
  y: number;
  shadow: ShadowSpec;
  /** Interactable cue state, if this object can be used. */
  cue?: 'idle' | 'hover';
  valuable?: boolean;
  /** Interaction prompt: key and label. */
  prompt?: [string, string];
  /** Street lamp (lights up at night, later phases). */
  lamp?: boolean;
  /** Blocks movement. Box footprints use the shadow box; blobs use the blob radius. */
  solid?: boolean;
}

export interface MapData {
  id: string;
  /** Tiles per side. */
  width: number;
  height: number;
  /** Tile kind per cell, indexed [i][j] with i along world x. */
  tiles: string[][];
  placements: Placement[];
  /** Where the debug walker starts, in world units. */
  spawn: { x: number; y: number };
}
