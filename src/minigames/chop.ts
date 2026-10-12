// Chop (lumberjack, docs/06): a swing meter. A cursor sweeps the bar back and forth; Space stops it and swings the
// axe. Inside the sweet spot cuts the notch deeper (the great centre twice as deep), outside it glances off. The
// tree falls when the notch is deep enough; run out of swings first and it is a fail. The sweet spot moves and the
// cursor speeds up a little after every swing.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export type SwingResult = 'great' | 'good' | 'miss';

export class ChopGame implements MinigameLogic {
  /** Cursor position on the bar, 0–1. */
  cursor = 0;
  private dir = 1;
  speed: number;
  /** Centre of the sweet spot, 0–1. */
  spot = 0.5;
  /** Notch depth so far, and the depth that fells the tree. */
  depth = 0;
  readonly depthNeeded: number;
  swings = 0;
  readonly maxSwings: number;
  greats = 0;
  misses = 0;
  /** Seconds left of the current swing (the cursor waits). */
  cooldown = 0;
  last: { result: SwingResult; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(private rng: Rng) {
    const C = BALANCE_JOBS.chop;
    this.speed = C.speed;
    this.depthNeeded = C.depth;
    this.maxSwings = C.maxSwings;
    this.newSpot();
  }

  get felled(): boolean {
    return this.depth >= this.depthNeeded;
  }

  private newSpot(): void {
    const C = BALANCE_JOBS.chop;
    this.spot = this.rng.range(C.spotMin, C.spotMax);
  }

  /** Where the cursor would land now. */
  judge(): SwingResult {
    const C = BALANCE_JOBS.chop;
    const d = Math.abs(this.cursor - this.spot);
    return d <= C.great ? 'great' : d <= C.good ? 'good' : 'miss';
  }

  swing(): void {
    if (this.done || this.cooldown > 0) return;
    const C = BALANCE_JOBS.chop;
    const r = this.judge();
    this.swings++;
    if (r === 'great') {
      this.depth += 2;
      this.greats++;
    } else if (r === 'good') this.depth += 1;
    else this.misses++;
    this.last = { result: r, t: 0 };
    this.cooldown = C.swingTime;
    this.speed *= 1 + C.speedUp;
    if (this.felled) this.finish();
    else if (this.swings >= this.maxSwings) this.finish();
    else this.newSpot();
  }

  private finish(): void {
    this.done = true;
    const C = BALANCE_JOBS.chop;
    if (!this.felled) this.grade = 'fail';
    else if (this.misses === 0) this.grade = this.swings <= C.excellentSwings ? 'excellent' : 'good';
    else this.grade = this.misses === 1 ? 'ok' : 'poor';
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      return;
    }
    // a triangle wave between the ends of the bar
    let c = this.cursor + this.dir * this.speed * dt;
    while (c > 1 || c < 0) {
      if (c > 1) {
        c = 2 - c;
        this.dir = -1;
      } else {
        c = -c;
        this.dir = 1;
      }
    }
    this.cursor = c;
  }
}
