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

/** A sprite on screen for pixel tests: its cell's top-left and size, and an opacity test in cell coordinates. */
export interface MaskedSprite {
  x: number;
  y: number;
  w: number;
  h: number;
  opaque: (u: number, v: number) => boolean;
}

/**
 * Share of the target's opaque pixels that the occluder's opaque pixels cover (sampled every `step` pixels). Used
 * to fade only what really hides the player or the car (2026-10-11 camera rework), not every sprite whose bounding
 * box touches them.
 */
export function coverage(occ: MaskedSprite, target: MaskedSprite, step = 2): number {
  let total = 0;
  let hidden = 0;
  for (let v = 0; v < target.h; v += step)
    for (let u = 0; u < target.w; u += step) {
      if (!target.opaque(u, v)) continue;
      total++;
      const ou = target.x + u - occ.x;
      const ov = target.y + v - occ.y;
      if (ou >= 0 && ov >= 0 && ou < occ.w && ov < occ.h && occ.opaque(ou, ov)) hidden++;
    }
  return total ? hidden / total : 0;
}
