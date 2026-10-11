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
}

const EPS = 0.01;

/** True when footprint a lies entirely behind b along x or y. */
function behind(a: Box, b: Box): boolean {
  return a[2] <= b[0] + EPS || a[3] <= b[1] + EPS;
}

const sumKey = (f: Box) => f[0] + f[2] + f[1] + f[3];

/** Which of two overlapping objects draws first: -1 for a, 1 for b. */
export function firstOf(a: Box, b: Box): -1 | 1 {
  const ab = behind(a, b);
  const ba = behind(b, a);
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
      const [first, second] = firstOf(items[i]!.fp, items[j]!.fp) < 0 ? [i, j] : [j, i];
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

/**
 * Depth for a moving object with footprint `fp` among the static objects its sprite overlaps (each with its
 * footprint and depth): above everything it is in front of, below everything it is behind.
 */
export function depthAmong(
  fp: Box,
  overlapping: readonly { fp: Box; depth: number }[],
  fallback: number,
): number {
  let lo = -Infinity;
  let hi = Infinity;
  for (const o of overlapping) {
    if (firstOf(o.fp, fp) < 0) lo = Math.max(lo, o.depth);
    else hi = Math.min(hi, o.depth);
  }
  if (lo === -Infinity && hi === Infinity) return fallback;
  if (lo === -Infinity) return hi - 0.5;
  if (hi === Infinity) return lo + 0.5;
  return lo < hi ? (lo + hi) / 2 : lo + 0.5;
}
