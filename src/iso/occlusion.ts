// Occlusion (docs/11, docs/14): when the player is behind a tall sprite (screen overlap and the
// sprite is in front by depth), that sprite fades so the player stays visible.

import type { Rect } from './shadows';

export interface Occluder {
  /** Screen-space bounds of the sprite's opaque pixels. */
  bounds: Rect;
  depth: number;
  /** Height of the sprite above its ground anchor, in art pixels. */
  height: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function isOccluding(o: Occluder, target: Rect, targetDepth: number, minHeight: number): boolean {
  return o.height >= minHeight && o.depth > targetDepth && rectsOverlap(o.bounds, target);
}
