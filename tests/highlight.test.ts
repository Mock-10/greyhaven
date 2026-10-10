import { describe, expect, it } from 'vitest';
import { highlight, HIGHLIGHT_PAD } from '../src/assets/highlight';
import { Rng } from '../src/core/rng';

function square(size: number, inner: number) {
  const data = new Uint8ClampedArray(size * size * 4);
  const o = (size - inner) / 2;
  for (let y = o; y < o + inner; y++)
    for (let x = o; x < o + inner; x++) data.set([100, 100, 100, 255], (y * size + x) * 4);
  return { width: size, height: size, data };
}
const px = (p: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
  Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

describe('interactable cues', () => {
  it('pads by 4 px on every side', () => {
    const h = highlight(square(6, 2), 'idle');
    expect(h.width).toBe(6 + 2 * HIGHLIGHT_PAD);
  });

  it('idle: a 1 px gold rim (dashed) and nothing further out', () => {
    const h = highlight(square(6, 2), 'idle', { frame: 1 });
    const P = HIGHLIGHT_PAD;
    const rim = px(h, P + 1, P + 2); // left of the 2 × 2 square
    expect([[239, 212, 134, 255].join(), [148, 111, 46, 255].join()]).toContain(rim.join());
    expect(px(h, P, P + 2)[3]).toBe(0);
    expect(px(h, P + 2, P + 2)).toEqual([100, 100, 100, 255]);
  });

  it('hover: bright rim, dark keyline, lifted body', () => {
    const h = highlight(square(6, 2), 'hover');
    const P = HIGHLIGHT_PAD;
    expect(px(h, P + 1, P + 2)).toEqual([251, 234, 184, 255]);
    expect(px(h, P, P + 2)).toEqual([36, 27, 40, 255]);
    expect(px(h, P + 2, P + 2)).toEqual([114, 114, 114, 255]);
  });

  it('adds sparkles to valuables', () => {
    const h = highlight(square(8, 4), 'hover', { valuable: true, rng: new Rng(3) });
    const whites = [];
    for (let k = 0; k < h.width * h.height; k++)
      if (h.data[k * 4] === 255 && h.data[k * 4 + 2] === 240) whites.push(k);
    expect(whites.length).toBeGreaterThan(0);
  });
});
