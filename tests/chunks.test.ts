import { describe, expect, it } from 'vitest';
import { chunkCount, chunkTiles, tileAtPixel, unionRect } from '../src/iso/chunks';
import { tileTopVertex } from '../src/iso/projection';

describe('ground chunks', () => {
  it('covers every tile exactly once', () => {
    const { cw, ch } = chunkCount(16, 28, 28);
    expect([cw, ch]).toEqual([2, 2]);
    const seen = new Set<string>();
    for (let ci = 0; ci < cw; ci++)
      for (let cj = 0; cj < ch; cj++)
        for (const t of chunkTiles({ ci, cj }, 16, 28, 28)) {
          const k = `${t.i},${t.j}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
    expect(seen.size).toBe(28 * 28);
  });

  it('draws back to front: each tile after the tiles behind it', () => {
    const order = chunkTiles({ ci: 0, cj: 0 }, 4, 4, 4);
    const pos = new Map(order.map((t, n) => [`${t.i},${t.j}`, n]));
    for (const t of order) {
      if (t.i > 0) expect(pos.get(`${t.i - 1},${t.j}`)!).toBeLessThan(pos.get(`${t.i},${t.j}`)!);
      if (t.j > 0) expect(pos.get(`${t.i},${t.j - 1}`)!).toBeLessThan(pos.get(`${t.i},${t.j}`)!);
    }
  });

  it('finds the tile under a screen pixel', () => {
    const v = tileTopVertex(3, 5);
    expect(tileAtPixel(v.x, v.y + 16)).toEqual({ i: 3, j: 5 });
    // Pixels beside the top vertex, on the same row, belong to the neighbours up-left and up-right.
    expect(tileAtPixel(v.x - 3, v.y)).toEqual({ i: 2, j: 5 });
    expect(tileAtPixel(v.x + 2, v.y)).toEqual({ i: 3, j: 4 });
  });

  it('unions rects', () => {
    expect(unionRect(null, { x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(unionRect({ x: 0, y: 0, w: 2, h: 2 }, { x: 5, y: 5, w: 1, h: 1 })).toEqual({
      x: 0,
      y: 0,
      w: 6,
      h: 6,
    });
  });
});
