// Doorstep (delivery, docs/03 "timed hand-off, finding the right door"): the van is parked on a short street strip.
// Read the house number on the parcel's label, walk to that door (A/D or a click) and hand it over (Space). A wrong
// door is an error; the parcel stays in your hands. A few parcels against one timer.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export class DoorstepGame implements MinigameLogic {
  /** House numbers along the strip, left to right (ascending, with the odd gap). */
  readonly numbers: number[];
  /** The house (index on the strip) each parcel is for. */
  readonly parcels: number[];
  parcel = 0;
  /** Where the courier stands (a house index), and seconds until the next step is allowed. */
  at: number;
  private stepT = 0;
  /** A house the courier is walking to (a click), or null. */
  private walkTo: number | null = null;
  errors = 0;
  timeLeft: number;
  readonly timeTotal: number;
  last: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const D = BALANCE_JOBS.doorstep;
    let n = rng.int(3, 60) * 2 + 1;
    this.numbers = Array.from({ length: D.houses }, () => {
      const v = n;
      n += rng.chance(0.25) ? 4 : 2;
      return v;
    });
    const order = rng.shuffle([...this.numbers.keys()]);
    this.parcels = order.slice(0, D.parcels);
    // start at the van, which is parked away from the first drop
    this.at = this.parcels[0]! < D.houses / 2 ? D.houses - 1 : 0;
    this.timeTotal = D.seconds;
    this.timeLeft = D.seconds;
  }

  /** The house number on the current parcel's label. */
  get label(): number | null {
    const k = this.done ? undefined : this.parcels[this.parcel];
    return k === undefined ? null : (this.numbers[k] as number);
  }

  /** Step one house left (−1) or right (+1). */
  move(dx: number): void {
    if (this.done || this.stepT > 0) return;
    this.walkTo = null;
    this.step(dx);
  }

  private step(dx: number): void {
    const next = Math.max(0, Math.min(this.numbers.length - 1, this.at + Math.sign(dx)));
    if (next === this.at) return;
    this.at = next;
    this.stepT = BALANCE_JOBS.doorstep.stepTime;
  }

  /** Walk to house `k` (a click); the parcel is handed over on arrival. */
  goTo(k: number): void {
    if (this.done || k < 0 || k >= this.numbers.length) return;
    if (k === this.at) this.deliver();
    else this.walkTo = k;
  }

  /** Hand the parcel over at the door the courier is standing at. */
  deliver(): void {
    const want = this.done ? undefined : this.parcels[this.parcel];
    if (want === undefined) return;
    const ok = this.at === want;
    this.last = { ok, t: 0 };
    if (!ok) {
      this.errors++;
      return;
    }
    this.parcel++;
    if (this.parcel >= this.parcels.length) this.finish(true);
  }

  private finish(completed: boolean): void {
    this.done = true;
    if (!completed) {
      this.grade = this.parcel >= 2 ? 'poor' : 'fail';
      return;
    }
    const spare = this.timeLeft / this.timeTotal;
    if (this.errors === 0 && spare >= BALANCE_JOBS.doorstep.excellentTimeShare) this.grade = 'excellent';
    else if (this.errors <= 1) this.grade = 'good';
    else if (this.errors <= 2) this.grade = 'ok';
    else this.grade = 'poor';
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    this.stepT = Math.max(0, this.stepT - dt);
    if (this.walkTo !== null && this.stepT === 0) {
      this.step(this.walkTo - this.at);
      if (this.at === this.walkTo) {
        this.walkTo = null;
        this.deliver();
      }
    }
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish(false);
  }
}
