// Pure chunk maths for the ground renderer: which tiles a chunk holds, in what order they draw, and
// which screen pixels belong to it. Kept free of Phaser so it can be unit tested.

import { TILE } from '../config/constants';
import { screenToWorld } from './projection';
import type { Rect } from './shadows';

export interface ChunkId {
  ci: number;
  cj: number;
}

/** Tiles of a chunk in draw order: back to front by diagonal (i + j), then by i (as scene.py does). */
export function chunkTiles(c: ChunkId, size: number, mapW: number, mapH: number): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  const i0 = c.ci * size;
  const j0 = c.cj * size;
  const i1 = Math.min(i0 + size, mapW);
  const j1 = Math.min(j0 + size, mapH);
  for (let s = i0 + j0; s <= i1 - 1 + j1 - 1; s++) {
    for (let i = i0; i < i1; i++) {
      const j = s - i;
      if (j >= j0 && j < j1) out.push({ i, j });
    }
  }
  return out;
}

export function chunkCount(size: number, mapW: number, mapH: number): { cw: number; ch: number } {
  return { cw: Math.ceil(mapW / size), ch: Math.ceil(mapH / size) };
}

/** The ground tile whose top diamond holds screen pixel (px, py), judged at the pixel centre. */
export function tileAtPixel(px: number, py: number): { i: number; j: number } {
  const w = screenToWorld(px + 0.5, py + 0.5);
  return { i: Math.floor(w.x / TILE), j: Math.floor(w.y / TILE) };
}

export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
