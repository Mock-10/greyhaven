import { describe, expect, it } from 'vitest';
import { glyph, textBits, textWidth } from '../src/ui/pixelFont';
import { promptPixels } from '../src/ui/promptPlate';

describe('pixel font', () => {
  it('draws the small font as 3 × 5 glyphs', () => {
    const a = glyph('A', 'small');
    expect(a).toHaveLength(5);
    expect(a.map((r) => r.map((b) => (b ? 1 : 0)).join(''))).toEqual(['010', '101', '111', '101', '101']);
    expect(textWidth('AB', 1, 'small')).toBe(7);
    expect(textWidth('A.', 1, 'small')).toBe(5);
    expect(glyph('@', 'small')).toEqual(glyph('?', 'small'));
  });

  it('draws the body font as 5 × 7 glyphs: letters proportional, digits full width (UI redesign)', () => {
    const a = glyph('A');
    expect(a).toHaveLength(7);
    expect(a[0]?.map((b) => (b ? 1 : 0)).join('')).toBe('01110');
    expect(glyph('I')[0]).toHaveLength(3); // trimmed
    expect(glyph('1')[0]).toHaveLength(5); // digits keep their width, so money doesn't jitter
    expect(glyph('.')[0]).toHaveLength(1);
    expect(textWidth('AB')).toBe(11);
    expect(textWidth(' ')).toBe(3);
    expect(textBits('a')).toEqual(textBits('A'));
    expect(glyph('€')).toEqual(glyph('?'));
  });
});

describe('prompt plate', () => {
  it('has the scene.py size: keycap, label and a 3 px pointer', () => {
    const p = promptPixels('E', 'USE ATM');
    expect(p.width).toBe(3 + (textWidth('E') + 5) + 4 + textWidth('USE ATM') + 5);
    expect(p.height).toBe(18);
    const at = (x: number, y: number) =>
      Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));
    expect(at(1, 0)).toEqual([185, 143, 58, 255]); // gold edge
    expect(at(4, 2)).toEqual([239, 212, 134, 255]); // keycap
    expect(at(0, 0)).toEqual([0, 0, 0, 0]); // rounded corner
    expect(at(Math.floor(p.width / 2), 17)).toEqual([185, 143, 58, 255]); // pointer tip
  });
});
