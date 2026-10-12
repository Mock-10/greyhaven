// Bar shift (weekend odd job at The Low Tide, docs/02: "pour drinks"). Patrons take the stools at the counter one
// after another and order a lager, a stout or a cider. Pick the tap (1–3 or a click) and hold Space (or the mouse)
// to pour; let go when the glass reaches the line. A pour goes to the patron who has waited longest for that drink.
// Stop near the line for a clean pour, short of it for a short one; hold too long and it runs over, is wasted and
// needs mopping. Patrons who wait too long walk out. The rush ends when every patron is served or gone.

import { BALANCE_ODD } from '../config/balanceOdd';
import type { Rng } from '../core/rng';
import { DRINKS } from '../data/oddJobs';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export type PourResult = 'perfect' | 'fine' | 'short';

export interface Patron {
  /** Index into DRINKS. */
  drink: number;
  /** Seconds into the rush when they come in. */
  arrive: number;
  /** Their stool, once seated. */
  seat: number | null;
  /** Seconds into the rush when they got a stool, and seconds waited on it since. */
  seatedAt: number;
  waited: number;
  /** How they left: served with a pour result, or 'missed' (walked out). Null while still here or not yet in. */
  result: PourResult | 'missed' | null;
}

export type BarFlash =
  | { kind: PourResult | 'missed'; seat: number; t: number }
  | { kind: 'spill' | 'wrong'; tap: number; t: number };

export class BarShiftGame implements MinigameLogic {
  readonly patrons: Patron[];
  /** Seconds since the rush began. */
  t = 0;
  /** The tap the glass is under (index into DRINKS). */
  tap = 0;
  pouring = false;
  /** How full the glass under the tap is, 0–1 (past `spill` it runs over). */
  fill = 0;
  /** Seconds before the next glass can go under a tap. */
  cooldown = 0;
  spills = 0;
  wrong = 0;
  last: BarFlash | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const B = BALANCE_ODD.barShift;
    // every drink is ordered at least once a rush; the rest are random
    const drinks = DRINKS.map((_, k) => k);
    while (drinks.length < B.patrons) drinks.push(rng.int(0, DRINKS.length - 1));
    rng.shuffle(drinks);
    this.patrons = drinks.map((drink, k) => ({
      drink,
      arrive: k * B.gap,
      seat: null,
      seatedAt: 0,
      waited: 0,
      result: null,
    }));
  }

  /** Patrons on a stool, still waiting for their drink. */
  get waiting(): Patron[] {
    return this.patrons.filter((p) => p.seat !== null && p.result === null);
  }

  /** The patron on a stool, if they're still waiting. */
  atSeat(seat: number): Patron | null {
    return this.patrons.find((p) => p.seat === seat && p.result === null) ?? null;
  }

  /** Patrons who are in but haven't found a free stool yet. */
  get queued(): number {
    return this.patrons.filter((p) => p.seat === null && p.result === null && p.arrive <= this.t).length;
  }

  get served(): number {
    return this.patrons.filter((p) => p.result !== null && p.result !== 'missed').length;
  }

  get missed(): number {
    return this.patrons.filter((p) => p.result === 'missed').length;
  }

  /** Share of a perfect rush so far, 0–1. */
  get score(): number {
    const S = BALANCE_ODD.barShift.score;
    const sum = this.patrons.reduce((s, p) => s + (p.result ? S[p.result] : 0), 0);
    return sum / this.patrons.length;
  }

  /** Put the glass under a tap (keys 1–3, or a click on the tap). Not while pouring. */
  select(tap: number): void {
    if (this.done || this.pouring || tap < 0 || tap >= DRINKS.length) return;
    this.tap = tap;
  }

  /** Open (true) or close (false) the tap. Closing it serves the glass. */
  pour(on: boolean): void {
    if (this.done) return;
    if (on) {
      if (this.cooldown > 0 || this.pouring) return;
      this.pouring = true;
      this.fill = 0;
      return;
    }
    if (!this.pouring) return;
    this.pouring = false;
    this.serve();
  }

  /** How a glass filled to `fill` counts. */
  static judge(fill: number): PourResult {
    const B = BALANCE_ODD.barShift;
    const d = Math.abs(fill - B.line);
    return d <= B.great ? 'perfect' : d <= B.good ? 'fine' : 'short';
  }

  private serve(): void {
    const B = BALANCE_ODD.barShift;
    const fill = this.fill;
    this.fill = 0;
    this.cooldown = B.serveTime;
    if (fill <= 0) return;
    let who: Patron | null = null;
    for (const p of this.waiting) if (p.drink === this.tap && (!who || p.waited > who.waited)) who = p;
    if (!who) {
      this.wrong++;
      this.last = { kind: 'wrong', tap: this.tap, t: 0 };
      return;
    }
    who.result = BarShiftGame.judge(fill);
    this.last = { kind: who.result, seat: who.seat as number, t: 0 };
    this.checkEnd();
  }

  private checkEnd(): void {
    if (this.patrons.every((p) => p.result !== null)) this.finish();
  }

  /** The rush is over (every patron served or gone), or Esc. */
  finish(): void {
    if (this.done) return;
    const G = BALANCE_ODD.grades;
    this.done = true;
    this.pouring = false;
    for (const p of this.patrons) if (p.result === null) p.result = 'missed';
    const r = this.score;
    this.grade =
      r >= G.excellent
        ? 'excellent'
        : r >= G.good
          ? 'good'
          : r >= G.ok
            ? 'ok'
            : r >= G.poor
              ? 'poor'
              : 'fail';
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    const B = BALANCE_ODD.barShift;
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // seat whoever is in and waiting, in the order they came in
    for (const p of this.patrons) {
      if (p.seat !== null || p.result !== null || p.arrive > this.t) continue;
      const free = Array.from({ length: B.seats }, (_, k) => k).find((k) => !this.atSeat(k));
      if (free === undefined) break;
      p.seat = free;
      // a stool that came free during this step was free from its start (one step of slack, never more)
      p.seatedAt = Math.max(p.arrive, this.t - dt);
    }
    for (const p of this.waiting) {
      p.waited = this.t - p.seatedAt;
      if (p.waited >= B.patience) {
        p.result = 'missed';
        this.last = { kind: 'missed', seat: p.seat as number, t: 0 };
      }
    }
    if (this.pouring) {
      this.fill += (DRINKS[this.tap]?.rate ?? 0) * dt;
      if (this.fill > B.spill) {
        this.pouring = false;
        this.fill = 0;
        this.spills++;
        this.cooldown = B.spillTime;
        this.last = { kind: 'spill', tap: this.tap, t: 0 };
      }
    }
    this.checkEnd();
  }
}
