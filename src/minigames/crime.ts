// The Phase 3 crime minigames (docs/06): intimidate, safe crack, ATM hack, ATM drill, wipe footage and the alarm
// bypass. Rules only, kept apart from drawing and input so they can be tested; each ends in a grade. Numbers live in
// config/balanceCrime.ts (`minigames`).

import { BALANCE_CRIME } from '../config/balanceCrime';
import type { Rng } from '../core/rng';
import type { Grade } from '../systems/career';
import { WIRE_COLOURS, type MinigameLogic, type WireColour } from './logic';

const M = () => BALANCE_CRIME.minigames;

function gradeFor(ratio: number): Grade {
  if (ratio >= 0.95) return 'excellent';
  if (ratio >= 0.8) return 'good';
  if (ratio >= 0.55) return 'ok';
  return 'poor';
}

// ------------------------------------------------------------------ intimidate
/**
 * Intimidate (store clerk): hold to press. The clerk's nerve rises while you press and falls when you ease off,
 * and wanders on its own. Keep it in the band long enough: too low and they stall, too high and they hit the alarm.
 */
export class IntimidateGame implements MinigameLogic {
  nerve: number;
  inBand = 0;
  t = 0;
  holding = false;
  private drift = 0;
  private wobbleT = 0;
  done = false;
  grade: Grade | null = null;

  constructor(private rng: Rng) {
    this.nerve = M().intimidate.start;
    this.newDrift();
  }

  private newDrift(): void {
    const I = M().intimidate;
    this.drift = (this.rng.next() * 2 - 1) * I.drift;
    this.wobbleT = I.wobble;
  }

  get band(): readonly [number, number] {
    return M().intimidate.band;
  }

  get alarmAt(): number {
    return M().intimidate.alarmAt;
  }

  get progress(): number {
    return Math.min(1, this.inBand / M().intimidate.need);
  }

  get timeLeft(): number {
    return Math.max(0, M().intimidate.seconds - this.t);
  }

  hold(on: boolean): void {
    this.holding = on;
  }

  update(dt: number): void {
    if (this.done) return;
    const I = M().intimidate;
    this.t += dt;
    this.wobbleT -= dt;
    if (this.wobbleT <= 0) this.newDrift();
    this.nerve += ((this.holding ? I.rise : -I.fall) + this.drift) * dt;
    this.nerve = Math.max(0, this.nerve);
    if (this.nerve >= I.alarmAt) return this.end('fail');
    if (this.nerve >= I.band[0] && this.nerve <= I.band[1]) this.inBand += dt;
    if (this.inBand >= I.need) return this.end(gradeFor(Math.min(1, (I.need * 1.6) / this.t)));
    if (this.t >= I.seconds) this.end(this.inBand >= I.need / 2 ? 'poor' : 'fail');
  }

  private end(g: Grade): void {
    this.done = true;
    this.grade = g;
  }
}

// ------------------------------------------------------------------ safe crack
/** Safe crack: turn the dial and set each number when it clicks (the pulse). A wrong set is a miss. */
export class SafeCrackGame implements MinigameLogic {
  readonly targets: number[];
  readonly window: number;
  dial = 0;
  set = 0;
  misses = 0;
  t = 0;
  flash: { ok: boolean; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng, tier = 0, stethoscope = false) {
    const S = M().safeCrack;
    this.window = S.window * (stethoscope ? S.stethoscope : 1);
    this.targets = [];
    for (let k = 0; k < S.numbers + tier; k++) this.targets.push(rng.int(0, 99));
    this.dial = rng.int(0, 99);
  }

  /** Distance from the dial to the current number, around the dial. */
  get off(): number {
    const tgt = this.targets[this.set] ?? 0;
    const d = Math.abs(this.dial - tgt) % 100;
    return Math.min(d, 100 - d);
  }

  /** The click: the dial is on the number. */
  get clicking(): boolean {
    return !this.done && this.off <= this.window;
  }

  get timeLeft(): number {
    return Math.max(0, M().safeCrack.seconds - this.t);
  }

  turn(dir: number, dt: number): void {
    if (this.done || dir === 0) return;
    this.dial = (((this.dial + dir * M().safeCrack.turnSpeed * dt) % 100) + 100) % 100;
  }

  /** Set the number under the dial. */
  press(): void {
    if (this.done) return;
    if (this.clicking) {
      this.set++;
      this.flash = { ok: true, t: 0 };
      if (this.set >= this.targets.length) this.finish();
    } else {
      this.misses++;
      this.flash = { ok: false, t: 0 };
      if (this.misses >= M().safeCrack.maxMisses) this.end('fail');
    }
  }

  private finish(): void {
    const fast = this.t <= M().safeCrack.seconds / 2;
    this.end(this.misses === 0 ? (fast ? 'excellent' : 'good') : this.misses === 1 ? 'ok' : 'poor');
  }

  private end(g: Grade): void {
    this.done = true;
    this.grade = g;
  }

  update(dt: number): void {
    if (this.flash) this.flash.t += dt;
    if (this.done) return;
    this.t += dt;
    if (this.t >= M().safeCrack.seconds) this.end('fail');
  }
}

// ------------------------------------------------------------------ ATM hack
export type Arrow = 'up' | 'right' | 'down' | 'left';
export const ARROW_LIST: readonly Arrow[] = ['up', 'right', 'down', 'left'];

/** ATM hack (Simon): watch the arrow sequence, then repeat it. Each round is longer; a wrong arrow ends it. */
export class AtmHackGame implements MinigameLogic {
  readonly sequence: Arrow[];
  round = 0;
  /** Arrows entered this round. */
  entered = 0;
  /** Seconds into the current show (while the sequence plays), or null while the player types. */
  showT: number | null = 0;
  inputT = 0;
  wrong: Arrow | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const R = M().atmHack.rounds;
    this.sequence = [];
    for (let k = 0; k < (R[R.length - 1] ?? 5); k++) this.sequence.push(ARROW_LIST[rng.int(0, 3)]!);
  }

  get length(): number {
    return M().atmHack.rounds[this.round] ?? 0;
  }

  get rounds(): number {
    return M().atmHack.rounds.length;
  }

  /** The arrow lit while the sequence plays, or null between arrows and while typing. */
  get lit(): Arrow | null {
    if (this.showT === null) return null;
    const S = M().atmHack.show;
    const k = Math.floor(this.showT / S);
    const inArrow = this.showT - k * S < S * 0.75;
    return k < this.length && inArrow ? (this.sequence[k] ?? null) : null;
  }

  key(a: Arrow): void {
    if (this.done || this.showT !== null) return;
    if (this.sequence[this.entered] !== a) {
      this.wrong = a;
      this.done = true;
      this.grade = 'fail';
      return;
    }
    this.entered++;
    if (this.entered < this.length) return;
    this.round++;
    this.entered = 0;
    if (this.round >= this.rounds) {
      const budget = M().atmHack.rounds.reduce((t, n) => t + n, 0) * M().atmHack.perArrow;
      this.done = true;
      this.grade = gradeFor(Math.min(1, budget / Math.max(0.01, this.inputT)));
      // a clean hack never fails on time alone
      if (this.grade === 'poor') this.grade = 'ok';
    } else this.showT = 0;
  }

  update(dt: number): void {
    if (this.done) return;
    if (this.showT !== null) {
      this.showT += dt;
      if (this.showT >= this.length * M().atmHack.show + 0.2) this.showT = null;
    } else this.inputT += dt;
  }
}

// ------------------------------------------------------------------ ATM drill
/** ATM drill: hold to drill through. The bit heats while drilling; let it cool or it jams and slips back. */
export class DrillGame implements MinigameLogic {
  progress = 0;
  heat = 0;
  jams = 0;
  t = 0;
  holding = false;
  done = false;
  grade: Grade | null = null;

  get red(): number {
    return M().drill.red;
  }

  get timeLeft(): number {
    return Math.max(0, M().drill.seconds - this.t);
  }

  hold(on: boolean): void {
    this.holding = on;
  }

  update(dt: number): void {
    if (this.done) return;
    const D = M().drill;
    this.t += dt;
    if (this.holding) {
      this.progress += D.rate * dt;
      this.heat += D.heatUp * dt;
    } else this.heat = Math.max(0, this.heat - D.cool * dt);
    if (this.heat >= 1) {
      this.jams++;
      this.progress = Math.max(0, this.progress - D.jamSetback);
      this.heat = D.jamHeat;
      this.holding = false;
      if (this.jams >= D.maxJams) return this.end('fail');
    }
    if (this.progress >= 1) return this.end((['excellent', 'good', 'ok'] as const)[this.jams] ?? 'poor');
    if (this.t >= D.seconds) this.end('fail');
  }

  private end(g: Grade): void {
    this.done = true;
    this.grade = g;
  }
}

// ------------------------------------------------------------------ wipe footage
/** Wipe footage: hold to erase while keeping the scrub marker inside the moving window. Outside, it smears back. */
export class WipeGame implements MinigameLogic {
  marker = 0.5;
  window = 0.5;
  /** Seconds erased (need: 10). */
  erased = 0;
  held = 0;
  heldIn = 0;
  t = 0;
  holding = false;
  private phase: number;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    this.phase = rng.next() * Math.PI * 2;
  }

  get halfWidth(): number {
    return M().wipe.window / 2;
  }

  get inside(): boolean {
    return Math.abs(this.marker - this.window) <= this.halfWidth;
  }

  get progress(): number {
    return Math.min(1, this.erased / M().wipe.need);
  }

  get timeLeft(): number {
    return Math.max(0, M().wipe.seconds - this.t);
  }

  hold(on: boolean): void {
    this.holding = on;
  }

  move(dir: number, dt: number): void {
    if (this.done) return;
    this.marker = Math.max(0, Math.min(1, this.marker + dir * M().wipe.markerSpeed * dt));
  }

  update(dt: number): void {
    if (this.done) return;
    const W = M().wipe;
    this.t += dt;
    // the window drifts along the tape: two slow waves, so it can't be learned
    this.window =
      0.5 + 0.3 * Math.sin(this.t * 0.9 + this.phase) + 0.12 * Math.sin(this.t * 2.3 + this.phase * 2);
    if (this.holding) {
      this.held += dt;
      if (this.inside) {
        this.heldIn += dt;
        this.erased += dt;
      } else this.erased = Math.max(0, this.erased - W.smear * dt);
    }
    if (this.erased >= W.need) {
      this.done = true;
      this.grade = gradeFor(this.heldIn / Math.max(0.01, this.held));
    } else if (this.t >= W.seconds) {
      this.done = true;
      this.grade = 'fail';
    }
  }
}

// ------------------------------------------------------------------ alarm bypass
/** Alarm bypass (store panel at night): cut the wires in the order on the diagram. A wrong wire trips it. */
export class BypassGame implements MinigameLogic {
  /** The panel's wires, left to right. */
  readonly wires: WireColour[];
  /** The order to cut them: indexes into `wires`. */
  readonly order: number[];
  cut: number[] = [];
  t = 0;
  wrong: number | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(
    rng: Rng,
    /** Seconds before the panel goes off (the robbery's deadline). */
    readonly seconds: number,
  ) {
    const n = M().bypass.wires;
    const pool = [...WIRE_COLOURS];
    this.wires = [];
    for (let k = 0; k < n; k++) this.wires.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
    this.order = [...Array(n).keys()];
    for (let k = n - 1; k > 0; k--) {
      const j = rng.int(0, k);
      [this.order[k], this.order[j]] = [this.order[j]!, this.order[k]!];
    }
  }

  get timeLeft(): number {
    return Math.max(0, this.seconds - this.t);
  }

  /** Cut wire k (1–4 keys or a click). */
  snip(k: number): void {
    if (this.done || this.cut.includes(k) || k < 0 || k >= this.wires.length) return;
    if (this.order[this.cut.length] !== k) {
      this.wrong = k;
      this.done = true;
      this.grade = 'fail';
      return;
    }
    this.cut.push(k);
    if (this.cut.length === this.wires.length) {
      this.done = true;
      this.grade = gradeFor(1 - this.t / Math.max(0.01, this.seconds) + 0.3);
    }
  }

  update(dt: number): void {
    if (this.done) return;
    this.t += dt;
    if (this.t >= this.seconds) {
      this.done = true;
      this.grade = 'fail';
    }
  }
}
