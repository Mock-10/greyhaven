// Polylines with arc length, for pedestrians on sidewalks and cars in lanes (milestone 4). Pure code.

export interface Path {
  pts: readonly [number, number][];
  /** Distance along the path at each point. */
  cum: number[];
  len: number;
}

export function makePath(pts: readonly [number, number][]): Path {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1] as [number, number];
    const b = pts[k] as [number, number];
    cum.push((cum[k - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { pts, cum, len: cum[cum.length - 1] as number };
}

/** The point at distance `s` along a path, and the unit direction there. */
export function pointAt(p: Path, s: number): { x: number; y: number; dx: number; dy: number } {
  const t = Math.max(0, Math.min(p.len, s));
  let lo = 0;
  let hi = p.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((p.cum[mid] as number) <= t) lo = mid;
    else hi = mid;
  }
  const a = p.pts[lo] as [number, number];
  const b = p.pts[hi] as [number, number];
  const seg = (p.cum[hi] as number) - (p.cum[lo] as number) || 1;
  const f = (t - (p.cum[lo] as number)) / seg;
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    dx: (b[0] - a[0]) / seg,
    dy: (b[1] - a[1]) / seg,
  };
}

/** Distance along the path of the point nearest (x, y), and how far away it is. */
export function nearestOn(p: Path, x: number, y: number): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let k = 1; k < p.pts.length; k++) {
    const a = p.pts[k - 1] as [number, number];
    const b = p.pts[k] as [number, number];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const L2 = ex * ex + ey * ey || 1;
    const f = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / L2));
    const d = Math.hypot(a[0] + ex * f - x, a[1] + ey * f - y);
    if (d < best.d) best = { s: (p.cum[k - 1] as number) + f * Math.sqrt(L2), d };
  }
  return best;
}
