// Minigame rules (docs/06), kept apart from drawing and input so they can be tested. Every minigame
// ends in a grade: fail, poor, ok, good or excellent. Job tasks pause the world; crime minigames don't.

import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';

export interface MinigameLogic {
  readonly done: boolean;
  readonly grade: Grade | null;
  update(dt: number): void;
}

function gradeFor(ratio: number): Grade {
  if (ratio >= 0.95) return 'excellent';
  if (ratio >= 0.8) return 'good';
  if (ratio >= 0.55) return 'ok';
  return 'poor';
}

// ------------------------------------------------------------------ filing
export const TRAY_COLOURS = ['red', 'navy', 'sage'] as const;
export type TrayColour = (typeof TRAY_COLOURS)[number];

/**
 * Filing (office): papers drop in one at a time; file each in the tray of its colour (keys 1–3 or a
 * click) before it reaches the bottom. Each paper falls faster than the last.
 */
export class FilingGame implements MinigameLogic {
  readonly papers: TrayColour[];
  index = 0;
  /** Fall progress of the current paper, 0 (top) to 1 (lands: missed). */
  fall = 0;
  correct = 0;
  misfiled = 0;
  missed = 0;
  /** Feedback for the last paper: which tray and whether it was right, for a short flash. */
  last: { tray: number; ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const n = BALANCE.minigames.filing.papers;
    this.papers = Array.from({ length: n }, () => rng.pick(TRAY_COLOURS));
  }

  get current(): TrayColour | null {
    return this.done ? null : (this.papers[this.index] ?? null);
  }

  /** Fall speed (fraction of the drop per second) for paper k. */
  speed(k: number): number {
    const F = BALANCE.minigames.filing;
    return (F.startFall + F.fallAccel * k) / 100;
  }

  file(tray: number): void {
    if (this.done) return;
    const ok = TRAY_COLOURS[tray] === this.current;
    if (ok) this.correct++;
    else this.misfiled++;
    this.last = { tray, ok, t: 0 };
    this.next();
  }

  private next(): void {
    this.index++;
    this.fall = 0;
    if (this.index >= this.papers.length) this.finish();
  }

  private finish(): void {
    this.done = true;
    const F = BALANCE.minigames.filing;
    const score = Math.max(0, this.correct - this.misfiled * F.misfilePenalty);
    this.grade = gradeFor(score / this.papers.length);
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    this.fall += this.speed(this.index) * dt;
    if (this.fall >= 1) {
      this.missed++;
      this.last = null;
      this.next();
    }
  }
}

// ------------------------------------------------------------------ data entry
const KEYS = 'ASDFJKLWERUIO';

/** Data entry (office): type short key sequences shown on screen before the time runs out. */
export class DataEntryGame implements MinigameLogic {
  readonly rounds: string[];
  round = 0;
  pos = 0;
  errors = 0;
  timeLeft: number;
  readonly timeTotal: number;
  /** Seconds since the last wrong key, for a red flash. */
  wrongT = 99;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const E = BALANCE.minigames.dataEntry;
    this.rounds = Array.from({ length: E.rounds }, () =>
      Array.from({ length: E.length }, () => rng.pick([...KEYS])).join(''),
    );
    this.timeTotal = E.seconds;
    this.timeLeft = E.seconds;
  }

  get word(): string {
    return this.rounds[this.round] ?? '';
  }

  key(k: string): void {
    if (this.done) return;
    if (k.toUpperCase() === this.word[this.pos]) {
      this.pos++;
      if (this.pos >= this.word.length) {
        this.round++;
        this.pos = 0;
        if (this.round >= this.rounds.length) this.finish(true);
      }
    } else {
      this.errors++;
      this.wrongT = 0;
    }
  }

  private finish(completed: boolean): void {
    this.done = true;
    if (!completed) {
      const typed = this.round * this.word.length + this.pos;
      const total = this.rounds.length * (this.rounds[0]?.length ?? 1);
      this.grade = typed / total >= 0.6 ? 'poor' : 'fail';
      return;
    }
    const spare = this.timeLeft / this.timeTotal;
    if (this.errors === 0 && spare >= 0.35) this.grade = 'excellent';
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
