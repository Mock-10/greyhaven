// The palette swap behind the player sprites (docs/11 character creator), as pure code so it can be tested:
// art/player.png is drawn with marker ramps for the skin, hair, top and bottom, and every marker tone (and the
// outline each ramp gets) is swapped for the same tone of the chosen ramp.

import { hairOf, outfitOf, skinOf, type Look, type Ramp } from '../data/looks';

export type Rgb = [number, number, number];
export type Part = 'skin' | 'hair' | 'top' | 'bot';

const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

function hex(h: string): Rgb {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Every marker colour → its colour in this look. The outline is the darkest tone × 0.78, as the renderer does. */
export function swapTable(look: Look, markers: Record<Part, Rgb[]>): Map<number, Rgb> {
  const outfit = outfitOf(look.outfit);
  const ramps: Record<Part, Ramp> = {
    skin: skinOf(look).ramp,
    hair: hairOf(look).ramp,
    top: outfit.top,
    bot: outfit.bottom,
  };
  const out = new Map<number, Rgb>();
  for (const part of Object.keys(ramps) as Part[]) {
    const tones = ramps[part].map(hex);
    const mk = markers[part];
    mk.slice(0, 6).forEach((c, k) => out.set(key(c[0], c[1], c[2]), tones[k] as Rgb));
    const o = mk[6];
    const d = tones[0] as Rgb;
    if (o)
      out.set(key(o[0], o[1], o[2]), [
        Math.floor(d[0] * 0.78),
        Math.floor(d[1] * 0.78),
        Math.floor(d[2] * 0.78),
      ]);
  }
  return out;
}

/** Recolour RGBA pixels in place (other colours are left alone). */
export function swapPixels(data: Uint8ClampedArray, table: Map<number, Rgb>): void {
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] as number) === 0) continue;
    const c = table.get(key(data[i] as number, data[i + 1] as number, data[i + 2] as number));
    if (!c) continue;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
  }
}
