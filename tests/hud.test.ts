import { describe, expect, it } from 'vitest';
import {
  C,
  createSurface,
  hintKeys,
  hintKeysWidth,
  plate,
  radarTileColour,
  stars,
  textWidthPx,
} from '../src/ui/hudDraw';
import { isWarm, windowGlow } from '../src/world/nightLights';
import { money } from '../src/scenes/hudFormat';

const at = (s: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
  Array.from(s.data.slice((y * s.width + x) * 4, (y * s.width + x) * 4 + 4));

describe('HUD primitives (hud.py)', () => {
  it('draws a rounded plate: gold edge, 90% plate inside, transparent corners', () => {
    const s = createSurface(20, 10);
    plate(s, 0, 0, 20, 10);
    expect(at(s, 0, 0)[3]).toBe(0);
    expect(at(s, 5, 0)).toEqual([...C.EDGE, 255]);
    const inside = at(s, 5, 5);
    expect(inside.slice(0, 3)).toEqual([...C.PLATE]);
    expect(inside[3]).toBeGreaterThan(220);
  });

  it('fills stars in gold up to the wanted level', () => {
    const s = createSurface(80, 20);
    stars(s, 40, 0, 2);
    const gold = [];
    for (let k = 0; k < s.data.length; k += 4)
      if (s.data[k] === C.GOLD[0] && s.data[k + 1] === C.GOLD[1]) gold.push(k);
    expect(gold.length).toBeGreaterThan(0);
  });

  it('measures key hint strips', () => {
    const items: [string, string][] = [['E', 'USE']];
    const s = createSurface(60, 12);
    expect(hintKeys(s, 0, 0, items)).toBe(hintKeysWidth(items));
    expect(textWidthPx('USE')).toBe(17); // the 5 × 7 body font
    expect(textWidthPx('USE', 1, 'small')).toBe(11);
  });

  it('colours the radar by ground kind', () => {
    expect(radarTileColour('road_x_e0')).toEqual(radarTileColour('asphalt'));
    expect(radarTileColour('sidewalk_a')).not.toEqual(radarTileColour('grass_a'));
    expect(radarTileColour(undefined)).toEqual(C.INK);
  });

  it('formats money with thousands separators', () => {
    expect(money(1240)).toBe('1,240');
    expect(money(0)).toBe('0');
  });
});

describe('night lights', () => {
  it('recognises warm lit-window colours', () => {
    expect(isWarm(216, 180, 90)).toBe(true);
    expect(isWarm(118, 140, 175)).toBe(false);
  });

  it('keeps only warm pixels that changed between day and night', () => {
    const mk = (px: number[][]) => ({ width: px.length, height: 1, data: new Uint8ClampedArray(px.flat()) });
    const day = mk([
      [118, 140, 175, 255],
      [216, 180, 90, 255],
      [100, 100, 100, 255],
    ]);
    const night = mk([
      [216, 180, 90, 255],
      [216, 180, 90, 255],
      [120, 100, 100, 255],
    ]);
    const g = windowGlow(day, night);
    expect(Array.from(g.data.slice(0, 4))).toEqual([216, 180, 90, 255]); // window turned on
    expect(g.data[7]).toBe(0); // was already gold by day (a door handle)
    expect(g.data[11]).toBe(0); // changed, but not warm
  });
});

describe('radar arrow', () => {
  it('points along the heading', async () => {
    const { arrow } = await import('../src/ui/hudDraw');
    const right = createSurface(13, 13);
    arrow(right, 6, 6, 0);
    const left = createSurface(13, 13);
    arrow(left, 6, 6, Math.PI);
    const cream = (s: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
      at(s, x, y).slice(0, 3).join() === C.CREAM.join();
    expect(cream(right, 9, 6)).toBe(true);
    expect(cream(right, 3, 6)).toBe(false);
    expect(cream(left, 3, 6)).toBe(true);
  });
});
