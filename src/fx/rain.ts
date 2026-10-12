// Rain (docs/01 "Lighting and weather", STYLE_GUIDE "Atmosphere variants"): slanted 3–6 px streaks falling
// across the view at about 45% opacity, most ending in a splash on the ground. The streaks live in view
// space (they fall past the camera); the splashes are handed back as view points for the effects layer to
// pin to the ground. Pure and seeded.

import { FX } from '../config/balanceFx';
import { Rng } from '../core/rng';

export interface Drop {
  x: number;
  y: number;
  /** Where it lands (view y). */
  land: number;
  /** Streak variant (0 short, 1 long). */
  v: number;
  splash: boolean;
}

export class RainSim {
  readonly drops: Drop[] = [];
  private rng: Rng;
  private w = 0;
  private h = 0;

  constructor(seed = 3) {
    this.rng = new Rng(seed);
  }

  /** Drops wanted for a view of this size at this intensity. */
  static target(w: number, h: number, intensity: number): number {
    return Math.round(((w * h) / 10000) * FX.rain.density * Math.max(0, Math.min(1, intensity)));
  }

  private spawn(anywhere: boolean): Drop {
    const r = this.rng;
    // streaks drift left as they fall, so they start up to half a view height to the right
    const land = r.range(0, this.h);
    return {
      x: r.range(0, this.w + this.h / 2),
      y: anywhere ? r.range(-20, land) : r.range(-40, -4),
      land,
      v: r.chance(0.5) ? 1 : 0,
      splash: r.chance(FX.rain.splashShare),
    };
  }

  /** Advance; returns the view points where drops landed and splash this frame. */
  update(dt: number, w: number, h: number, intensity: number): { x: number; y: number }[] {
    const resized = w !== this.w || h !== this.h;
    this.w = w;
    this.h = h;
    if (resized) this.drops.length = 0;
    const want = RainSim.target(w, h, intensity);
    // fill up at once on a fresh view, gently while rain builds
    const fresh = this.drops.length === 0;
    while (this.drops.length < want) this.drops.push(this.spawn(fresh));
    const out: { x: number; y: number }[] = [];
    const vy = FX.rain.fallSpeed;
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k] as Drop;
      d.y += vy * dt;
      d.x -= (vy / 2) * dt;
      if (d.y >= d.land) {
        if (d.splash) out.push({ x: d.x, y: d.land });
        if (this.drops.length > want) this.drops.splice(k, 1);
        else this.drops[k] = this.spawn(false);
      }
    }
    return out;
  }
}
