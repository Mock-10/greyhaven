// Walking on foot: which way WASD moves the character, and how it slides around obstacles. Pure code, no Phaser.
//
// Direction: the eight key combinations move along the screen's straight axes (W up, D right) or, for two keys,
// along the tile edges (the 2:1 diagonals), like most isometric games. Speed: every direction covers the same
// distance on screen per second (the user found straight up and down slower than diagonals, 2026-10-11). Along
// a tile edge that is exactly BALANCE.walker.walkSpeed world units per second.
//
// Collision: buildings, cars and walls are boxes (or turned boxes) and block per axis, so you slide along them.
// Round props push you out sideways instead of stopping you, and small props (bollards, hydrants, lamp posts,
// meters...) use a smaller hit circle, so brushing past one at a run doesn't stop you dead.

import { screenDirToWorld, worldToScreen, type Vec2 } from '../iso/projection';

/** Screen length of one world unit along a tile edge (world x or y axis): √(1² + ½²). */
const EDGE_SCREEN = Math.hypot(1, 0.5);

/**
 * World velocity for held keys (sx, sy in −1..1 on screen axes) at `speed` world units per second along a tile
 * edge. Every direction moves the same number of screen pixels per second. Null when no key is held.
 */
export function moveVector(sx: number, sy: number, speed: number): Vec2 | null {
  if (sx === 0 && sy === 0) return null;
  // halving the screen y turns the two-key diagonals into the tile edges
  const d = screenDirToWorld(sx, sy / 2);
  const s = worldToScreen(d.x, d.y);
  const len = Math.hypot(s.x, s.y);
  const k = (speed * EDGE_SCREEN) / len;
  return { x: d.x * k, y: d.y * k };
}

export interface Solid {
  kind: 'box' | 'circle' | 'obox';
  x: number;
  y: number;
  hx: number;
  hy: number;
  r: number;
  /** Rotation of an 'obox' (radians). */
  ang?: number;
  /** Small decoration: collides with a reduced circle (see `forgiving`). */
  small?: boolean;
}

export interface CollisionRules {
  /** The walker's collision radius. */
  radius: number;
  /** Map size in world units: the walker stays inside it. */
  mapW: number;
  mapH: number;
  /** Hit circles of small props are scaled by this and the walker's radius shrinks by `smallSlack` against them. */
  smallScale: number;
  smallSlack: number;
}

function boxHit(s: Solid, x: number, y: number, r: number): boolean {
  let u = x - s.x;
  let v = y - s.y;
  if (s.kind === 'obox') {
    const ca = Math.cos(s.ang ?? 0);
    const sa = Math.sin(s.ang ?? 0);
    [u, v] = [u * ca + v * sa, -u * sa + v * ca];
  }
  const cu = Math.max(-s.hx, Math.min(u, s.hx));
  const cv = Math.max(-s.hy, Math.min(v, s.hy));
  return (u - cu) ** 2 + (v - cv) ** 2 < r * r;
}

/** Radius sum for a walker against a round solid. */
function circleReach(s: Solid, rules: CollisionRules): number {
  return s.small ? Math.max(1, s.r * rules.smallScale) + rules.radius - rules.smallSlack : s.r + rules.radius;
}

/** True when the walker at (x, y) overlaps a box-shaped solid or the map edge. Round solids don't count here. */
export function hitsBoxes(x: number, y: number, solids: readonly Solid[], rules: CollisionRules): boolean {
  const r = rules.radius;
  if (x < r || y < r || x > rules.mapW - r || y > rules.mapH - r) return true;
  for (const s of solids) {
    if (s.kind === 'circle') continue;
    const rr = s.small ? Math.max(1, r - rules.smallSlack) : r;
    if (boxHit(s, x, y, rr)) return true;
  }
  return false;
}

/** True when the walker overlaps anything. */
export function collides(x: number, y: number, solids: readonly Solid[], rules: CollisionRules): boolean {
  if (hitsBoxes(x, y, solids, rules)) return true;
  for (const s of solids)
    if (s.kind === 'circle' && (x - s.x) ** 2 + (y - s.y) ** 2 < circleReach(s, rules) ** 2) return true;
  return false;
}

/** Push the walker out of round solids along their normals (two passes settle clusters of props). */
function pushOut(p: Vec2, solids: readonly Solid[], rules: CollisionRules): Vec2 {
  let { x, y } = p;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      if (s.kind !== 'circle') continue;
      const reach = circleReach(s, rules);
      const dx = x - s.x;
      const dy = y - s.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach) continue;
      const d = Math.sqrt(d2) || 1e-6;
      x = s.x + (dx / d) * reach;
      y = s.y + (dy / d) * reach;
    }
  }
  return { x, y };
}

/**
 * Move the walker from (x, y) by (dx, dy). Box solids block per axis so the walker slides along them; round
 * solids push it aside. Never ends inside anything it wasn't already inside.
 */
export function moveWithCollision(
  x: number,
  y: number,
  dx: number,
  dy: number,
  solids: readonly Solid[],
  rules: CollisionRules,
): Vec2 {
  // only solids near the path matter
  const reach = Math.hypot(dx, dy) + rules.radius + 64;
  const near = solids.filter(
    (s) =>
      Math.abs(s.x - x) < reach + Math.max(s.hx, s.hy, s.r) &&
      Math.abs(s.y - y) < reach + Math.max(s.hx, s.hy, s.r),
  );
  let nx = x;
  let ny = y;
  if (!hitsBoxes(nx + dx, ny, near, rules)) nx += dx;
  if (!hitsBoxes(nx, ny + dy, near, rules)) ny += dy;
  const out = pushOut({ x: nx, y: ny }, near, rules);
  if (!hitsBoxes(out.x, out.y, near, rules)) return out;
  // pushed into a wall: keep the box-only move if it is clear of round props, else stay put
  return collides(nx, ny, near, rules) ? { x, y } : { x: nx, y: ny };
}
