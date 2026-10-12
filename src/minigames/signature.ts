// Signature (delivery, docs/03 "trace"): the customer's signature is drawn faintly on the pad; hold the mouse button
// and trace it. Graded by accuracy: how much of the line the pen covered, times the share of the pen's path that
// stayed on the line. Lifting the pen after drawing ends it, as does the timer.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';
import { scoreGrade } from './jobGrade';

export interface PadPoint {
  x: number;
  y: number;
}

/** Distance from p to the segment ab. */
function segDist(p: PadPoint, a: PadPoint, b: PadPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export class SignatureGame implements MinigameLogic {
  /** The line to trace, left to right; the pad is 1 wide and `aspect` tall. */
  readonly line: PadPoint[];
  readonly aspect: number;
  /** Which points of the line the pen has passed near. */
  readonly covered: boolean[];
  /** The pen's strokes so far (each a list of samples). */
  readonly strokes: PadPoint[][] = [];
  samples = 0;
  onLine = 0;
  penIsDown = false;
  timeLeft: number;
  readonly timeTotal: number;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const S = BALANCE_JOBS.signature;
    this.aspect = S.aspect;
    const waves = Array.from({ length: S.waves }, (_, k) => ({
      f: (k + 1) * rng.range(5, 9),
      p: rng.range(0, Math.PI * 2),
      a: S.amplitude / (k + 1),
    }));
    this.line = Array.from({ length: S.points }, (_, k) => {
      const x = 0.08 + (0.84 * k) / (S.points - 1);
      const y = S.aspect / 2 + waves.reduce((v, w) => v + w.a * Math.sin(w.f * x + w.p), 0);
      return { x, y: Math.max(0.03, Math.min(S.aspect - 0.03, y)) };
    });
    this.covered = this.line.map(() => false);
    this.timeTotal = S.seconds;
    this.timeLeft = S.seconds;
  }

  /** Distance from p to the line. */
  distance(p: PadPoint): number {
    let d = Infinity;
    for (let k = 1; k < this.line.length; k++)
      d = Math.min(d, segDist(p, this.line[k - 1] as PadPoint, this.line[k] as PadPoint));
    return d;
  }

  get coverage(): number {
    return this.covered.filter(Boolean).length / this.covered.length;
  }

  /** Share of the pen's samples that stayed on the line. */
  get accuracy(): number {
    return this.samples ? this.onLine / this.samples : 0;
  }

  get score(): number {
    return this.coverage * this.accuracy;
  }

  penDown(x: number, y: number): void {
    if (this.done) return;
    this.penIsDown = true;
    this.strokes.push([]);
    this.penMove(x, y);
  }

  penMove(x: number, y: number): void {
    if (this.done || !this.penIsDown) return;
    const p = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(this.aspect, y)) };
    const stroke = this.strokes[this.strokes.length - 1] as PadPoint[];
    // fill in fast strokes so a quick flick still covers the line it crossed
    const prev = stroke[stroke.length - 1];
    const tol = BALANCE_JOBS.signature.tolerance;
    const steps = prev ? Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / (tol / 2))) : 1;
    for (let k = 1; k <= steps; k++) {
      const q = prev
        ? { x: prev.x + ((p.x - prev.x) * k) / steps, y: prev.y + ((p.y - prev.y) * k) / steps }
        : p;
      this.sample(q);
    }
    stroke.push(p);
  }

  private sample(p: PadPoint): void {
    const tol = BALANCE_JOBS.signature.tolerance;
    this.samples++;
    if (this.distance(p) <= tol) this.onLine++;
    this.line.forEach((l, k) => {
      if (!this.covered[k] && Math.hypot(l.x - p.x, l.y - p.y) <= tol) this.covered[k] = true;
    });
  }

  /** Lift the pen: once something is drawn, that's the signature. */
  penUp(): void {
    if (this.done || !this.penIsDown) return;
    this.penIsDown = false;
    if (this.samples > 0) this.finish();
  }

  private finish(): void {
    this.done = true;
    this.penIsDown = false;
    this.grade = scoreGrade(this.score);
  }

  update(dt: number): void {
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish();
  }
}
