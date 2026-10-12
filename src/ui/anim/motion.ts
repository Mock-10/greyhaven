// Small UI motions shared by the HUD and the panels: a rolling number, floating "+$40" pop-ups, a decaying
// shake and pixel bursts (sparks, confetti, cash glints). Pure state + drawing on ui/hudDraw surfaces.

import { FX } from '../../config/balanceFx';
import { Anim, clamp01, cubicOut, px, quadOut } from '../../anim/ease';
import { Rng } from '../../core/rng';
import { C, px as dot, text, textWidthPx, type RGB, type Surface } from '../hudDraw';
import { ditherKeep } from './dither';

/**
 * A number that rolls to its new value (the cash readout). Big jumps take the same time as small ones, so a
 * paycheque doesn't crawl. `value` is a whole number, as shown.
 */
export class RollingNumber {
  private a: Anim;

  constructor(v: number, seconds: number = FX.ui.moneyRoll) {
    this.a = new Anim(v, seconds, cubicOut);
  }

  get value(): number {
    return Math.round(this.a.value);
  }

  get target(): number {
    return this.a.target;
  }

  get rolling(): boolean {
    return !this.a.done;
  }

  /** Point at a new amount; returns the change (0 when unchanged). */
  set(v: number): number {
    const d = v - this.a.target;
    if (d !== 0) this.a.retarget(v);
    return d;
  }

  update(dt: number): void {
    this.a.update(dt);
  }
}

export interface Popup {
  text: string;
  col: RGB;
  t: number;
}

/** Floating labels ("+$40", "-$120") that rise and dither away. Newest at the bottom. */
export class Popups {
  readonly list: Popup[] = [];

  push(str: string, col: RGB): void {
    this.list.push({ text: str, col, t: 0 });
    while (this.list.length > FX.ui.popupMax) this.list.shift();
  }

  get busy(): boolean {
    return this.list.length > 0;
  }

  update(dt: number): void {
    for (const p of this.list) p.t += dt;
    while (this.list[0] && this.list[0].t >= FX.ui.popupSeconds) this.list.shift();
  }

  /** Draw right-aligned to `xr`, starting at `y` and rising; older ones sit higher. */
  draw(s: Surface, xr: number, y: number): void {
    this.list.forEach((p, k) => {
      const u = clamp01(p.t / FX.ui.popupSeconds);
      const rise = px(quadOut(u) * FX.ui.popupRise);
      const yy = y - rise - (this.list.length - 1 - k) * 2;
      const w = textWidthPx(p.text);
      const tmp = { width: w + 2, height: 12, data: new Uint8ClampedArray((w + 2) * 12 * 4) };
      text(tmp, 0, 1, p.text, p.col, C.INK);
      // fade out over the last 40%
      const a = 1 - clamp01((u - 0.6) / 0.4);
      for (let y2 = 0; y2 < tmp.height; y2++)
        for (let x2 = 0; x2 < tmp.width; x2++) {
          const k2 = (y2 * tmp.width + x2) * 4;
          if (!tmp.data[k2 + 3]) continue;
          const sx = xr - w + x2;
          const sy = yy + y2;
          if (!ditherKeep(sx, sy, a)) continue;
          dot(s, sx, sy, [tmp.data[k2] as number, tmp.data[k2 + 1] as number, tmp.data[k2 + 2] as number]);
        }
    });
  }
}

/** A shake that decays: `offset` is a whole-pixel (x, y) to add to whatever shakes. */
export class Shake {
  private t = 1e9;
  private strength = 0;

  kick(strength: number = FX.ui.shakePx): void {
    this.t = 0;
    this.strength = strength;
  }

  get busy(): boolean {
    return this.t < FX.ui.shakeSeconds;
  }

  update(dt: number): void {
    this.t += dt;
  }

  get offset(): { x: number; y: number } {
    if (!this.busy) return { x: 0, y: 0 };
    const decay = 1 - this.t / FX.ui.shakeSeconds;
    // a fixed, readable wobble (left, right, left...) rather than noise
    const phase = Math.floor(this.t * 40);
    const dir = phase % 2 === 0 ? 1 : -1;
    return { x: px(dir * this.strength * decay), y: phase % 4 === 1 ? px(decay) : 0 };
  }
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  col: RGB;
  big: boolean;
}

export type BurstKind = 'spark' | 'confetti' | 'cash' | 'star';

const BURST_COLS: Record<BurstKind, readonly RGB[]> = {
  // hot sparks: cream to clay (never gold, which is for valuables)
  spark: [C.CREAM, C.STONE5, [214, 160, 120], [185, 94, 94]],
  confetti: [C.CREAM, C.GLASS4, C.SAGE4, C.POLICE_R, C.KHAKI4],
  // cash and loot may use gold
  cash: [C.GOLD, C.GOLD_HI, C.GOLD_LO],
  star: [C.GOLD_HI, C.CREAM, C.POLICE_R, C.POLICE_B],
};

/** Pixel bursts on a UI surface: sparks off a hotwire, confetti on a great grade, glints off cash. */
export class Bursts {
  private bits: Bit[] = [];
  private rng: Rng;

  constructor(seed = 7) {
    this.rng = new Rng(seed);
  }

  get busy(): boolean {
    return this.bits.length > 0;
  }

  get count(): number {
    return this.bits.length;
  }

  emit(kind: BurstKind, x: number, y: number, n: number, speed = 60): void {
    const cols = BURST_COLS[kind];
    for (let k = 0; k < n; k++) {
      const a =
        kind === 'confetti' ? -Math.PI / 2 + (this.rng.next() - 0.5) * 2.2 : this.rng.next() * Math.PI * 2;
      const v = speed * (0.4 + this.rng.next() * 0.8);
      this.bits.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        t: 0,
        life: 0.35 + this.rng.next() * (kind === 'confetti' ? 0.7 : 0.35),
        col: cols[Math.floor(this.rng.next() * cols.length)] as RGB,
        big: kind === 'confetti' || (kind === 'star' && this.rng.next() < 0.4),
      });
    }
    if (this.bits.length > FX.ui.burstMax) this.bits.splice(0, this.bits.length - FX.ui.burstMax);
  }

  update(dt: number): void {
    for (const b of this.bits) {
      b.t += dt;
      b.vy += FX.ui.burstGravity * dt;
      b.vx *= 0.5 ** (dt / 0.3);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bits = this.bits.filter((b) => b.t < b.life);
  }

  draw(s: Surface): void {
    for (const b of this.bits) {
      const x = px(b.x);
      const y = px(b.y);
      if (!ditherKeep(x, y, 1.6 - (b.t / b.life) * 1.6)) continue;
      dot(s, x, y, b.col);
      if (b.big) dot(s, x + 1, y, b.col);
    }
  }
}
