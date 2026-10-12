// Car wash (weekend odd job at Squeaky's, docs/02): scrub the side of a customer's car clean before the next one
// rolls in. The side is a grid of cells holding dirt: mud patches one or two coats deep, and a few stubborn spots
// (tar, bird droppings) that take longer. Aim the sponge with the mouse (or move it with WASD / the arrows) and hold
// to scrub. Scrubbing uses up the sponge's suds; a dry sponge only smears, so dunk it in the bucket now and then,
// which costs a moment. It ends when every cell is clean or the time runs out.

import { BALANCE_ODD } from '../config/balanceOdd';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export type SpotKind = 'tar' | 'bird';

export class CarWashGame implements MinigameLogic {
  readonly cols: number;
  readonly rows: number;
  /** Coats of dirt per cell, row-major. */
  readonly dirt: number[];
  /** Cells that are on the car (the cabin is narrower than the body); the rest is sky. */
  readonly body: boolean[];
  /** The stubborn spot in each cell, if any (for the picture). */
  readonly spot: (SpotKind | null)[];
  /** Cells that started dirty. */
  readonly dirtyCells: number;
  /** Sponge position over the car's side, 0–1 on each axis. */
  sponge = { x: 0.5, y: 0.5 };
  scrubbing = false;
  /** Suds left in the sponge, 0–1. */
  suds = 1;
  /** Seconds left of a dunk in the bucket (the sponge can't scrub meanwhile). */
  dunking = 0;
  dunks = 0;
  timeLeft: number;
  readonly timeTotal: number;
  done = false;
  grade: Grade | null = null;

  /** `car` is the car's index in the gig (0-based): each later car is a little muddier. */
  constructor(rng: Rng, car = 0) {
    const W = BALANCE_ODD.carWash;
    this.cols = W.cols;
    this.rows = W.rows;
    this.dirt = Array<number>(W.cols * W.rows).fill(0);
    this.spot = Array<SpotKind | null>(W.cols * W.rows).fill(null);
    this.body = this.dirt.map((_, k) => {
      const i = k % W.cols;
      const j = Math.floor(k / W.cols);
      return (
        j >= W.cabin.rows || (i >= Math.round(W.cabin.from * W.cols) && i < Math.round(W.cabin.to * W.cols))
      );
    });
    this.timeTotal = W.seconds;
    this.timeLeft = W.seconds;
    // mud patches, splashed up from the road: more of them low on the body
    for (let p = 0; p < W.patches + car; p++) {
      const cx = rng.range(0, W.cols);
      const cy = rng.range(W.rows * 0.3, W.rows);
      const r = W.patchRadius * rng.range(0.8, 1.2);
      for (let j = 0; j < W.rows; j++)
        for (let i = 0; i < W.cols; i++) {
          const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
          if (d > r) continue;
          const k = j * W.cols + i;
          if (!this.body[k]) continue;
          this.dirt[k] = Math.max(this.dirt[k] as number, d < r * 0.5 ? 2 : 1);
        }
    }
    // stubborn spots: tar low down, bird droppings on the roof and windows, never on the same cell twice
    for (let n = 0; n < W.spots; n++) {
      const kind: SpotKind = n % 2 === 0 ? 'bird' : 'tar';
      for (let tries = 0; tries < 20; tries++) {
        const i = rng.int(0, W.cols - 1);
        const j = kind === 'bird' ? rng.int(0, W.cabin.rows - 1) : rng.int(W.rows - 2, W.rows - 1);
        const k = j * W.cols + i;
        if (this.spot[k] || !this.body[k]) continue;
        this.spot[k] = kind;
        this.dirt[k] = W.stubborn;
        break;
      }
    }
    this.dirtyCells = this.dirt.filter((d) => d > W.cleanAt).length;
  }

  /** Point the sponge at (x, y), 0–1 over the car's side (the mouse). */
  aim(x: number, y: number): void {
    this.sponge = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  /** Move the sponge (WASD / arrows): dx, dy in −1..1 for `dt` seconds. */
  move(dx: number, dy: number, dt: number): void {
    const v = BALANCE_ODD.carWash.spongeSpeed * dt;
    // the side is wider than tall: move the same distance on screen both ways
    this.aim(this.sponge.x + dx * v, this.sponge.y + dy * v * (this.cols / this.rows));
  }

  scrub(on: boolean): void {
    this.scrubbing = on && !this.done;
  }

  /** Dunk the sponge in the bucket: full suds after a moment. */
  dunk(): void {
    if (this.done || this.dunking > 0) return;
    this.dunking = BALANCE_ODD.carWash.dunkTime;
    this.dunks++;
  }

  /** The sponge is dry: scrubbing does nothing until it is dunked. */
  get dry(): boolean {
    return this.suds <= 0;
  }

  isClean(k: number): boolean {
    return (this.dirt[k] as number) <= BALANCE_ODD.carWash.cleanAt;
  }

  /** Cells that are still dirty. */
  get dirtyLeft(): number {
    let n = 0;
    for (let k = 0; k < this.dirt.length; k++) if (!this.isClean(k)) n++;
    return n;
  }

  /** Share of the dirty cells scrubbed clean, 0–1. */
  get cleaned(): number {
    return this.dirtyCells ? 1 - this.dirtyLeft / this.dirtyCells : 1;
  }

  /** Call the car done (Enter), or the time ran out. */
  finish(): void {
    if (this.done) return;
    const W = BALANCE_ODD.carWash;
    this.done = true;
    this.scrubbing = false;
    const c = this.cleaned;
    if (c >= 1) this.grade = this.timeLeft / this.timeTotal >= W.excellentTimeShare ? 'excellent' : 'good';
    else if (c >= W.okShare) this.grade = 'ok';
    else if (c >= W.poorShare) this.grade = 'poor';
    else this.grade = 'fail';
  }

  update(dt: number): void {
    if (this.done) return;
    const W = BALANCE_ODD.carWash;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.dunking > 0) {
      this.dunking = Math.max(0, this.dunking - dt);
      if (this.dunking === 0) this.suds = 1;
    } else if (this.scrubbing && this.suds > 0) {
      for (let j = 0; j < this.rows; j++)
        for (let i = 0; i < this.cols; i++) {
          const dx = (i + 0.5) / this.cols - this.sponge.x;
          const dy = (j + 0.5) / this.rows - this.sponge.y;
          const w = Math.max(0, 1 - Math.hypot(dx * this.cols, dy * this.rows) / W.radius);
          const k = j * this.cols + i;
          if (w > 0) this.dirt[k] = Math.max(0, (this.dirt[k] as number) - W.rate * w * dt);
        }
      this.suds = Math.max(0, this.suds - W.sudsUse * dt);
    }
    if (this.dirtyLeft === 0 || this.timeLeft === 0) this.finish();
  }
}
