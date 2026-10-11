// Pure camera maths (docs/11 "Camera"): integer zoom, integer scroll, pan limits, soft deadzone.

import type { Vec2 } from './projection';

/** Largest allowed zoom level that still shows at least fitW × fitH art pixels. */
export function fitZoom(
  viewW: number,
  viewH: number,
  levels: readonly number[],
  fitW: number,
  fitH: number,
): number {
  const sorted = [...levels].sort((a, b) => a - b);
  let best = sorted[0] ?? 1;
  for (const z of sorted) if (viewW / z >= fitW && viewH / z >= fitH) best = z;
  return best;
}

/** Next zoom level up (+1) or down (−1), staying on the allowed list. */
export function stepZoom(current: number, delta: 1 | -1, levels: readonly number[]): number {
  const sorted = [...levels].sort((a, b) => a - b);
  const idx = sorted.indexOf(current);
  if (idx < 0)
    return sorted.reduce((p, z) => (Math.abs(z - current) < Math.abs(p - current) ? z : p), sorted[0] ?? 1);
  return sorted[Math.min(sorted.length - 1, Math.max(0, idx + delta))] as number;
}

/** Integer scroll (top-left of the view, in art pixels) that centres `center` in a view of viewW × viewH device px. */
export function scrollFor(center: Vec2, viewW: number, viewH: number, zoom: number): Vec2 {
  return { x: Math.round(center.x - viewW / (2 * zoom)), y: Math.round(center.y - viewH / (2 * zoom)) };
}

/** Limit a pan offset to a maximum length. */
export function clampLength(v: Vec2, max: number): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len <= max || len === 0) return v;
  return { x: (v.x / len) * max, y: (v.y / len) * max };
}

/** Move `focus` just enough that `target` sits inside a w × h deadzone centred on it. */
export function applyDeadzone(focus: Vec2, target: Vec2, w: number, h: number): Vec2 {
  const dx = target.x - focus.x;
  const dy = target.y - focus.y;
  const hx = w / 2;
  const hy = h / 2;
  return {
    x: focus.x + (dx > hx ? dx - hx : dx < -hx ? dx + hx : 0),
    y: focus.y + (dy > hy ? dy - hy : dy < -hy ? dy + hy : 0),
  };
}

/** Exponential approach: fraction of the gap closed after dt seconds at `rate` per second. */
export function approach(from: number, to: number, rate: number, dt: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * dt));
}

/**
 * Keep a view of viewW × viewH art pixels centred on `center` inside `bounds` grown by `margin`. When the view is
 * larger than the bounds on an axis, it is centred on them.
 */
export function clampCenter(
  center: Vec2,
  viewW: number,
  viewH: number,
  bounds: { x: number; y: number; w: number; h: number },
  margin: number,
): Vec2 {
  const axis = (c: number, view: number, b0: number, size: number) => {
    const lo = b0 - margin + view / 2;
    const hi = b0 + size + margin - view / 2;
    return lo > hi ? b0 + size / 2 : Math.min(hi, Math.max(lo, c));
  };
  return { x: axis(center.x, viewW, bounds.x, bounds.w), y: axis(center.y, viewH, bounds.y, bounds.h) };
}
