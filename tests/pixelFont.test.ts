import { describe, expect, it } from 'vitest';
import { glyph, textBits, textWidth } from '../src/ui/pixelFont';
import { promptPixels } from '../src/ui/promptPlate';

describe('pixel font', () => {
  it('draws 3 × 5 glyphs', () => {
    const a = glyph('A');
    expect(a).toHaveLength(5);
    expect(a.map((r) => r.map((b) => (b ? 1 : 0)).join(''))).toEqual(['010', '101', '111', '101', '101']);
  });

  it('trims narrow punctuation and separates glyphs by one column', () => {
    expect(glyph('.')[0]).toHaveLength(1);
    expect(textWidth('AB')).toBe(7);
    expect(textWidth('A.')).toBe(5);
    expect(textBits('a')).toEqual(textBits('A'));
  });

  it('falls back to ? for unknown characters', () => {
    expect(glyph('@')).toEqual(glyph('?'));
  });
});

describe('prompt plate', () => {
  it('has the scene.py size: keycap, label and a 3 px pointer', () => {
    const p = promptPixels('E', 'USE ATM');
    expect(p.width).toBe(3 + 7 + 3 + textWidth('USE ATM') + 4);
    expect(p.height).toBe(14);
    const at = (x: number, y: number) =>
      Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));
    expect(at(1, 0)).toEqual([185, 143, 58, 255]); // gold edge
    expect(at(4, 2)).toEqual([239, 212, 134, 255]); // keycap
    expect(at(0, 0)).toEqual([0, 0, 0, 0]); // rounded corner
    expect(at(Math.floor(p.width / 2), 13)).toEqual([185, 143, 58, 255]); // pointer tip
  });
});
