// When it rains (docs/01: "Rain comes up at random, about 25% of nights"). A pure function of the world seed and
// the clock, so it needs no save field: the same night always has the same weather. Returns the rain's
// intensity, 0–1, ramping up and down over a few minutes.

import { FX } from '../config/balanceFx';

const DAY = 24 * 60;

/** A stable 0–1 hash of (seed, day, salt). */
function h(seed: number, day: number, salt: number): number {
  let v = (seed ^ Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  v = Math.imul(v ^ (v >>> 16), 0x7feb352d) >>> 0;
  v = Math.imul(v ^ (v >>> 15), 0x846ca68b) >>> 0;
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

/** The rain window of the night that starts on `day` (in absolute minutes), or null for a dry night. */
export function rainWindow(seed: number, day: number): { from: number; to: number } | null {
  const R = FX.rain;
  if (h(seed, day, 1) >= R.nightChance) return null;
  const from = day * DAY + R.startMin + Math.floor(h(seed, day, 2) * R.startSpread);
  const to = from + R.lengthMin + Math.floor(h(seed, day, 3) * R.lengthSpread);
  return { from, to };
}

/** Rain intensity (0–1) at `minutes` since day 1 00:00. */
export function rainAt(seed: number, minutes: number): number {
  const day = Math.floor(minutes / DAY);
  let best = 0;
  // tonight's rain, or last night's still falling after midnight
  for (const d of [day, day - 1]) {
    if (d < 0) continue;
    const w = rainWindow(seed, d);
    if (!w || minutes < w.from || minutes > w.to) continue;
    const ramp = FX.rain.ramp;
    best = Math.max(best, Math.min(1, (minutes - w.from) / ramp, (w.to - minutes) / ramp));
  }
  return best;
}
