// Open and close transitions for the pixel UI (docs/11 "UI animation"). A panel is drawn as usual, then its
// rect is re-composited for the transition: it unfolds from a strip at its middle, rises a few pixels into
// place and dithers in, in whole pixels so it stays pixel-perfect. Closing plays the same in reverse, faster.

import { FX } from '../../config/balanceFx';
import { clamp01, cubicOut, px, quadIn, stepped } from '../../anim/ease';
import type { Surface } from '../hudDraw';
import { blit, erase, grab, type Rect } from './dither';

export interface TransitionStyle {
  /** Unfold from a strip across the middle of the rect. */
  unfold: boolean;
  /** Pixels the rect rises through as it appears (negative: drops in from above). */
  rise: number;
  /** Dither in. */
  fade: boolean;
  /** Pixels it slides in from the right (toasts, the street name). */
  fromRight?: number;
}

export const PANEL: TransitionStyle = { unfold: true, rise: FX.ui.panelRise, fade: true };
export const POP: TransitionStyle = { unfold: false, rise: FX.ui.popRise, fade: true };
export const SLIDE_RIGHT: TransitionStyle = { unfold: false, rise: 0, fade: true, fromRight: FX.ui.slideIn };

/**
 * Re-composite `r` of the surface at transition progress `t` (0 = hidden, 1 = fully shown; no-op at 1).
 * `closing` uses the snappier closing curve.
 */
export function transition(
  s: Surface,
  r: Rect,
  t: number,
  style: TransitionStyle = PANEL,
  closing = false,
): void {
  if (t >= 1) return;
  const img = grab(s, r);
  erase(s, r);
  if (t <= 0) return;
  const e = closing ? 1 - quadIn(1 - t) : cubicOut(t);
  const dy = px(style.rise * (1 - e));
  const dx = px((style.fromRight ?? 0) * (1 - e));
  let rows: { from: number; to: number } | undefined;
  if (style.unfold) {
    // a 2 px strip at the middle opening to the full height over the first two thirds of the run
    const u = clamp01(e * 1.5);
    const half = Math.max(1, Math.ceil((r.h / 2) * u));
    const mid = Math.floor(r.h / 2);
    rows = { from: mid - half, to: mid + half };
  }
  const alpha = style.fade ? stepped(cubicOut, 4)(clamp01(t * 1.25)) : 1;
  const opts = rows ? { alpha, rows } : { alpha };
  blit(s, img, r.x + dx, r.y + dy, opts);
}

/** The world-dimming overlay's opacity during a transition (it fades with the panel). */
export function dimAlpha(base: number, t: number): number {
  return base * cubicOut(clamp01(t));
}

/**
 * Open/close state for one panel or menu: `t` runs 0 → 1 while opening and back to 0 while closing; `closed`
 * turns true once the closing run ends, so the scene knows when to really stop.
 */
export class Presence {
  t = 0;
  private dir: 1 | -1 = 1;

  constructor(
    private openSeconds: number = FX.ui.panelOpen,
    private closeSeconds: number = FX.ui.panelClose,
  ) {}

  get closing(): boolean {
    return this.dir < 0;
  }

  get closed(): boolean {
    return this.dir < 0 && this.t <= 0;
  }

  get opening(): boolean {
    return this.dir > 0 && this.t < 1;
  }

  /** Start closing (from wherever it is). */
  close(): void {
    this.dir = -1;
  }

  /** Re-open (e.g. the same panel asked for again while it was closing). */
  open(): void {
    this.dir = 1;
  }

  /** Jump to fully shown (tests, screenshots). */
  finish(): void {
    this.t = this.dir > 0 ? 1 : 0;
  }

  update(dt: number): void {
    const d = this.dir > 0 ? dt / this.openSeconds : -dt / this.closeSeconds;
    this.t = clamp01(this.t + d);
  }
}
