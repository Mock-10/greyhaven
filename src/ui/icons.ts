// UI icons (art/source/ui_icons.py → art/ui_icons.png + .json): rendered item, app, HUD and portrait images for the
// pixel-buffer UI (UI redesign 2026-10-12). The boot scene hands the loaded sheet over once; drawing then blits from
// it. Without a sheet (unit tests) icons draw nothing but still take their place in the layout audit.

import iconsJson from '../../art/ui_icons.json';
import { recordRect, type Surface } from './hudDraw';

type Frame = { x: number; y: number; w: number; h: number };
const FRAMES = (iconsJson as unknown as { frames: Record<string, Frame> }).frames;

export type IconName = keyof typeof iconsJson.frames;

let sheet: { width: number; data: Uint8ClampedArray } | null = null;

/** Give the UI the loaded icon sheet's pixels. */
export function setIconSheet(width: number, data: Uint8ClampedArray): void {
  sheet = { width, data };
}

export function hasIcon(name: string): name is IconName {
  return name in FRAMES;
}

export function iconSize(name: IconName): { w: number; h: number } {
  const f = FRAMES[name] as Frame;
  return { w: f.w, h: f.h };
}

/** Draw an icon with its top-left at (x, y). `alpha` fades it (a greyed-out, unaffordable item). */
export function icon(s: Surface, x: number, y: number, name: IconName, alpha = 1): void {
  const f = FRAMES[name] as Frame;
  recordRect({ x, y, w: f.w, h: f.h, what: `icon ${name}` });
  if (!sheet) return;
  const src = sheet.data;
  const dst = s.data;
  for (let j = 0; j < f.h; j++) {
    const yy = y + j;
    if (yy < 0 || yy >= s.height) continue;
    for (let i = 0; i < f.w; i++) {
      const xx = x + i;
      if (xx < 0 || xx >= s.width) continue;
      const si = ((f.y + j) * sheet.width + f.x + i) * 4;
      const a = ((src[si + 3] as number) / 255) * alpha;
      if (a <= 0) continue;
      const di = (yy * s.width + xx) * 4;
      for (let k = 0; k < 3; k++)
        dst[di + k] = (dst[di + k] as number) * (1 - a) + (src[si + k] as number) * a;
      dst[di + 3] = Math.max(dst[di + 3] as number, Math.round(a * 255));
    }
  }
}
