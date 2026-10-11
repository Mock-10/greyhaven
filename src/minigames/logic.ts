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

// ------------------------------------------------------------------ core skill check (lockpick)
/**
 * docs/06 core skill check: a needle sweeps the dial; press Space while it is inside the zone. The great zone
 * gives a speed bonus, the good zone counts, a miss knocks progress back and makes noise. Tier sets the speed,
 * zone widths and number of checks.
 */
export class SkillCheckGame implements MinigameLogic {
  readonly speed: number;
  readonly good: number;
  readonly great: number;
  readonly checks: number;
  /** Needle angle in degrees, 0 at the top, clockwise. */
  needle = 0;
  /** Centre of the current zone, degrees. */
  zone = 0;
  passed = 0;
  greats = 0;
  misses = 0;
  /** Noise level 0–1 (docs/11 noise meter). */
  noise = 0;
  flash: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(
    private rng: Rng,
    tier = 0,
    private maxMisses = BALANCE.minigames.lockpick.maxMisses,
  ) {
    const t = BALANCE.minigames.skillTiers[tier] ?? BALANCE.minigames.skillTiers[0]!;
    this.speed = t.speed;
    this.good = t.good;
    this.great = t.great;
    this.checks = t.checks;
    this.newZone();
  }

  private newZone(): void {
    // keep the zone away from the needle so the player has time to react
    this.zone = (this.needle + 120 + this.rng.next() * 180) % 360;
  }

  get progress(): number {
    return this.passed / this.checks;
  }

  hit(): void {
    if (this.done) return;
    const d = Math.abs(((this.needle - this.zone + 540) % 360) - 180);
    if (d <= this.great / 2) {
      this.passed++;
      this.greats++;
      this.flash = { ok: true, t: 0 };
    } else if (d <= this.good / 2) {
      this.passed++;
      this.flash = { ok: true, t: 0 };
    } else {
      this.misses++;
      this.noise = Math.min(1, this.noise + 1 / this.maxMisses);
      this.flash = { ok: false, t: 0 };
    }
    if (this.passed >= this.checks) this.finish(true);
    else if (this.misses >= this.maxMisses) this.finish(false);
    else this.newZone();
  }

  private finish(ok: boolean): void {
    this.done = true;
    if (!ok) this.grade = 'fail';
    else if (this.misses === 0) this.grade = this.greats >= this.checks ? 'excellent' : 'good';
    else this.grade = this.misses === 1 ? 'ok' : 'poor';
  }

  update(dt: number): void {
    if (this.flash) this.flash.t += dt;
    if (this.done) return;
    this.needle = (this.needle + this.speed * 360 * dt) % 360;
  }
}

// ------------------------------------------------------------------ hotwire
export const WIRE_COLOURS = ['red', 'navy', 'sage', 'khaki', 'white'] as const;
export type WireColour = (typeof WIRE_COLOURS)[number];

/** Hotwire (docs/06): connect each wire on the left to the matching one on the right; a wrong pair sparks. */
export class HotwireGame implements MinigameLogic {
  readonly left: WireColour[];
  readonly right: WireColour[];
  readonly connected: boolean[];
  selected: number | null = null;
  sparks = 0;
  sparkT = 99;
  timeLeft: number;
  readonly timeTotal: number;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const H = BALANCE.minigames.hotwire;
    this.left = WIRE_COLOURS.slice(0, H.pairs) as WireColour[];
    this.right = rng.shuffle([...this.left]);
    this.connected = this.left.map(() => false);
    this.timeTotal = H.seconds;
    this.timeLeft = H.seconds;
  }

  /** Pick a left wire (0-based). */
  pickLeft(k: number): void {
    if (this.done || k < 0 || k >= this.left.length || this.connected[k]) return;
    this.selected = k;
  }

  /** Touch it to a right terminal (0-based). */
  pickRight(k: number): void {
    if (this.done || this.selected === null || k < 0 || k >= this.right.length) return;
    if (this.right[k] === this.left[this.selected]) {
      this.connected[this.selected] = true;
      this.selected = null;
      if (this.connected.every(Boolean)) this.finish(true);
    } else {
      this.sparks++;
      this.sparkT = 0;
      this.selected = null;
      if (this.sparks >= BALANCE.minigames.hotwire.maxSparks) this.finish(false);
    }
  }

  private finish(ok: boolean): void {
    this.done = true;
    if (!ok) {
      this.grade = 'fail';
      return;
    }
    const spare = this.timeLeft / this.timeTotal;
    this.grade = this.sparks === 0 ? (spare > 0.4 ? 'excellent' : 'good') : this.sparks === 1 ? 'ok' : 'poor';
  }

  update(dt: number): void {
    this.sparkT += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish(false);
  }
}

// ------------------------------------------------------------------ money count
/** Money count (docs/06): Space counts a bill onto the pile; B bands a bundle, which must hold exactly 10. */
export class MoneyCountGame implements MinigameLogic {
  readonly bills: number;
  counted = 0;
  pile = 0;
  bundles = 0;
  miscounts = 0;
  timeLeft: number;
  readonly timeTotal: number;
  flash: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor() {
    const M = BALANCE.minigames.moneyCount;
    this.bills = M.bills;
    this.timeTotal = M.seconds;
    this.timeLeft = M.seconds;
  }

  count(): void {
    if (this.done || this.counted >= this.bills) return;
    this.counted++;
    this.pile++;
  }

  band(): void {
    if (this.done || this.pile === 0) return;
    const ok = this.pile === 10;
    if (ok) this.bundles++;
    else this.miscounts++;
    this.flash = { ok, t: 0 };
    this.pile = 0;
    if (this.counted >= this.bills) this.finish();
  }

  private finish(): void {
    this.done = true;
    const target = this.bills / 10;
    if (this.bundles === 0) this.grade = 'fail';
    else if (this.miscounts === 0 && this.bundles === target)
      this.grade = this.timeLeft / this.timeTotal > 0.3 ? 'excellent' : 'good';
    else if (this.miscounts <= 1) this.grade = 'ok';
    else this.grade = 'poor';
  }

  update(dt: number): void {
    if (this.flash) this.flash.t += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish();
  }
}
