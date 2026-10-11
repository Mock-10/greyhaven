import { describe, expect, it } from 'vitest';
import { convexHull, rasterizeShadows, shadowAlpha, shadowShape, shapeBounds } from '../src/iso/shadows';

const V = { box: 150, blob: 170 };

describe('ground shadows', () => {
  it('casts box shadows away from the light (toward the upper right on screen)', () => {
    const s = shadowShape(100, 100, { kind: 'box', hx: 10, hy: 10, h: 40 }, V);
    expect(s.kind).toBe('poly');
    const b = shapeBounds(s);
    // The footprint alone spans screen y 90..110; the shadow reaches higher (smaller y).
    expect(b.y).toBeLessThan(90);
    expect(b.y + b.h - 1).toBe(110);
  });

  it('places blob shadows just behind the anchor, as scene.py does', () => {
    const s = shadowShape(100, 100, { kind: 'blob', r: 10 }, V);
    // Centre at screen (98 − 97, (98 + 97) / 2) = (1, 97.5); extents r × 1.15 by r × 0.55, truncated.
    expect(s).toEqual({ kind: 'ellipse', x0: -10, y0: 92, x1: 12, y1: 103, value: 170 });
  });

  it('builds a convex hull', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 2, y: 2 },
    ]);
    expect(hull).toHaveLength(4);
  });

  it('rasterises with later shapes overwriting earlier ones, clipped to the ground', () => {
    const a = { kind: 'ellipse' as const, x0: 0, y0: 0, x1: 9, y1: 9, value: 170 };
    const b = {
      kind: 'poly' as const,
      pts: [
        { x: 4, y: 0 },
        { x: 9, y: 0 },
        { x: 9, y: 9 },
        { x: 4, y: 9 },
      ],
      value: 150,
    };
    const mask = rasterizeShadows([a, b], { x: 0, y: 0, w: 10, h: 10 }, (px) => px < 8);
    expect(mask[5 * 10 + 2]).toBe(170);
    expect(mask[5 * 10 + 5]).toBe(150);
    expect(mask[5 * 10 + 9]).toBe(0); // off the ground
  });

  it('converts mask values to the 0.42 strength multiply', () => {
    expect(shadowAlpha(150, 0.42)).toBe(63);
    expect(shadowAlpha(170, 0.42)).toBe(71);
    expect(shadowAlpha(0, 0.42)).toBe(0);
  });
});

describe('turned box shadows (wall and fence segments)', () => {
  it('a box turned by 90 degrees casts the same shadow as the box with its sides swapped', () => {
    const v = { box: 150, blob: 170 };
    const a = shadowShape(100, 50, { kind: 'obox', hx: 8, hy: 3, h: 10, ang: Math.PI / 2 }, v);
    const b = shadowShape(100, 50, { kind: 'box', hx: 3, hy: 8, h: 10 }, v);
    expect(a.kind).toBe('poly');
    expect(shapeBounds(a)).toEqual(shapeBounds(b));
  });
});
