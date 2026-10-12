// Respray (mechanic, docs/03 "even sweep"): spray a door panel with an even coat. Aim the nozzle with the mouse (or
// move it with the arrows) and hold to spray. Each cell of the panel collects paint, most under the nozzle centre;
// too little leaves it patchy, too much makes it run. It ends when the time is up, when every cell has enough paint,
// or when the player calls it done.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';
import { scoreGrade } from './jobGrade';

export class ResprayGame implements MinigameLogic {
  readonly cols: number;
  readonly rows: number;
  /** Coats of paint per cell, row-major. */
  readonly coat: number[];
  /** Nozzle position over the panel, 0–1 on each axis. */
  nozzle = { x: 0, y: 0 };
  spraying = false;
  timeLeft: number;
  readonly timeTotal: number;
  done = false;
  grade: Grade | null = null;

  constructor() {
    const R = BALANCE_JOBS.respray;
    this.cols = R.cols;
    this.rows = R.rows;
    this.coat = Array<number>(R.cols * R.rows).fill(0);
    this.timeTotal = R.seconds;
    this.timeLeft = R.seconds;
  }

  /** Point the nozzle at (x, y), 0–1 over the panel (the mouse). */
  aim(x: number, y: number): void {
    this.nozzle = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  /** Move the nozzle (the arrow keys): dx, dy in −1..1 for `dt` seconds. */
  move(dx: number, dy: number, dt: number): void {
    const v = BALANCE_JOBS.respray.nozzleSpeed * dt;
    // the panel is wider than tall: move the same distance on screen both ways
    this.aim(this.nozzle.x + dx * v, this.nozzle.y + dy * v * (this.cols / this.rows));
  }

  spray(on: boolean): void {
    this.spraying = on && !this.done;
  }

  /** Cells with an even coat. */
  get even(): number {
    const R = BALANCE_JOBS.respray;
    return this.coat.filter((c) => c >= R.lo && c <= R.hi).length;
  }

  /** Cells with so much paint it runs. */
  get runs(): number {
    return this.coat.filter((c) => c > BALANCE_JOBS.respray.runAt).length;
  }

  /** Share of cells with at least an even coat. */
  get covered(): number {
    return this.coat.filter((c) => c >= BALANCE_JOBS.respray.lo).length / this.coat.length;
  }

  /** The grade's score, 0–1: even cells less a penalty for every run. */
  get score(): number {
    const R = BALANCE_JOBS.respray;
    return Math.max(0, (this.even - this.runs * R.runPenalty) / this.coat.length);
  }

  /** Call the job done (Enter). */
  finish(): void {
    if (this.done) return;
    this.done = true;
    this.spraying = false;
    this.grade = scoreGrade(this.score);
  }

  update(dt: number): void {
    if (this.done) return;
    if (this.spraying) {
      const R = BALANCE_JOBS.respray;
      for (let j = 0; j < this.rows; j++)
        for (let i = 0; i < this.cols; i++) {
          const dx = (i + 0.5) / this.cols - this.nozzle.x;
          const dy = (j + 0.5) / this.rows - this.nozzle.y;
          const d = Math.hypot(dx * this.cols, dy * this.rows);
          const w = Math.max(0, 1 - d / R.radius);
          if (w > 0)
            this.coat[j * this.cols + i] = (this.coat[j * this.cols + i] as number) + R.rate * w * dt;
        }
    }
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0 || this.covered === 1) this.finish();
  }
}
