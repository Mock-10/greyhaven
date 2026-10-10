// Depth sorting (docs/14): tiles first, then objects sorted by the world x + y of their ground anchor.
// Objects with equal depth keep the order they were added (Phaser's display list sort is stable).

/** Depth of an object on the object layer. */
export function depthOf(x: number, y: number): number {
  return x + y;
}

/** Sort placements back to front, stable for equal depths (matches the reference composer). */
export function sortBackToFront<T extends { x: number; y: number }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => depthOf(a.item.x, a.item.y) - depthOf(b.item.x, b.item.y) || a.index - b.index)
    .map((e) => e.item);
}

/** Ground footprint of a large object (building, container, parked car), in world units. */
export interface Footprint {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** The object's own depth on the object layer. */
  depth: number;
}

export type Relation = 'front' | 'behind' | 'overlap';

/**
 * Where a ground point stands relative to a box footprint. A point is in front of a box when it is
 * past the box's far edge along x or y; it is behind when it is short of the near edge.
 */
export function relationToFootprint(x: number, y: number, f: Footprint): Relation {
  if (x >= f.maxX || y >= f.maxY) return 'front';
  if (x <= f.minX || y <= f.minY) return 'behind';
  return 'overlap';
}

/** Small gap used to place a moving object just in front of or behind a footprint's depth. */
const DEPTH_EPS = 0.01;

/**
 * Depth for a moving object near large footprints. Sorting by anchor alone fails beside big
 * buildings, so the object's depth is clamped to the correct side of every footprint it overlaps on
 * screen. `overlapping` lists only the footprints whose sprites overlap the object's sprite.
 */
export function depthAgainstFootprints(x: number, y: number, overlapping: readonly Footprint[]): number {
  let d = depthOf(x, y);
  for (const f of overlapping) {
    const rel = relationToFootprint(x, y, f);
    if (rel === 'front') d = Math.max(d, f.depth + DEPTH_EPS);
    else if (rel === 'behind') d = Math.min(d, f.depth - DEPTH_EPS);
  }
  return d;
}
