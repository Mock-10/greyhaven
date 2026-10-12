// Footstep effects (docs/13 "Effects"): a footstep lands every stride walked; sprinting kicks up a puff of dust,
// and so does any step on soft ground (dirt, grass, gravel). Pure: returns the puffs to spawn.

import { FX } from '../config/balanceFx';
import type { FxEvent } from './events';

export interface StepInput {
  x: number;
  y: number;
  sprinting: boolean;
  /** Dirt, grass or gravel underfoot. */
  soft: boolean;
}

export class StepFx {
  private last: { x: number; y: number } | null = null;
  private walked = 0;
  /** Footsteps so far (the sound layer can follow it too). */
  steps = 0;

  update(inp: StepInput): FxEvent[] {
    const out: FxEvent[] = [];
    if (this.last) {
      const d = Math.hypot(inp.x - this.last.x, inp.y - this.last.y);
      // a teleport (a door, a respawn) is not a step
      if (d < 40) this.walked += d;
      const stride = inp.sprinting ? FX.world.sprintStride : FX.world.stride;
      if (this.walked >= stride) {
        this.walked -= stride;
        this.steps++;
        const n = (inp.soft ? FX.world.softDust : 0) + (inp.sprinting ? FX.world.sprintDust : 0);
        if (n > 0) {
          // puffs fly back, away from the direction of travel
          const back = Math.atan2(this.last.y - inp.y, this.last.x - inp.x);
          out.push({
            preset: 'footDust',
            x: inp.x,
            y: inp.y,
            z: 1,
            n: Math.min(n, 2),
            opts: { angle: back },
          });
        }
      }
    }
    this.last = { x: inp.x, y: inp.y };
    return out;
  }

  reset(): void {
    this.last = null;
    this.walked = 0;
  }
}
