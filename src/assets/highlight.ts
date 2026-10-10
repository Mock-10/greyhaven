// Interactable cues (STYLE_GUIDE "Interactables"), ported from art/source/sdf.py highlight():
//  - idle: a 1 px gold rim with a dashed shimmer that walks around the sprite with `frame`,
//  - hover: a 1 px bright-gold rim, a 1 px dark keyline outside it, and the sprite lifted ~8%.
// Interactables in the art pack ship with these frames baked in. This makes the same cue at runtime
// for anything else the player can use (cars, doors). Returns a copy padded by 4 px on every side.

import type { Rng } from '../core/rng';

export const HIGHLIGHT_PAD = 4;
const GOLD_HI: readonly number[] = [251, 234, 184];
const GOLD_MID: readonly number[] = [239, 212, 134];
const GOLD_DIM: readonly number[] = [148, 111, 46];
const INK: readonly number[] = [36, 27, 40];
const SPARK: readonly number[] = [255, 255, 240];

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function dilate(m: Uint8Array, w: number, h: number, diagonal: boolean): Uint8Array {
  const out = m.slice();
  const offs = diagonal
    ? [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
    : [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m[y * w + x]) continue;
      for (const [dy, dx] of offs) {
        const yy = y + (dy as number);
        const xx = x + (dx as number);
        if (yy >= 0 && yy < h && xx >= 0 && xx < w && m[yy * w + xx]) {
          out[y * w + x] = 1;
          break;
        }
      }
    }
  }
  return out;
}

function put(d: Uint8ClampedArray, k: number, c: readonly number[]): void {
  d[k * 4] = c[0] as number;
  d[k * 4 + 1] = c[1] as number;
  d[k * 4 + 2] = c[2] as number;
  d[k * 4 + 3] = 255;
}

export function highlight(
  src: Pixels,
  state: 'idle' | 'hover',
  options: { frame?: number; valuable?: boolean; rng?: Rng } = {},
): Pixels {
  const P = HIGHLIGHT_PAD;
  const frame = options.frame ?? 0;
  const w = src.width + 2 * P;
  const h = src.height + 2 * P;
  const data = new Uint8ClampedArray(w * h * 4);
  const al = new Uint8Array(w * h);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      const k = (y + P) * w + (x + P);
      data.set(src.data.subarray(s, s + 4), k * 4);
      if ((src.data[s + 3] as number) > 0) al[k] = 1;
    }
  }
  if (state === 'idle') {
    const d1 = dilate(al, w, h, false);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (!d1[k] || al[k]) continue;
        const on = Math.floor((x + y + frame * 2) / 3) % 3 !== 0;
        put(data, k, on ? GOLD_MID : GOLD_DIM);
      }
    }
  } else {
    const d1 = dilate(al, w, h, false);
    const d2 = dilate(d1, w, h, true);
    for (let k = 0; k < w * h; k++) {
      if (al[k]) {
        for (let c = 0; c < 3; c++)
          data[k * 4 + c] = Math.min(255, Math.floor((data[k * 4 + c] as number) * 1.08 + 6));
      } else if (d1[k]) put(data, k, GOLD_HI);
      else if (d2[k]) put(data, k, INK);
    }
  }
  if (options.valuable && options.rng) {
    const body: number[] = [];
    for (let k = 0; k < w * h; k++) if (al[k]) body.push(k);
    const n = state === 'idle' ? 2 : 3;
    for (let s = 0; s < n && body.length; s++) {
      const k = options.rng.pick(body);
      const y = Math.floor(k / w);
      const x = k % w;
      const marks: [number, number, readonly number[]][] = [
        [0, 0, SPARK],
        [-1, 0, GOLD_HI],
        [1, 0, GOLD_HI],
        [0, -1, GOLD_HI],
        [0, 1, GOLD_HI],
      ];
      for (const [dy, dx, c] of marks) {
        const yy = y + dy;
        const xx = x + dx;
        if (yy >= 0 && yy < h && xx >= 0 && xx < w && data[(yy * w + xx) * 4 + 3]) put(data, yy * w + xx, c);
      }
    }
  }
  return { width: w, height: h, data };
}
