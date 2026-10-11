import { describe, expect, it } from 'vitest';
import { outlinePixels } from '../src/assets/outline';

describe('entrance outline', () => {
  it('draws a 1 px ring just outside the opaque pixels', () => {
    // a 2 x 2 opaque square in a 4 x 4 cell
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ])
      data[(y! * 4 + x!) * 4 + 3] = 255;
    const o = outlinePixels({ width: 4, height: 4, data }, [239, 212, 134]);
    expect(o.width).toBe(6);
    const at = (x: number, y: number) => o.data[(y * 6 + x) * 4 + 3];
    // the square sits at (2..3, 2..3) in the bigger cell: its pixels stay empty, its 4-neighbours are ringed
    expect(at(2, 2)).toBe(0);
    expect(at(1, 2)).toBe(255);
    expect(at(4, 3)).toBe(255);
    expect(at(2, 1)).toBe(255);
    // corners (diagonal only) stay empty: a clean outline, not a fat one
    expect(at(1, 1)).toBe(0);
    expect(o.data.filter((_, k) => k % 4 === 3 && o.data[k] === 255).length).toBe(8);
  });
});
