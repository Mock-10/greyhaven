// Load / stack (lumberjack logs, delivery crates; docs/06 "Tetris-like packing into a truck bed"). The bed is seen
// from the side: pieces arrive one at a time; move each left and right (and turn a crate), then drop it, and it falls
// until it rests on the floor or on what is already loaded. A piece that won't fit under the roof line is left
// behind. The grade is the share of the load that made it on, with a bonus for time to spare.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export type LoadMode = 'crates' | 'logs';

export interface Piece {
  w: number;
  h: number;
}

export interface Placed extends Piece {
  x: number;
  /** Row of the piece's bottom edge, 0 = the bed floor. */
  y: number;
  /** Index in the queue, so the panel can tell pieces apart. */
  id: number;
}

export class LoadGame implements MinigameLogic {
  readonly cols: number;
  readonly rows: number;
  readonly queue: Piece[];
  readonly placed: Placed[] = [];
  /** Queue indices of the pieces that didn't fit. */
  readonly leftBehind: number[] = [];
  index = 0;
  /** Left column of the piece being placed, and whether it has been turned. */
  x = 0;
  turned = false;
  timeLeft: number;
  readonly timeTotal: number;
  /** The last drop, for a short flash: where it landed, or that it didn't fit. */
  last: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(
    rng: Rng,
    readonly mode: LoadMode = 'crates',
  ) {
    const L = BALANCE_JOBS.load;
    this.cols = L.cols;
    this.rows = L.rows;
    const budget = Math.floor(L.cols * L.rows * L.fill);
    const shapes: readonly (readonly [number, number])[] = L.shapes[mode];
    this.queue = [];
    let cells = 0;
    for (let tries = 0; tries < 200 && cells < budget; tries++) {
      const [w, h] = rng.pick(shapes);
      if (cells + w * h > budget) continue;
      this.queue.push({ w, h });
      cells += w * h;
    }
    this.timeTotal = L.seconds;
    this.timeLeft = L.seconds;
  }

  /** The piece being placed, turned if the player turned it. */
  get current(): Piece | null {
    const p = this.done ? null : this.queue[this.index];
    if (!p) return null;
    return this.turned ? { w: p.h, h: p.w } : p;
  }

  /** The pieces still to come after the current one. */
  get upcoming(): Piece[] {
    return this.queue.slice(this.index + 1);
  }

  get totalCells(): number {
    return this.queue.reduce((n, p) => n + p.w * p.h, 0);
  }

  get loadedCells(): number {
    return this.placed.reduce((n, p) => n + p.w * p.h, 0);
  }

  /** Height of the load in column `c` (rows from the floor to the top of the highest piece there). */
  height(c: number): number {
    let h = 0;
    for (const p of this.placed) if (c >= p.x && c < p.x + p.w) h = Math.max(h, p.y + p.h);
    return h;
  }

  /** Where a piece dropped at column `x` would come to rest (its bottom row), or null if it would stick out. */
  landing(piece: Piece, x: number): number | null {
    let y = 0;
    for (let c = x; c < x + piece.w; c++) y = Math.max(y, this.height(c));
    return y + piece.h <= this.rows ? y : null;
  }

  move(dx: number): void {
    const p = this.current;
    if (!p) return;
    this.x = Math.max(0, Math.min(this.cols - p.w, this.x + dx));
  }

  /** Put the piece at column `x` (the mouse). */
  moveTo(x: number): void {
    const p = this.current;
    if (!p) return;
    this.x = Math.max(0, Math.min(this.cols - p.w, Math.round(x)));
  }

  /** Turn a crate on its side (logs only lie lengthwise). */
  turn(): void {
    const p = this.current;
    if (!p || this.mode === 'logs' || p.w === p.h) return;
    this.turned = !this.turned;
    this.move(0);
  }

  drop(): void {
    const p = this.current;
    if (!p) return;
    const y = this.landing(p, this.x);
    if (y === null) this.leftBehind.push(this.index);
    else this.placed.push({ ...p, x: this.x, y, id: this.index });
    this.last = { ok: y !== null, t: 0 };
    this.index++;
    this.turned = false;
    this.move(0);
    if (this.index >= this.queue.length) this.finish();
  }

  private finish(): void {
    this.done = true;
    // whatever is still in the queue when time runs out stays on the dock
    for (let k = this.index; k < this.queue.length; k++) this.leftBehind.push(k);
    const share = this.loadedCells / this.totalCells;
    const L = BALANCE_JOBS.load;
    if (share >= 1)
      this.grade = this.timeLeft / this.timeTotal >= L.excellentTimeShare ? 'excellent' : 'good';
    else if (share >= 0.8) this.grade = 'ok';
    else if (share >= 0.5) this.grade = 'poor';
    else this.grade = 'fail';
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish();
  }
}
