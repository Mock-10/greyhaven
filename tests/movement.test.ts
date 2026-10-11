import { describe, expect, it } from 'vitest';
import { worldToScreen } from '../src/iso/projection';
import { collides, moveVector, moveWithCollision, type Solid } from '../src/systems/movement';

const RULES = { radius: 6, mapW: 1000, mapH: 1000, smallScale: 0.6, smallSlack: 2 };
const KEYS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

describe('walking', () => {
  it('covers the same screen distance per second in all eight directions', () => {
    const speeds = KEYS.map(([sx, sy]) => {
      const v = moveVector(sx, sy, 48)!;
      const s = worldToScreen(v.x, v.y);
      return Math.hypot(s.x, s.y);
    });
    for (const s of speeds) expect(s).toBeCloseTo(speeds[0]!, 6);
  });

  it('moves along the tile edges at walkSpeed with two keys', () => {
    const v = moveVector(1, -1, 48)!; // W + D: up-right along world -y
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(-48, 6);
    expect(moveVector(0, 0, 48)).toBeNull();
  });

  it('slides around a round prop instead of stopping', () => {
    const hydrant: Solid[] = [{ kind: 'circle', x: 100, y: 100, hx: 0, hy: 0, r: 4, small: true }];
    // running straight at the hydrant, slightly off centre
    let p = { x: 80, y: 101 };
    for (let k = 0; k < 40; k++) p = moveWithCollision(p.x, p.y, 1, 0, hydrant, RULES);
    expect(p.x).toBeGreaterThan(105); // got past it
    expect(collides(p.x, p.y, hydrant, RULES)).toBe(false);
  });

  it('gives small props a smaller hit circle than big ones', () => {
    const small: Solid[] = [{ kind: 'circle', x: 100, y: 100, hx: 0, hy: 0, r: 5, small: true }];
    const big: Solid[] = [{ kind: 'circle', x: 100, y: 100, hx: 0, hy: 0, r: 5 }];
    expect(collides(108, 100, small, RULES)).toBe(false);
    expect(collides(108, 100, big, RULES)).toBe(true);
  });

  it('is stopped by a wall box but slides along it', () => {
    const wall: Solid[] = [{ kind: 'box', x: 100, y: 100, hx: 50, hy: 5, r: 0 }];
    const p = moveWithCollision(100, 89, 3, 3, wall, RULES);
    expect(p.y).toBe(89); // blocked going into the wall
    expect(p.x).toBe(103); // still slides along it
  });
});
