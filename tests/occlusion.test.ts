import { describe, expect, it } from 'vitest';
import { coverage, type MaskedSprite } from '../src/iso/occlusion';

const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  hole?: (u: number, v: number) => boolean,
): MaskedSprite => ({
  x,
  y,
  w,
  h,
  opaque: (u, v) => !(hole?.(u, v) ?? false),
});

describe('pixel coverage for occlusion', () => {
  it('measures the share of the target hidden by the occluder', () => {
    const target = box(0, 0, 20, 20);
    expect(coverage(box(-100, -100, 10, 10), target)).toBe(0);
    expect(coverage(box(0, 0, 20, 20), target)).toBe(1);
    expect(coverage(box(10, 0, 30, 30), target)).toBeCloseTo(0.5, 1);
  });

  it('counts only opaque pixels on both sides: a thin post covers little, a bounding box would cover all', () => {
    const target = box(0, 0, 20, 40);
    const post = box(-20, -40, 60, 100, (u) => u < 28 || u > 31); // a 4 px wide pole in a wide cell
    expect(coverage(post, target)).toBeLessThan(0.25);
    const ring = box(0, 0, 20, 40, (u, v) => u > 3 && u < 16 && v > 3 && v < 36); // a hollow frame
    expect(coverage(ring, box(5, 5, 8, 8))).toBe(0);
  });
});
