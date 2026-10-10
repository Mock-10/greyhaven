// World ↔ screen projection. Must match the art exactly (CLAUDE.md hard rule 4):
//   screenX = x − y,  screenY = (x + y) / 2 − z
// World x and y are on the ground plane, z is height. 1 tile = 32 world units = a 64 × 32 px diamond.

import { TILE } from '../config/constants';

export interface Vec2 {
  x: number;
  y: number;
}

export function worldToScreen(x: number, y: number, z = 0): Vec2 {
  return { x: x - y, y: (x + y) / 2 - z };
}

/** Inverse projection onto the ground plane (z = 0). */
export function screenToWorld(sx: number, sy: number): Vec2 {
  return { x: sy + sx / 2, y: sy - sx / 2 };
}

/** Screen position of tile (i, j)'s top vertex. The tile image's anchor sits here. */
export function tileTopVertex(i: number, j: number): Vec2 {
  return worldToScreen(i * TILE, j * TILE);
}

/** The tile containing a world point. */
export function worldToTile(x: number, y: number): { i: number; j: number } {
  return { i: Math.floor(x / TILE), j: Math.floor(y / TILE) };
}

/**
 * Round half to even, like Python's round(). The reference scenes place sprites with
 * int(round(x)), so using the same rule keeps every sprite on the same pixel as the reference.
 */
export function roundHalfEven(v: number): number {
  const r = Math.round(v);
  if (Math.abs(v % 1) === 0.5) return r % 2 === 0 ? r : r - 1;
  return r;
}

/**
 * Screen-space movement vector (right, down) → world-space direction on the ground plane.
 * Screen right is world (+½, −½); screen down is world (+1, +1).
 */
export function screenDirToWorld(sx: number, sy: number): Vec2 {
  return { x: sx / 2 + sy, y: sy - sx / 2 };
}

/**
 * 8-way facing index into DIRS (SE, S, SW, W, NW, N, NE, E) for a world-space direction.
 * Sprite index k faces world angle k·45° (docs/18: 0 = +x, 2 = +y, 4 = −x, 6 = −y).
 */
export function facingFromWorld(dx: number, dy: number): number {
  const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}
