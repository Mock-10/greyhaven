// Tyre change (mechanic, docs/03 "sequence", docs/06 "WASD/arrows for sequences"): six steps in a fixed order, each a
// short run of arrow keys shown as keycaps. A wrong key is an error (the step stays where it was). One timer.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export const TYRE_STEPS = [
  'LOOSEN NUTS',
  'JACK IT UP',
  'PULL THE WHEEL',
  'FIT THE SPARE',
  'TIGHTEN NUTS',
  'LOWER THE JACK',
] as const;

export type ArrowDir = 'up' | 'down' | 'left' | 'right';
export const ARROW_DIRS: readonly ArrowDir[] = ['up', 'down', 'left', 'right'];

export class TyreChangeGame implements MinigameLogic {
  /** The arrow run for each step. */
  readonly steps: ArrowDir[][];
  step = 0;
  pos = 0;
  errors = 0;
  timeLeft: number;
  readonly timeTotal: number;
  /** Seconds since the last wrong key, for a red flash. */
  wrongT = 99;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const T = BALANCE_JOBS.tyreChange;
    this.steps = TYRE_STEPS.map(() =>
      Array.from({ length: rng.int(T.minKeys, T.maxKeys) }, () => rng.pick(ARROW_DIRS)),
    );
    this.timeTotal = T.seconds;
    this.timeLeft = T.seconds;
  }

  get keys(): ArrowDir[] {
    return this.steps[this.step] ?? [];
  }

  /** Share of all the keys pressed right so far. */
  get progress(): number {
    const total = this.steps.reduce((n, s) => n + s.length, 0);
    const done = this.steps.slice(0, this.step).reduce((n, s) => n + s.length, 0) + this.pos;
    return done / total;
  }

  press(dir: ArrowDir): void {
    if (this.done) return;
    if (this.keys[this.pos] === dir) {
      this.pos++;
      if (this.pos >= this.keys.length) {
        this.step++;
        this.pos = 0;
        if (this.step >= this.steps.length) this.finish(true);
      }
    } else {
      this.errors++;
      this.wrongT = 0;
    }
  }

  private finish(completed: boolean): void {
    this.done = true;
    if (!completed) {
      this.grade = this.progress >= 0.6 ? 'poor' : 'fail';
      return;
    }
    const spare = this.timeLeft / this.timeTotal;
    if (this.errors === 0 && spare >= BALANCE_JOBS.tyreChange.excellentTimeShare) this.grade = 'excellent';
    else if (this.errors <= 1) this.grade = 'good';
    else if (this.errors <= 3) this.grade = 'ok';
    else this.grade = 'poor';
  }

  update(dt: number): void {
    this.wrongT += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish(false);
  }
}
