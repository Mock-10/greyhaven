import { describe, expect, it } from 'vitest';
import { depthAmong, firstOf, staticOrder, type Box } from '../src/iso/staticDepth';

const item = (fp: Box) => ({ fp, bounds: { x: 0, y: 0, w: 100, h: 100 } });

describe('static depth order', () => {
  it('draws a box behind another along x or y first', () => {
    expect(firstOf([0, 0, 10, 10], [20, 0, 30, 10])).toBe(-1);
    expect(firstOf([0, 20, 10, 30], [0, 0, 10, 10])).toBe(1);
  });

  it('puts a lamp in front of a wide building even when its anchor sum is smaller', () => {
    // a building 300 wide along x, and a lamp in front of its west end (y past the building's far edge)
    const building: Box = [0, 0, 300, 60];
    const lamp: Box = [8, 70, 16, 78];
    // by anchor sum the lamp (12 + 74 = 86) would sort before the building (150 + 30 = 180)
    const rank = staticOrder([item(building), item(lamp)]);
    expect(rank[1]).toBeGreaterThan(rank[0]!);
  });

  it('orders chains and keeps non-overlapping sprites by their key', () => {
    const items = [
      { fp: [40, 0, 50, 10] as Box, bounds: { x: 0, y: 0, w: 10, h: 10 } },
      { fp: [0, 0, 10, 10] as Box, bounds: { x: 100, y: 0, w: 10, h: 10 } },
    ];
    expect(staticOrder(items)).toEqual([1, 0]);
  });

  it('slots a moving object between what it is in front of and behind', () => {
    const d = depthAmong(
      [20, 20, 30, 30],
      [
        { fp: [0, 0, 10, 10], depth: 3 },
        { fp: [40, 40, 50, 50], depth: 7 },
      ],
      -1,
    );
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(7);
    expect(depthAmong([0, 0, 1, 1], [], -1)).toBe(-1);
  });
});
