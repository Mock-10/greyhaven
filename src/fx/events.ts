// What the effect trackers ask the effects layer to spawn. Pure data.

import type { FxPreset } from '../data/fxPresets';
import type { EmitOptions } from './particles';

export interface FxEvent {
  preset: FxPreset;
  x: number;
  y: number;
  z: number;
  n: number;
  opts?: EmitOptions;
}
