// Ground shadows, cast toward the upper right as a cool plum multiply (STYLE_GUIDE).
// Ported from art/source/scene.py so baked shadows land on the same pixels as the reference scenes:
//  - 'box' shadows: convex hull of the footprint and the footprint pushed away from the light by height,
//  - 'blob' shadows: a flat ellipse just behind the anchor.
// Shapes are drawn into one mask in placement order (later shapes overwrite), then multiplied in.

import { LIGHT } from '../config/constants';
import { worldToScreen, type Vec2 } from './projection';

export type ShadowSpec =
  | { kind: 'box'; hx: number; hy: number; h: number }
  | { kind: 'blob'; r: number }
  /** A box turned by `ang` radians about its anchor (wall, fence and planter segments). */
  | { kind: 'obox'; hx: number; hy: number; h: number; ang: number };

export type ShadowShape =
  | { kind: 'poly'; pts: Vec2[]; value: number }
  | { kind: 'ellipse'; x0: number; y0: number; x1: number; y1: number; value: number };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pillow's ROUND_UP: round half away from zero. Polygon vertices are snapped this way. */
function roundAway(v: number): number {
  return v >= 0 ? Math.floor(v + 0.5) : -Math.floor(Math.abs(v) + 0.5);
}

/** The screen-space shadow shape for an object anchored at world (x, y). */
export function shadowShape(
  x: number,
  y: number,
  spec: ShadowSpec,
  values: { box: number; blob: number },
): ShadowShape {
  const [lx, ly, lz] = LIGHT;
  if (spec.kind === 'box' || spec.kind === 'obox') {
    const dx = (-lx / lz) * spec.h;
    const dy = (-ly / lz) * spec.h;
    const a = spec.kind === 'obox' ? spec.ang : 0;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const corners: Vec2[] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sy]) => {
      const u = (sx as number) * spec.hx;
      const v = (sy as number) * spec.hy;
      return { x: x + ca * u - sa * v, y: y + sa * u + ca * v };
    });
    const all = [...corners, ...corners.map((c) => ({ x: c.x + dx, y: c.y + dy }))];
    const screen = all.map((p) => worldToScreen(p.x, p.y));
    const hull = convexHull(screen.map((p) => ({ x: round2(p.x), y: round2(p.y) })));
    return {
      kind: 'poly',
      pts: hull.map((p) => ({ x: roundAway(p.x), y: roundAway(p.y) })),
      value: values.box,
    };
  }
  const c = worldToScreen(x - 2, y - 3);
  const r = spec.r;
  return {
    kind: 'ellipse',
    x0: Math.trunc(c.x - r * 1.15),
    y0: Math.trunc(c.y - r * 0.55),
    x1: Math.trunc(c.x + r * 1.15),
    y1: Math.trunc(c.y + r * 0.55),
    value: values.blob,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Andrew's monotone chain, counter-clockwise in screen space (y down). */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const uniq = new Map<string, Vec2>();
  for (const p of points) uniq.set(`${p.x},${p.y}`, p);
  const pts = [...uniq.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let k = pts.length - 1; k >= 0; k--) {
    const p = pts[k]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function shapeBounds(s: ShadowShape): Rect {
  if (s.kind === 'ellipse') return { x: s.x0, y: s.y0, w: s.x1 - s.x0 + 1, h: s.y1 - s.y0 + 1 };
  const xs = s.pts.map((p) => p.x);
  const ys = s.pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1 };
}

function insideConvex(pts: readonly Vec2[], px: number, py: number): boolean {
  let sign = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[(k + 1) % pts.length]!;
    const c = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function insideEllipse(s: Extract<ShadowShape, { kind: 'ellipse' }>, px: number, py: number): boolean {
  const cx = (s.x0 + s.x1) / 2;
  const cy = (s.y0 + s.y1) / 2;
  const a = (s.x1 - s.x0 + 1) / 2;
  const b = (s.y1 - s.y0 + 1) / 2;
  const u = (px - cx) / a;
  const v = (py - cy) / b;
  return u * u + v * v <= 1;
}

/**
 * Rasterise shapes into a mask covering `rect` (screen pixels). Pixel (px, py) is covered when the
 * point (px, py) lies inside the shape, Pillow's convention. Later shapes overwrite earlier ones.
 * `isGround(px, py)` clips the mask to the ground (shadows never fall on the background).
 */
export function rasterizeShadows(
  shapes: readonly ShadowShape[],
  rect: Rect,
  isGround: (px: number, py: number) => boolean,
): Uint8Array {
  const mask = new Uint8Array(rect.w * rect.h);
  for (const s of shapes) {
    const b = shapeBounds(s);
    const x0 = Math.max(b.x, rect.x);
    const y0 = Math.max(b.y, rect.y);
    const x1 = Math.min(b.x + b.w, rect.x + rect.w);
    const y1 = Math.min(b.y + b.h, rect.y + rect.h);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const hit = s.kind === 'poly' ? insideConvex(s.pts, px, py) : insideEllipse(s, px, py);
        if (hit) mask[(py - rect.y) * rect.w + (px - rect.x)] = s.value;
      }
    }
  }
  for (let py = 0; py < rect.h; py++) {
    for (let px = 0; px < rect.w; px++) {
      const k = py * rect.w + px;
      if (mask[k] && !isGround(px + rect.x, py + rect.y)) mask[k] = 0;
    }
  }
  return mask;
}

/** Shadow alpha (0–255) for a mask value: scene.py multiplies by mask/255 × strength. */
export function shadowAlpha(maskValue: number, strength: number): number {
  return Math.round((maskValue / 255) * strength * 255);
}
