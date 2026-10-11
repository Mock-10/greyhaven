// Interaction prompt (STYLE_GUIDE, docs/11): a dark plate with a gold edge and a pointer, a gold keycap
// and a cream label. Pixel-for-pixel port of prompt() in art/source/scene.py.

import type { Pixels } from '../assets/highlight';
import { textBits } from './pixelFont';

const PLATE = [45, 34, 46, 235];
const EDGE = [185, 143, 58, 255];
const GOLD = [239, 212, 134, 255];
const GOLD_SHADE = [148, 111, 46, 255];
const CREAM = [238, 233, 232, 255];
const KEY_INK = [45, 34, 46, 255];

const RED = [208, 132, 120, 255];

/** `blocked` draws the label in red: a requirement isn't met (docs/11: "LOCKED shown in red"). */
export function promptPixels(key: string, label: string, blocked = false): Pixels {
  const kt = textBits(key);
  const lt = textBits(label);
  const ltw = (lt[0] as boolean[]).length;
  const w = 3 + 7 + 3 + ltw + 4;
  const h = 11;
  const H = h + 3;
  const data = new Uint8ClampedArray(w * H * 4);
  const set = (x: number, y: number, c: number[]) => {
    if (x < 0 || y < 0 || x >= w || y >= H) return;
    data.set(c, (y * w + x) * 4);
  };
  const fill = (x0: number, x1: number, y0: number, y1: number, c: number[]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, c);
  };
  fill(0, w, 1, h - 1, PLATE);
  fill(1, w - 1, 0, h, PLATE);
  fill(1, w - 1, 0, 1, EDGE);
  fill(1, w - 1, h - 1, h, EDGE);
  fill(0, 1, 1, h - 1, EDGE);
  fill(w - 1, w, 1, h - 1, EDGE);
  const cx = Math.floor(w / 2);
  fill(cx - 2, cx + 3, h, h + 1, EDGE);
  fill(cx - 1, cx + 2, h + 1, h + 2, EDGE);
  set(cx, h + 2, EDGE);
  fill(cx - 1, cx + 2, h - 1, h, PLATE);
  fill(3, 10, 2, 9, GOLD);
  fill(3, 10, 8, 9, GOLD_SHADE);
  kt.forEach((row, y) => row.forEach((on, x) => on && set(5 + x, 3 + y, KEY_INK)));
  lt.forEach((row, y) => row.forEach((on, x) => on && set(13 + x, 3 + y, blocked ? RED : CREAM)));
  return { width: w, height: H, data };
}
