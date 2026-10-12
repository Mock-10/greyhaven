// Map data shapes. Maps are plain data: a tile grid plus object placements in world units.

import type { ShadowSpec } from '../iso/shadows';

export type SpriteKind = 'bld' | 'prop' | 'int' | 'char' | 'veh' | 'seg';

export interface Placement {
  /** Sprite key as in art/source/cache.py, e.g. 'bld/office_tower', 'prop/lamp', 'veh/taxi'. */
  sprite: `${SpriteKind}/${string}`;
  /** Render direction index (0–7 → SE, S, SW, W, NW, N, NE, E); for 'seg/' segments 0–15 in 22.5° steps. */
  dir: number;
  /** Walk phase for characters (0 idle, +0.6 walk1, −0.6 walk2), as in scene.py. */
  walk?: number;
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
  /** The sprite has a lit-window `_night` variant that glows after dark. */
  night?: boolean;
  /** A car that can be stolen and driven (milestone 3); the game makes it a vehicle instead of a static sprite. */
  parked?: boolean;
  /** Something the player can use with E (shows the gold rim in range and a prompt when targeted). */
  interact?: { id: string; label: string };
  /** An overhead roof on posts (the fuel canopy): drawn over whatever stands under it, faded when you're under it. */
  over?: boolean;
}

/** A marked area on the ground with a job, e.g. Marlo's dotted sale spot. */
export interface Zone {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Where the zone's NPC stands to come out (Marlo at his back door). */
  npc?: { x: number; y: number };
  /** Parking slots in the zone (the apartment's street spot): car centre and sprite direction. */
  slots?: { x: number; y: number; dir: number }[];
}

/** Interiors a street door can lead to (milestone 2; the Hedgerow Way shops and the car dealer in milestone 6b). */
export type DoorTarget =
  | 'tower_lobby'
  | 'store'
  | 'apartment'
  | 'bar'
  | 'chop_shop'
  | 'hardware'
  | 'clothing'
  | 'dealer'
  | 'garage'
  | 'depot'
  | 'site_trailer';

/** A street door: a hotspot on the pavement in front of an entrance. */
export interface Door {
  x: number;
  y: number;
  target: DoorTarget;
  label: string;
}

/** A named street's area, for the HUD street-name readout. */
export interface StreetSpan {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Vector ground (docs/14): material polygons in world units, painted in order, plus ground decals. */
export interface VectorGround {
  /** Material under every shape (ground materials in art/ground.json). */
  base: string;
  shapes: { m: string; p: [number, number][] }[];
  /** Grass tufts and weeds baked into the ground (city atlas frames dec/<k>/0). */
  decals?: { k: string; x: number; y: number }[];
}

export interface MapData {
  id: string;
  /** District name shown on the HUD. */
  name?: string;
  /** Tiles per side. */
  width: number;
  height: number;
  /** Tile kind per cell, indexed [i][j] with i along world x (tile maps such as the Phase 0 test map). */
  tiles?: string[][];
  /** Vector ground (city maps). A map has either tiles or ground. */
  ground?: VectorGround;
  placements: Placement[];
  doors?: Door[];
  streets?: StreetSpan[];
  zones?: Zone[];
  /** Pedestrian paths along the sidewalks (milestone 4). */
  walkways?: [number, number][][];
  /** Traffic lanes in driving order (milestone 4): routes from map edge to map edge, one or more each way per road
   *  (new roads have two each way since 2026-10-11), with turns where a road ends at another. */
  lanes?: { road: string; p: [number, number][]; stops?: { s: number; c: number }[] }[];
  /** Road centre lines, for police routing (lanes are offset and can turn). Older maps route on their lanes. */
  roads?: { road: string; p: [number, number][] }[];
  /** District names by area (first match wins); elsewhere the map's own name (Phase 2: Hedgerow Park, Far Acres). */
  districts?: { name: string; x0: number; y0: number; x1: number; y1: number }[];
  /** Road crossings: where the traffic lights are. */
  crossings?: { x: number; y: number }[];
  /** Where the player starts, in world units. */
  spawn: { x: number; y: number };
}
