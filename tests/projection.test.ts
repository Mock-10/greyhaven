import { describe, expect, it } from 'vitest';
import {
  facingFromWorld,
  roundHalfEven,
  screenDirToWorld,
  screenToWorld,
  tileTopVertex,
  worldToScreen,
  worldToTile,
} from '../src/iso/projection';

describe('projection', () => {
  it('matches the art: screenX = x − y, screenY = (x + y)/2 − z', () => {
    expect(worldToScreen(32, 0)).toEqual({ x: 32, y: 16 });
    expect(worldToScreen(0, 32)).toEqual({ x: -32, y: 16 });
    expect(worldToScreen(10, 20, 5)).toEqual({ x: -10, y: 10 });
  });

  it('puts tile (i, j) top vertex at world (32i, 32j), a 64 × 32 diamond grid', () => {
    expect(tileTopVertex(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileTopVertex(1, 0)).toEqual({ x: 32, y: 16 });
    expect(tileTopVertex(1, 1)).toEqual({ x: 0, y: 32 });
  });

  it('inverts on the ground plane', () => {
    for (const [x, y] of [
      [0, 0],
      [123.5, 77],
      [900, 12],
    ] as const) {
      const s = worldToScreen(x, y);
      const w = screenToWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(x);
      expect(w.y).toBeCloseTo(y);
    }
  });

  it('finds the tile under a world point', () => {
    expect(worldToTile(0, 0)).toEqual({ i: 0, j: 0 });
    expect(worldToTile(31.9, 32)).toEqual({ i: 0, j: 1 });
    expect(worldToTile(-1, 5)).toEqual({ i: -1, j: 0 });
  });

  it('rounds half to even like Python round()', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, -2.5, 2.4, 2.6].map(roundHalfEven)).toEqual([
      0, 2, 2, -0, -2, -2, 2, 3,
    ]);
  });

  it('maps screen directions onto the ground', () => {
    const right = screenDirToWorld(1, 0);
    expect(worldToScreen(right.x, right.y)).toEqual({ x: 1, y: 0 });
    const down = screenDirToWorld(0, 1);
    expect(worldToScreen(down.x, down.y)).toEqual({ x: 0, y: 1 });
  });

  it('faces sprites by world angle (0 = +x, 2 = +y, 4 = −x, 6 = −y)', () => {
    expect(facingFromWorld(1, 0)).toBe(0);
    expect(facingFromWorld(1, 1)).toBe(1);
    expect(facingFromWorld(0, 1)).toBe(2);
    expect(facingFromWorld(-1, 0)).toBe(4);
    expect(facingFromWorld(0, -1)).toBe(6);
    expect(facingFromWorld(1, -1)).toBe(7);
  });
});
