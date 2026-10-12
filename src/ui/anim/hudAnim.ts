// HUD motion (docs/11 "UI animation"): the cash rolls to new amounts with a floating "+$40", the health bar
// leaves a pale damage trail that drains after a beat and pulses red when low, a wanted star flashes and
// bursts as it lights, the objective types itself out with a glint, the hint strip dithers in when it
// changes, and toasts slide in and out on eased curves. HudScene draws its panels as before and asks this for
// the extras; `busy` says when it must redraw every frame instead of at the radar rate.

import { FX } from '../../config/balanceFx';
import { clamp01, cubicOut, pingPong, quadIn } from '../../anim/ease';
import {
  blend,
  C,
  plate,
  spriteScaled,
  STAR_FLASH,
  STAR_PAL,
  text,
  textWidthPx,
  VITALS,
  type Surface,
} from '../hudDraw';
import { ditherFade, type Rect } from './dither';
import { Bursts, Popups, RollingNumber } from './motion';
import { Presence, transition, POP } from './transition';

export interface HudAnimInput {
  clean: number;
  dirty: number;
  /** 0–1. */
  health: number;
  stars: number;
  objective: string;
  /** Any string that changes when the hint strip's keys change. */
  hints: string;
  driving: boolean;
}

/** Where hudDraw.topLeft puts the health bar, relative to the panel (keep in step with it). */
const HP_BAR = { dx: 23, dy: 20, w: VITALS.w - 52, h: 7 };
const STAR_PITCH = 22;

export class HudAnimator {
  readonly clean = new RollingNumber(0);
  readonly dirty = new RollingNumber(0);
  readonly cleanPops = new Popups();
  readonly dirtyPops = new Popups();
  readonly bursts = new Bursts(11);
  readonly carPanel = new Presence(FX.ui.panelOpen, FX.ui.panelClose);
  private hp = 1;
  private trail = 1;
  private trailWait = 0;
  private stars = 0;
  private starT = [9, 9, 9, 9, 9];
  private objText = '';
  private objT = 9;
  private hintsKey = '';
  private hintT = 9;
  private clock = 0;
  private first = true;
  /** The star panel's centre, for bursts (set by drawStars). */
  private starAt: { cx: number; y: number } | null = null;

  update(dt: number, inp: HudAnimInput): void {
    this.clock += dt;
    if (this.first) {
      // the first frame shows things as they are, with nothing to animate from
      this.first = false;
      this.clean.set(inp.clean);
      this.clean.update(9);
      this.dirty.set(inp.dirty);
      this.dirty.update(9);
      this.hp = this.trail = inp.health;
      this.stars = inp.stars;
      this.objText = inp.objective;
      this.hintsKey = inp.hints;
      if (inp.driving) {
        this.carPanel.open();
        this.carPanel.finish();
      } else this.carPanel.close();
      this.carPanel.finish();
      return;
    }
    const dc = this.clean.set(inp.clean);
    if (dc) this.cleanPops.push(`${dc > 0 ? '+' : '-'}$${Math.abs(dc)}`, dc > 0 ? C.CREAM : C.MUTED);
    const dd = this.dirty.set(inp.dirty);
    if (dd) this.dirtyPops.push(`${dd > 0 ? '+' : '-'}$${Math.abs(dd)}`, dd > 0 ? C.DIRTY : C.MUTED);
    this.clean.update(dt);
    this.dirty.update(dt);
    this.cleanPops.update(dt);
    this.dirtyPops.update(dt);
    // health: damage drops the bar at once and leaves a trail; healing fills it smoothly
    if (inp.health < this.hp) {
      if (this.trail < this.hp) this.trail = this.hp;
      this.hp = inp.health;
      this.trailWait = FX.ui.trailHold;
    } else this.hp = Math.min(inp.health, this.hp + dt / FX.ui.trailDrain);
    if (this.trailWait > 0) this.trailWait -= dt;
    else this.trail = Math.max(this.hp, this.trail - dt / FX.ui.trailDrain);
    // stars: the changed ones flash
    if (inp.stars !== this.stars) {
      const lo = Math.min(inp.stars, this.stars);
      const hi = Math.max(inp.stars, this.stars);
      for (let k = lo; k < hi && k < 5; k++) {
        this.starT[k] = 0;
        if (inp.stars > this.stars && this.starAt) {
          const x0 = this.starAt.cx - Math.floor((5 * STAR_PITCH + 6) / 2);
          this.bursts.emit('star', x0 + 5 + k * STAR_PITCH + 9, this.starAt.y + 13, 14, 70);
        }
      }
      this.stars = inp.stars;
    }
    this.starT = this.starT.map((t) => t + dt);
    if (inp.objective !== this.objText) {
      this.objText = inp.objective;
      this.objT = 0;
    } else this.objT += dt;
    if (inp.hints !== this.hintsKey) {
      this.hintsKey = inp.hints;
      this.hintT = 0;
    } else this.hintT += dt;
    if (inp.driving) this.carPanel.open();
    else this.carPanel.close();
    this.carPanel.update(dt);
    this.bursts.update(dt);
  }

  /** True while anything moves, so the HUD should redraw every frame. */
  get busy(): boolean {
    return (
      this.clean.rolling ||
      this.dirty.rolling ||
      this.cleanPops.busy ||
      this.dirtyPops.busy ||
      this.trail > this.hp + 1e-3 ||
      this.lowHealth ||
      this.starT.some((t) => t < FX.ui.starFlash) ||
      this.objT < this.objText.length / FX.ui.typeCps + FX.ui.objectiveGlint ||
      this.hintT < FX.ui.hintFade ||
      this.carPanel.opening ||
      (this.carPanel.closing && !this.carPanel.closed) ||
      this.bursts.busy
    );
  }

  /** The health fraction to draw (eases up when healing). */
  get health(): number {
    return this.hp;
  }

  get lowHealth(): boolean {
    return this.hp > 0 && this.hp <= FX.ui.lowHealth;
  }

  /** After hudDraw.topLeft at (x, y): the damage trail on the health bar and the low-health pulse. */
  drawVitals(s: Surface, x: number, y: number): void {
    const { dx, dy, w, h } = HP_BAR;
    const inner = w - 2;
    const f0 = Math.round(inner * clamp01(this.hp));
    const f1 = Math.round(inner * clamp01(this.trail));
    if (f1 > f0) {
      blend(s, y + dy + 1, y + dy + h - 1, x + dx + 1 + f0, x + dx + 1 + f1, C.STONE5);
      blend(s, y + dy + h - 2, y + dy + h - 1, x + dx + 1 + f0, x + dx + 1 + f1, C.MUTED);
    }
    if (this.lowHealth) {
      const a = 0.25 + 0.65 * pingPong(this.clock, 1 / FX.ui.lowHealthHz);
      // a red edge on the vitals panel
      blend(s, y, y + 1, x + 1, x + VITALS.w - 1, C.HP, a);
      blend(s, y + VITALS.h - 1, y + VITALS.h, x + 1, x + VITALS.w - 1, C.HP, a);
      blend(s, y + 1, y + VITALS.h - 1, x, x + 1, C.HP, a);
      blend(s, y + 1, y + VITALS.h - 1, x + VITALS.w - 1, x + VITALS.w, C.HP, a);
    }
  }

  /** After hudDraw.stars at (cx, y): flashes on changed stars, then the bursts. */
  drawStars(s: Surface, cx: number, y: number): void {
    this.starAt = { cx, y };
    const x0 = cx - Math.floor((5 * STAR_PITCH + 6) / 2);
    for (let k = 0; k < 5; k++) {
      const t = this.starT[k] as number;
      if (t >= FX.ui.starFlash) continue;
      // blink three times
      if (Math.floor((t / FX.ui.starFlash) * 6) % 2 === 0)
        spriteScaled(s, x0 + 5 + k * STAR_PITCH, y + 4, STAR_FLASH, STAR_PAL, 2);
    }
  }

  /** Replaces hudDraw.objective: same plate, the text types itself out and a glint runs along the top edge. */
  drawObjective(s: Surface, cx: number, y: number, str: string): void {
    const w = textWidthPx(str) + 24;
    const x = cx - Math.floor(w / 2);
    plate(s, x, y, w, 17);
    spriteScaled(s, x + 6, y + 5, ['#..', '##.', '###', '##.', '#..'], { '#': C.GOLD }, 1);
    const n = Math.min(str.length, Math.floor(this.objT * FX.ui.typeCps));
    text(s, x + 15, y + 5, str.slice(0, n), C.CREAM);
    const typed = str.length / FX.ui.typeCps;
    const g = (this.objT - typed) / FX.ui.objectiveGlint;
    if (g >= 0 && g < 1) {
      const gx = x + 1 + Math.round(cubicOut(g) * (w - 6));
      blend(s, y, y + 1, gx, gx + 4, C.GOLD_HI);
      blend(s, y + 16, y + 17, gx, gx + 4, C.GOLD_HI);
    }
  }

  /** After the hint strip is drawn in `r`: dither it in when its keys just changed. */
  fadeHints(s: Surface, r: Rect): void {
    if (this.hintT < FX.ui.hintFade) ditherFade(s, r, clamp01(this.hintT / FX.ui.hintFade));
  }

  /** After the car panel is drawn in `r`: pop it in or out with the car. */
  carPanelTransition(s: Surface, r: Rect): void {
    transition(s, r, this.carPanel.t, POP, this.carPanel.closing);
  }

  /** Whether to draw the car panel at all (it stays up while folding away). */
  get showCarPanel(): boolean {
    return this.carPanel.t > 0;
  }

  /** The cash pop-ups, under the clock panel whose right edge is `xr` and bottom `y`. */
  drawCashPopups(s: Surface, xr: number, y: number): void {
    this.cleanPops.draw(s, xr - 4, y + 16);
    this.dirtyPops.draw(s, xr - 4, y + 16 + (this.cleanPops.busy ? 12 : 0));
  }

  drawBursts(s: Surface): void {
    this.bursts.draw(s);
  }
}

/**
 * Toast slide (hudDraw.toast's `slide`: 0 = in place, 1 = off the right edge) for a toast `t` seconds old that
 * leaves after `stay` seconds: eased in, eased out.
 */
export function toastSlide(t: number, stay: number, inSeconds = 0.25, outSeconds = 0.4): number {
  if (t < inSeconds) return 1 - cubicOut(t / inSeconds);
  if (t > stay) return quadIn((t - stay) / outSeconds);
  return 0;
}

/** Whole-pixel x offset of the street-name plate `t` seconds after it appeared (`stay` seconds on screen). */
export function streetSlide(t: number, stay: number): number {
  return Math.round(toastSlide(t, stay - 0.35, 0.3, 0.35) * FX.ui.slideIn * 2);
}
