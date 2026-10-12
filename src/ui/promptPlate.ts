// Interaction prompt (STYLE_GUIDE, docs/11): a dark plate with a gold edge and a pointer, a gold keycap
// and a cream label. Pixel-for-pixel port of prompt() in art/source/scene.py.

import type { Pixels } from '../assets/highlight';
import { fontHeight, textBits } from './pixelFont';

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
  const ktw = (kt[0] as boolean[]).length;
  const ltw = (lt[0] as boolean[]).length;
  const fh = fontHeight();
  // body font (5 × 7, UI redesign 2026-10-12): a keycap 4 px wider than its letter, 2 px of plate around
  const kw = ktw + 5;
  const h = fh + 8;
  const w = 3 + kw + 4 + ltw + 5;
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
  fill(3, 3 + kw, 2, h - 2, GOLD);
  fill(3, 3 + kw, h - 3, h - 2, GOLD_SHADE);
  kt.forEach((row, y) => row.forEach((on, x) => on && set(5 + x, 3 + y + 1, KEY_INK)));
  lt.forEach((row, y) => row.forEach((on, x) => on && set(3 + kw + 4 + x, 4 + y, blocked ? RED : CREAM)));
  return { width: w, height: H, data };
}
