// A 1 px outline around a sprite's opaque pixels, for marking buildings you can enter (user request, 2026-10-11:
// "an outline or a highlight or something subtle"). Gold, because doors are interactables (CLAUDE.md rule 2).
// The result is one pixel bigger on every side, so its anchor moves by (1, 1).

import type { Pixels } from './highlight';

export function outlinePixels(src: Pixels, rgb: readonly [number, number, number]): Pixels {
  const w = src.width + 2;
  const h = src.height + 2;
  const out = new Uint8ClampedArray(w * h * 4);
  const solid = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < src.width &&
    y < src.height &&
    (src.data[(y * src.width + x) * 4 + 3] as number) > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x - 1;
      const sy = y - 1;
      if (solid(sx, sy)) continue;
      if (solid(sx - 1, sy) || solid(sx + 1, sy) || solid(sx, sy - 1) || solid(sx, sy + 1)) {
        const k = (y * w + x) * 4;
        out[k] = rgb[0];
        out[k + 1] = rgb[1];
        out[k + 2] = rgb[2];
        out[k + 3] = 255;
      }
    }
  return { width: w, height: h, data: out };
}
