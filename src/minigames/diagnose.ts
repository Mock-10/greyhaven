// Diagnose (mechanic, docs/06): a car comes in with two symptoms; pick the faulty part out of 4 (keys 1–4 or a
// click). A few cars per task against one timer. A wrong pick moves on to the next car.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import { FAULTS, type Fault } from '../data/faults';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';
import { shareGrade } from './jobGrade';

export interface DiagnoseCar {
  /** The real fault, an index into FAULTS. */
  fault: number;
  /** The parts offered, as FAULTS indices; one of them is the answer. */
  options: number[];
}

export class DiagnoseGame implements MinigameLogic {
  readonly cars: DiagnoseCar[];
  round = 0;
  /** Whether each car was diagnosed right (a timeout leaves the rest unanswered). */
  readonly answers: boolean[] = [];
  timeLeft: number;
  readonly timeTotal: number;
  /** The last pick, for a short flash on its button. */
  last: { option: number; ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const D = BALANCE_JOBS.diagnose;
    const order = rng.shuffle([...FAULTS.keys()]);
    this.cars = order.slice(0, D.rounds).map((fault) => {
      const others = rng.shuffle([...FAULTS.keys()].filter((k) => k !== fault)).slice(0, D.options - 1);
      return { fault, options: rng.shuffle([fault, ...others]) };
    });
    this.timeTotal = D.seconds;
    this.timeLeft = D.seconds;
  }

  get car(): DiagnoseCar | null {
    return this.done ? null : (this.cars[this.round] ?? null);
  }

  /** The current car's fault (its symptoms are what the panel shows). */
  get fault(): Fault | null {
    const c = this.car;
    return c ? (FAULTS[c.fault] as Fault) : null;
  }

  get right(): number {
    return this.answers.filter(Boolean).length;
  }

  /** Pick option `k` (0-based) for the current car. */
  pick(k: number): void {
    const c = this.car;
    if (!c || k < 0 || k >= c.options.length) return;
    const ok = c.options[k] === c.fault;
    this.answers.push(ok);
    this.last = { option: k, ok, t: 0 };
    this.round++;
    if (this.round >= this.cars.length) this.finish();
  }

  private finish(): void {
    this.done = true;
    const spare = this.timeLeft / this.timeTotal >= BALANCE_JOBS.diagnose.excellentTimeShare;
    this.grade = shareGrade(this.right, this.cars.length, spare);
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish();
  }
}
