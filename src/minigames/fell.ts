// Fell direction (lumberjack, docs/03 "aim"): fell each tree into the clear lane between the other trees, the truck
// and the cabin. The aim sweeps back and forth across the lane; Space makes the back cut. The tree's lean and the
// wind push the fall off the aim (both are shown as arrows), so the trick is to aim against them. A few trees per
// task; a tree left too long falls wherever its lean takes it.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';
import { scoreGrade } from './jobGrade';

export type FellResult = 'great' | 'good' | 'ok' | 'miss';

export interface FellTree {
  /** Direction of the clear lane, degrees clockwise from up (screen north). */
  lane: number;
  /** How far the lean and the wind push the fall off the aim, degrees (positive: clockwise). */
  lean: number;
  wind: number;
  /** Where it fell and how it went, once felled. */
  fall: number | null;
  result: FellResult | null;
}

/** The smallest signed difference a − b between two angles, in degrees. */
export function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

export class FellGame implements MinigameLogic {
  readonly trees: FellTree[];
  round = 0;
  /** Aim offset from the lane, degrees; it sweeps between ±sweep. */
  offset: number;
  private dir = 1;
  /** Seconds spent on the current tree. */
  t = 0;
  last: { result: FellResult; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const F = BALANCE_JOBS.fell;
    this.trees = Array.from({ length: F.trees }, () => ({
      lane: rng.int(0, 359),
      lean: rng.range(F.leanMin, F.leanMax) * (rng.chance(0.5) ? 1 : -1),
      wind: rng.range(-F.windMax, F.windMax),
      fall: null,
      result: null,
    }));
    this.offset = rng.range(-F.sweep, F.sweep);
  }

  get tree(): FellTree | null {
    return this.done ? null : (this.trees[this.round] ?? null);
  }

  /** The direction the cut is aimed, degrees. */
  get aim(): number {
    const t = this.tree;
    return t ? (t.lane + this.offset + 360) % 360 : 0;
  }

  /** How a fall `deg` degrees off the lane's centre lands. */
  static judge(deg: number): FellResult {
    const F = BALANCE_JOBS.fell;
    const d = Math.abs(deg);
    return d <= F.great ? 'great' : d <= F.good ? 'good' : d <= F.lane ? 'ok' : 'miss';
  }

  /** Make the back cut: the tree falls along the aim, pushed by its lean and the wind. */
  cut(): void {
    const tr = this.tree;
    if (!tr) return;
    this.fell(tr, this.aim + tr.lean + tr.wind);
  }

  private fell(tr: FellTree, dir: number): void {
    tr.fall = (dir + 360) % 360;
    tr.result = FellGame.judge(angleDiff(tr.fall, tr.lane));
    this.last = { result: tr.result, t: 0 };
    this.round++;
    this.t = 0;
    if (this.round >= this.trees.length) this.finish();
  }

  get score(): number {
    const W = BALANCE_JOBS.fell.worth;
    const pts = this.trees.reduce((n, tr) => n + (tr.result && tr.result !== 'miss' ? W[tr.result] : 0), 0);
    return pts / this.trees.length;
  }

  private finish(): void {
    this.done = true;
    this.grade = scoreGrade(this.score);
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    const tr = this.tree;
    if (!tr) return;
    const F = BALANCE_JOBS.fell;
    let o = this.offset + this.dir * F.aimSpeed * dt;
    while (o > F.sweep || o < -F.sweep) {
      if (o > F.sweep) {
        o = 2 * F.sweep - o;
        this.dir = -1;
      } else {
        o = -2 * F.sweep - o;
        this.dir = 1;
      }
    }
    this.offset = o;
    this.t += dt;
    // left too long, it goes where it leans: off the lane by the lean's full swing
    if (this.t >= F.seconds) this.fell(tr, tr.lane + Math.sign(tr.lean) * F.sweep + tr.lean + tr.wind);
  }
}
