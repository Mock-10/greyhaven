// Depth order for dense city maps. Sorting by the anchor's x + y fails when small props stand next to big
// buildings, so static objects are ordered topologically: of two objects whose sprites overlap on screen, the one
// whose footprint lies behind the other along x or y draws first (art/source/draft_city.py draw_order does the
// same for the drafts). Moving objects then slot in between the objects they overlap.

import type { Rect } from './shadows';

/** Ground footprint [minX, minY, maxX, maxY] in world units. */
export type Box = readonly [number, number, number, number];

export interface Sortable {
  fp: Box;
  /** Screen bounds of the sprite. */
  bounds: Rect;
  /** An overhead object (a canopy roof on posts): it draws after anything standing under its footprint. */
  over?: boolean;
}

const EPS = 0.01;

/** True when footprint a lies entirely behind b along x or y. */
function behind(a: Box, b: Box): boolean {
  return a[2] <= b[0] + EPS || a[3] <= b[1] + EPS;
}

const sumKey = (f: Box) => f[0] + f[2] + f[1] + f[3];

/** Which of two overlapping objects draws first: -1 for a, 1 for b. An overhead object draws after anything whose
 *  footprint reaches under it. */
export function firstOf(a: Box, b: Box, aOver = false, bOver = false): -1 | 1 {
  const ab = behind(a, b);
  const ba = behind(b, a);
  if (aOver !== bOver && !ab && !ba) return aOver ? 1 : -1;
  if (ab && !ba) return -1;
  if (ba && !ab) return 1;
  return sumKey(a) <= sumKey(b) ? -1 : 1;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Draw rank (0 = first) of every item. Cycles, which are rare, are broken by the smallest footprint key. */
export function staticOrder(items: readonly Sortable[]): number[] {
  const n = items.length;
  const out: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Int32Array(n);
  // sweep over screen x to find overlapping pairs without testing all of them
  const byX = items.map((_, i) => i).sort((a, b) => items[a]!.bounds.x - items[b]!.bounds.x);
  for (let s = 0; s < n; s++) {
    const i = byX[s] as number;
    const bi = items[i]!.bounds;
    for (let t = s + 1; t < n; t++) {
      const j = byX[t] as number;
      const bj = items[j]!.bounds;
      if (bj.x >= bi.x + bi.w) break;
      if (!overlaps(bi, bj)) continue;
      const [first, second] =
        firstOf(items[i]!.fp, items[j]!.fp, items[i]!.over, items[j]!.over) < 0 ? [i, j] : [j, i];
      out[first]!.push(second);
      indeg[second]!++;
    }
  }
  const key = items.map((it) => sumKey(it.fp));
  const done = new Uint8Array(n);
  const rank = new Array<number>(n).fill(0);
  // a small binary heap on (key, index)
  const heap: number[] = [];
  const less = (a: number, b: number) => key[a]! < key[b]! || (key[a] === key[b] && a < b);
  const push = (v: number) => {
    heap.push(v);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!less(heap[k]!, heap[p]!)) break;
      [heap[k], heap[p]] = [heap[p]!, heap[k]!];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m]!, heap[k]!];
        k = m;
      }
    }
    return top;
  };
  for (let i = 0; i < n; i++) if (indeg[i] === 0) push(i);
  let next = 0;
  while (next < n) {
    if (!heap.length) {
      let best = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || less(i, best))) best = i;
      indeg[best] = 0;
      push(best);
    }
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    rank[i] = next++;
    for (const j of out[i]!) {
      indeg[j]!--;
      if (indeg[j] === 0 && !done[j]) push(j);
    }
  }
  return rank;
}

/** The depths a moving object must stay between: above `lo` (what it's in front of), below `hi`. */
export function depthRange(
  fp: Box,
  overlapping: readonly { fp: Box; depth: number; over?: boolean }[],
): { lo: number; hi: number } {
  let lo = -Infinity;
  let hi = Infinity;
  for (const o of overlapping) {
    if (firstOf(o.fp, fp, o.over) < 0) lo = Math.max(lo, o.depth);
    else hi = Math.min(hi, o.depth);
  }
  return { lo, hi };
}

/**
 * Depth for a moving object with footprint `fp` among the static objects its sprite overlaps (each with its
 * footprint and depth): above everything it is in front of, below everything it is behind.
 */
export function depthAmong(
  fp: Box,
  overlapping: readonly { fp: Box; depth: number; over?: boolean }[],
  fallback: number,
): number {
  const { lo, hi } = depthRange(fp, overlapping);
  if (lo === -Infinity && hi === Infinity) return fallback;
  if (lo === -Infinity) return hi - 0.5;
  if (hi === Infinity) return lo + 0.5;
  return lo < hi ? (lo + hi) / 2 : lo + 0.5;
}

/** A turned box on the ground (a car), or an upright one (a person: ang 0, small half sizes). */
export interface Obb {
  x: number;
  y: number;
  hx: number;
  hy: number;
  ang: number;
}

/**
 * Which of two turned boxes draws first (2026-10-11 camera rework): find an axis that separates them (an edge
 * normal of either box) and put the one on the far side from the camera first. The camera looks along +x+y, so
 * the far side is the side with the smaller x + y. Axes nearly across the view direction can't decide; touching
 * boxes fall back to their centres' x + y. This fixes cars drawing over cars they stand behind, which their old
 * axis-aligned boxes got wrong when turned.
 */
export function obbFirst(a: Obb, b: Obb): -1 | 1 {
  let best: { side: -1 | 1; w: number } | null = null;
  for (const ang of [a.ang, a.ang + Math.PI / 2, b.ang, b.ang + Math.PI / 2]) {
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    const w = (nx + ny) / Math.SQRT2; // how far this axis runs along the view direction
    if (Math.abs(w) < 0.05) continue;
    const proj = (o: Obb) => {
      const c = o.x * nx + o.y * ny;
      const r =
        o.hx * Math.abs(Math.cos(o.ang) * nx + Math.sin(o.ang) * ny) +
        o.hy * Math.abs(-Math.sin(o.ang) * nx + Math.cos(o.ang) * ny);
      return [c - r, c + r] as const;
    };
    const [a0, a1] = proj(a);
    const [b0, b1] = proj(b);
    let aLow: boolean | null = null;
    if (a1 <= b0 + EPS) aLow = true;
    else if (b1 <= a0 + EPS) aLow = false;
    if (aLow === null) continue;
    // a lies on the low side of n; with w > 0 the low side is further from the camera
    const aFirst = aLow === w > 0;
    if (!best || Math.abs(w) > best.w) best = { side: aFirst ? -1 : 1, w: Math.abs(w) };
  }
  if (best) return best.side;
  return a.x + a.y <= b.x + b.y ? -1 : 1;
}
