// Names for art-pack frames. Placement data refers to sprites as `kind/name` (the same keys as
// art/source/cache.py: bld/, prop/, int/, char/, veh/) and these helpers find the atlas frame.

import { DIRS, type Dir } from '../config/constants';
import type { AtlasKey } from './manifest';
import { ATLASES } from './manifest';

export interface FrameRef {
  atlas: AtlasKey;
  frame: string;
}

export type Pose = 'idle' | 'walk1' | 'walk2';
export type InteractState = 'normal' | 'idle0' | 'idle1' | 'idle2' | 'hover';

const propIndex = new Map<string, string>();
for (const key of Object.keys(ATLASES.props.json.frames)) {
  const name = key.split('/')[1];
  if (name) propIndex.set(name, key);
}

export function dirName(index: number): Dir {
  return DIRS[((index % 8) + 8) % 8] as Dir;
}

export function tileFrame(kind: string, seed: number): FrameRef {
  return { atlas: 'tiles', frame: `${kind}/s${seed}` };
}

export function buildingFrame(name: string, dir: number): FrameRef {
  return { atlas: 'buildings', frame: `${name}/${dirName(dir)}` };
}

export function propFrame(name: string): FrameRef {
  const frame = propIndex.get(name);
  if (!frame) throw new Error(`unknown prop ${name}`);
  return { atlas: 'props', frame };
}

export function characterFrame(costume: string, pose: Pose, dir: number): FrameRef {
  return { atlas: 'characters', frame: `${costume}/${pose}/${dirName(dir)}` };
}

export function vehicleFrame(name: string, dir: number): FrameRef {
  return { atlas: 'vehicles', frame: `${name}/${dirName(dir)}` };
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
