// Names for art-pack frames. Placement data refers to sprites as `kind/name` (the same keys as
// art/source/cache.py: bld/, prop/, int/, char/, veh/) and these helpers find the atlas frame.

import vehicles2Json from '../../art/vehicles2.json';
import { DIRS, type Dir } from '../config/constants';
import type { AtlasKey } from './manifest';
import { ATLASES } from './manifest';

export interface FrameRef {
  atlas: AtlasKey;
  frame: string;
}

export type Pose = 'idle' | 'walk1' | 'walk2' | 'step1' | 'step2';

/** The 8-frame walk cycle: idle → step → stride → step, then the other leg (art/source/pack_steps.py). */
export const WALK_CYCLE: readonly Pose[] = [
  'idle',
  'step1',
  'walk1',
  'step1',
  'idle',
  'step2',
  'walk2',
  'step2',
];
export type InteractState = 'normal' | 'idle0' | 'idle1' | 'idle2' | 'hover';

const propIndex = new Map<string, string>();
for (const key of Object.keys(ATLASES.props.json.frames)) {
  const name = key.split('/')[1];
  if (name) propIndex.set(name, key);
}

const cityFrames = new Set(Object.keys(ATLASES.city.json.frames));

/**
 * City art (art/source/pack_city.py): street props in any direction, wall and fence segments in 16 directions,
 * infill buildings and ground decals, keyed '<kind>/<name>/<dir>'. Null when the city atlas doesn't hold it.
 */
export function cityFrame(kind: string, name: string, dir: number): FrameRef | null {
  const frame = `${kind}/${name}/${dir}`;
  return cityFrames.has(frame) ? { atlas: 'city', frame } : null;
}

export function dirName(index: number): Dir {
  return DIRS[((index % 8) + 8) % 8] as Dir;
}

export function tileFrame(kind: string, seed: number): FrameRef {
  return { atlas: 'tiles', frame: `${kind}/s${seed}` };
}

const buildings2 = new Set(Object.keys(ATLASES.buildings2.json.frames).map((k) => k.split('/')[0]));

/** Phase 1 buildings live in their own atlas (art/source/pack_phase1.py); the rest in the original one. */
export function buildingFrame(name: string, dir: number): FrameRef {
  return { atlas: buildings2.has(name) ? 'buildings2' : 'buildings', frame: `${name}/${dirName(dir)}` };
}

export function hasNightVariant(name: string, dir = 0): boolean {
  return (
    buildings2.has(`${name}_night`) || name === 'office_tower' || cityFrames.has(`bld/${name}_night/${dir}`)
  );
}

export function propFrame(name: string): FrameRef {
  const frame = propIndex.get(name);
  if (!frame) throw new Error(`unknown prop ${name}`);
  return { atlas: 'props', frame };
}

export function characterFrame(costume: string, pose: Pose, dir: number): FrameRef {
  // the palette-swapped player (docs/11): 'player/<hair style>', every pose in the one 'player' texture
  if (costume.startsWith('player/'))
    return { atlas: 'player', frame: `${costume.slice(7)}/${pose}/${dirName(dir)}` };
  const atlas = pose === 'step1' || pose === 'step2' ? 'steps' : 'characters';
  return { atlas, frame: `${costume}/${pose}/${dirName(dir)}` };
}

/** Models drawn from the Phase 4 vehicle sheet (art/vehicles2.png). */
const VEHICLES2 = new Set(Object.keys(vehicles2Json.frames).map((k) => k.split('/')[0] as string));

export function vehicleFrame(name: string, dir: number): FrameRef {
  return { atlas: VEHICLES2.has(name) ? 'vehicles2' : 'vehicles', frame: `${name}/${dirName(dir)}` };
}

export function interactableFrame(name: string, state: InteractState): FrameRef {
  return { atlas: 'interactables', frame: `${name}/${state}` };
}

/** Walk value used by the reference composer (scene.py): 0.6 → walk1, −0.6 → walk2, 0 → idle. */
export function poseFromWalk(walk: number): Pose {
  if (walk > 0) return 'walk1';
  if (walk < 0) return 'walk2';
  return 'idle';
}
