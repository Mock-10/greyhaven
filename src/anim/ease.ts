// Easing and timing helpers for every animation (UI, effects, sprites). Pure, so they can be unit tested.
// Pixel art moves in whole pixels: callers round eased offsets with `px()` so nothing sits between pixels
// (CLAUDE.md hard rule 3).

export type Ease = (t: number) => number;

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const linear: Ease = (t) => clamp01(t);
export const quadIn: Ease = (t) => clamp01(t) ** 2;
export const quadOut: Ease = (t) => 1 - (1 - clamp01(t)) ** 2;
export const cubicOut: Ease = (t) => 1 - (1 - clamp01(t)) ** 3;
export const sineInOut: Ease = (t) => 0.5 - Math.cos(Math.PI * clamp01(t)) / 2;
/** Overshoots a little and settles: panels and badges that "pop" in. */
export const backOut: Ease = (t) => {
  const c = 1.70158;
  const u = clamp01(t) - 1;
  return 1 + (c + 1) * u ** 3 + c * u ** 2;
};

/** Snap an ease to `steps` levels, so a fade or slide moves in a few visible, deliberate steps. */
export function stepped(ease: Ease, steps: number): Ease {
  return (t) => Math.round(ease(t) * steps) / steps;
}

/** A whole-pixel offset (pixel-perfect rendering never draws between pixels). */
export function px(v: number): number {
  return Math.round(v);
}

/** 0 → 1 → 0 over one period. */
export function pingPong(t: number, period: number): number {
  const u = (((t / period) % 1) + 1) % 1;
  return u < 0.5 ? u * 2 : 2 - u * 2;
}

/**
 * Frame-rate independent exponential approach: moves `current` toward `target`, covering half the gap every
 * `halfLife` seconds.
 */
export function approach(current: number, target: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return target;
  return target + (current - target) * 0.5 ** (dt / halfLife);
}

/** Index of the frame showing at time `t` of a flipbook (`loop` false holds the last frame). */
export function frameAt(t: number, fps: number, frames: number, loop: boolean): number {
  if (frames <= 1 || fps <= 0) return 0;
  const k = Math.floor(Math.max(0, t) * fps);
  return loop ? k % frames : Math.min(frames - 1, k);
}

/**
 * A value animated from one number to another over a fixed time. `retarget` starts a new run from wherever
 * the value is now, so an interrupted animation never jumps.
 */
export class Anim {
  private from: number;
  private to: number;
  private t = 0;

  constructor(
    value: number,
    private dur: number,
    private ease: Ease = cubicOut,
  ) {
    this.from = value;
    this.to = value;
    this.t = dur;
  }

  get value(): number {
    if (this.dur <= 0) return this.to;
    return lerp(this.from, this.to, this.ease(this.t / this.dur));
  }

  get target(): number {
    return this.to;
  }

  get done(): boolean {
    return this.t >= this.dur;
  }

  /** 0 → 1 progress of the current run. */
  get progress(): number {
    return this.dur <= 0 ? 1 : clamp01(this.t / this.dur);
  }

  retarget(to: number, dur = this.dur, ease: Ease = this.ease): void {
    if (to === this.to && this.done) return;
    this.from = this.value;
    this.to = to;
    this.dur = dur;
    this.ease = ease;
    this.t = 0;
  }

  /** Jump straight to a value with no animation. */
  set(v: number): void {
    this.from = v;
    this.to = v;
    this.t = this.dur;
  }

  update(dt: number): void {
    if (this.t < this.dur) this.t = Math.min(this.dur, this.t + dt);
  }
}
