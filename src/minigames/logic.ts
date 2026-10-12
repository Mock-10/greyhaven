// Minigame rules (docs/06), kept apart from drawing and input so they can be tested. Every minigame
// ends in a grade: fail, poor, ok, good or excellent. Job tasks pause the world; crime minigames don't.

import { BALANCE } from '../config/balance';
import { glints, type LootItem } from '../systems/loot';
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
    /** docs/06 tool tolerance: basic tools widen the zones by 15%; pro tools by 30% and one check fewer. */
    tool: 'none' | 'basic' | 'pro' = 'none',
  ) {
    const t = BALANCE.minigames.skillTiers[tier] ?? BALANCE.minigames.skillTiers[0]!;
    const T = BALANCE.minigames.tools;
    const widen = tool === 'pro' ? T.proWiden : tool === 'basic' ? T.basicWiden : 0;
    this.speed = t.speed;
    this.good = t.good * (1 + widen);
    this.great = t.great * (1 + widen);
    this.checks = Math.max(1, t.checks - (tool === 'pro' ? T.proFewerChecks : 0));
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

  /** `bonusSeconds`: extra time from a toolbox (the basic hotwiring tool). */
  constructor(rng: Rng, bonusSeconds = 0) {
    const H = BALANCE.minigames.hotwire;
    this.left = WIRE_COLOURS.slice(0, H.pairs) as WireColour[];
    this.right = rng.shuffle([...this.left]);
    this.connected = this.left.map(() => false);
    this.timeTotal = H.seconds + bonusSeconds;
    this.timeLeft = H.seconds + bonusSeconds;
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

// ------------------------------------------------------------------ duffel (Dez's laundering, decided 2026-10-11)
export interface CashStack {
  /** Slot on the table, 0-based (row-major). */
  slot: number;
  /** Dye-stained by a bank dye pack: Dez won't take it, so it must stay out of the bag. */
  dyed: boolean;
  bagged: boolean;
}

/**
 * Bag the cash (replaces the money count for laundering): drag every clean stack off the table into Dez's duffel
 * before the timer runs out, and leave the dye-stained stacks out. Mouse only.
 */
export class DuffelGame implements MinigameLogic {
  readonly stacks: CashStack[];
  timeLeft: number;
  readonly timeTotal: number;
  /** Dyed stacks that went into the bag by mistake. */
  dyedBagged = 0;
  /** Feedback for the last stack dropped in the bag. */
  flash: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const D = BALANCE.minigames.duffel;
    const dyed = new Set(rng.shuffle([...Array(D.stacks).keys()]).slice(0, D.dyed));
    this.stacks = [...Array(D.stacks).keys()].map((slot) => ({ slot, dyed: dyed.has(slot), bagged: false }));
    this.timeTotal = D.seconds;
    this.timeLeft = D.seconds;
  }

  get cleanTotal(): number {
    return this.stacks.filter((s) => !s.dyed).length;
  }

  get cleanBagged(): number {
    return this.stacks.filter((s) => !s.dyed && s.bagged).length;
  }

  /** Drop the stack in table slot `slot` into the bag. */
  bag(slot: number): void {
    const s = this.stacks[slot];
    if (this.done || !s || s.bagged) return;
    s.bagged = true;
    if (s.dyed) this.dyedBagged++;
    this.flash = { ok: !s.dyed, t: 0 };
    if (this.cleanBagged === this.cleanTotal) this.finish();
  }

  private finish(): void {
    this.done = true;
    const share = this.cleanBagged / this.cleanTotal;
    if (share === 1 && this.dyedBagged === 0)
      this.grade =
        this.timeLeft / this.timeTotal > BALANCE.minigames.duffel.excellentTimeShare ? 'excellent' : 'good';
    else if (share >= 0.75 && this.dyedBagged <= 1) this.grade = 'ok';
    else if (share >= 0.5) this.grade = 'poor';
    else this.grade = 'fail';
  }

  update(dt: number): void {
    if (this.flash) this.flash.t += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish();
  }
}

/** One grid cell of the search panel. */
export interface SearchCell {
  item: LootItem | null;
  grabbed: boolean;
}

/**
 * Search (docs/06 "Register grab / search"): click the glinting items in a grid before the timer runs out; gold
 * items are worth more. Used by trunk looting now, and by robberies and burglary later. The grade comes from the
 * share of valuables grabbed and the time left.
 */
export class SearchGame implements MinigameLogic {
  readonly cells: SearchCell[];
  readonly cols: number;
  readonly rows: number;
  timeLeft: number;
  readonly timeTotal: number;
  /** Keyboard cursor (arrows + Space). */
  cursor = 0;
  flash: { cell: number; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng, items: readonly LootItem[]) {
    const S = BALANCE.minigames.search;
    this.cols = S.cols;
    this.rows = S.rows;
    const n = S.cols * S.rows;
    const spots = rng.shuffle([...Array(n).keys()]).slice(0, Math.min(n, items.length));
    this.cells = [...Array(n).keys()].map(() => ({ item: null, grabbed: false }));
    spots.forEach((c, k) => {
      (this.cells[c] as SearchCell).item = items[k] ?? null;
    });
    this.timeTotal = S.seconds;
    this.timeLeft = S.seconds;
  }

  get valuables(): number {
    return this.cells.filter((c) => c.item && glints(c.item.kind)).length;
  }

  get taken(): number {
    return this.cells.filter((c) => c.grabbed && c.item && glints(c.item.kind)).length;
  }

  /** What was grabbed (junk included: it's worthless). */
  get haul(): LootItem[] {
    return this.cells.filter((c) => c.grabbed && c.item).map((c) => c.item as LootItem);
  }

  grab(cell: number): void {
    const c = this.cells[cell];
    if (this.done || !c || c.grabbed || !c.item) return;
    c.grabbed = true;
    this.cursor = cell;
    this.flash = { cell, t: 0 };
    if (this.taken === this.valuables) this.finish();
  }

  move(dx: number, dy: number): void {
    const x = (this.cursor % this.cols) + dx;
    const y = Math.floor(this.cursor / this.cols) + dy;
    this.cursor = ((y + this.rows) % this.rows) * this.cols + ((x + this.cols) % this.cols);
  }

  private finish(): void {
    this.done = true;
    const share = this.valuables ? this.taken / this.valuables : 1;
    if (share === 1)
      this.grade =
        this.timeLeft / this.timeTotal > BALANCE.minigames.search.excellentTimeShare ? 'excellent' : 'good';
    else if (share >= 0.66) this.grade = 'ok';
    else if (share > 0) this.grade = 'poor';
    else this.grade = 'fail';
  }

  update(dt: number): void {
    if (this.flash) this.flash.t += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.finish();
  }
}
