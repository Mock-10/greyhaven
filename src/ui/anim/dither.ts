// Pixel-art fades and copies on UI surfaces (ui/hudDraw.ts). The art fades by dithering pixels away on a 4 × 4
// Bayer pattern rather than by smooth alpha (art/STYLE_GUIDE.md "Light and shading"), and the UI follows suit:
// a panel fading in appears pixel by pixel in an even, ordered pattern.

import type { Surface } from '../hudDraw';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The 4 × 4 Bayer matrix, as thresholds in (0, 1). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** True when pixel (x, y) is shown at coverage `a` (0 hides every pixel, 1 shows every pixel). */
export function ditherKeep(x: number, y: number, a: number): boolean {
  if (a >= 1) return true;
  if (a <= 0) return false;
  return a > (BAYER4[(y & 3) * 4 + (x & 3)] as number);
}

function clip(s: Surface, r: Rect): Rect {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(s.width, r.x + r.w);
  const y1 = Math.min(s.height, r.y + r.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Thin a rect of the surface to coverage `a` by clearing pixels on the Bayer pattern. */
export function ditherFade(s: Surface, r: Rect, a: number): void {
  if (a >= 1) return;
  const c = clip(s, r);
  for (let y = c.y; y < c.y + c.h; y++)
    for (let x = c.x; x < c.x + c.w; x++) {
      if (ditherKeep(x, y, a)) continue;
      const k = (y * s.width + x) * 4;
      s.data[k] = s.data[k + 1] = s.data[k + 2] = s.data[k + 3] = 0;
    }
}

/** Copy a rect of the surface into a new surface (to move or reveal it). */
export function grab(s: Surface, r: Rect): Surface {
  const out: Surface = { width: r.w, height: r.h, data: new Uint8ClampedArray(r.w * r.h * 4) };
  for (let y = 0; y < r.h; y++) {
    const sy = r.y + y;
    if (sy < 0 || sy >= s.height) continue;
    for (let x = 0; x < r.w; x++) {
      const sx = r.x + x;
      if (sx < 0 || sx >= s.width) continue;
      const k = (sy * s.width + sx) * 4;
      out.data.set(s.data.subarray(k, k + 4), (y * r.w + x) * 4);
    }
  }
  return out;
}

/** Clear a rect of the surface to transparent. */
export function erase(s: Surface, r: Rect): void {
  const c = clip(s, r);
  for (let y = c.y; y < c.y + c.h; y++)
    s.data.fill(0, (y * s.width + c.x) * 4, (y * s.width + c.x + c.w) * 4);
}

export interface BlitOptions {
  /** Dithered coverage, 0–1 (the Bayer pattern follows the destination pixels, so it doesn't crawl). */
  alpha?: number;
  /** Only these source rows are drawn (a reveal band). */
  rows?: { from: number; to: number };
}

/**
 * Draw `src` onto `dst` at (dx, dy) with the "over" operator, optionally dithered and limited to a band of
 * rows.
 */
export function blit(dst: Surface, src: Surface, dx: number, dy: number, o: BlitOptions = {}): void {
  const a = o.alpha ?? 1;
  const r0 = Math.max(0, o.rows?.from ?? 0);
  const r1 = Math.min(src.height, o.rows?.to ?? src.height);
  for (let y = r0; y < r1; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width || !ditherKeep(tx, ty, a)) continue;
      const k = (y * src.width + x) * 4;
      const sa = (src.data[k + 3] as number) / 255;
      if (sa <= 0) continue;
      const q = (ty * dst.width + tx) * 4;
      const da = (dst.data[q + 3] as number) / 255;
      const oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++)
        dst.data[q + c] = Math.round(
          ((src.data[k + c] as number) * sa + (dst.data[q + c] as number) * da * (1 - sa)) / oa,
        );
      dst.data[q + 3] = Math.round(oa * 255);
    }
  }
}
