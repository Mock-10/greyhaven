// The character creator panel (docs/11 "Character creator"): name, hair style, skin tone, hair colour and starting
// outfit, with a spinning preview of the player beside them. Drawn with the hud.py primitives in the menu plate
// style; pure code, so the layout is checked in tests/panels.test.ts. The preview sprite itself is a Phaser image
// placed over `CREATOR.preview` by scenes/CreatorScene.ts.

import {
  HAIR_COLOURS,
  SKIN_TONES,
  STARTING_OUTFITS,
  hairOf,
  outfitOf,
  skinOf,
  type HairStyle,
  type Look,
  type Ramp,
} from '../data/looks';
import { C, blend, hintKeys, plate, px, text, textWidthPx, type RGB, type Surface } from './hudDraw';

export const CREATOR_ROWS = ['name', 'style', 'skin', 'hair', 'outfit', 'start'] as const;
export type CreatorRow = (typeof CREATOR_ROWS)[number];

export const CREATOR = {
  w: 360,
  h: 236,
  /** The preview box, relative to the panel. */
  preview: { x: 8, y: 30, w: 112, h: 170 },
  /** The rows column. */
  col: 128,
  rowY: 32,
  rowH: 27,
  swatch: 16,
} as const;

const LABEL: Record<CreatorRow, string> = {
  name: 'NAME',
  style: 'HAIR',
  skin: 'SKIN',
  hair: 'HAIR COLOUR',
  outfit: 'OUTFIT',
  start: 'START THE DAY',
};

const STYLE_NAME: Record<HairStyle, string> = { short: 'SHORT', long: 'LONG', bun: 'BUN', bald: 'BALD' };

export function rowBox(x: number, y: number, k: number): { x: number; y: number; w: number; h: number } {
  return {
    x: x + CREATOR.col,
    y: y + CREATOR.rowY + k * CREATOR.rowH,
    w: CREATOR.w - CREATOR.col - 8,
    h: CREATOR.rowH - 3,
  };
}

/** The swatch rects of the skin or hair-colour row, for drawing and for clicks. */
export function swatchBoxes(
  x: number,
  y: number,
  row: 'skin' | 'hair',
): { x: number; y: number; w: number; h: number }[] {
  const b = rowBox(x, y, CREATOR_ROWS.indexOf(row));
  const n = row === 'skin' ? SKIN_TONES.length : HAIR_COLOURS.length;
  const s = CREATOR.swatch;
  return Array.from({ length: n }, (_, k) => ({ x: b.x + 92 + k * (s + 4), y: b.y + 4, w: s, h: s }));
}

/** The < and > arrows of the hair-style and outfit rows. */
export function arrowBoxes(x: number, y: number, row: 'style' | 'outfit') {
  const b = rowBox(x, y, CREATOR_ROWS.indexOf(row));
  return {
    left: { x: b.x + 90, y: b.y + 3, w: 12, h: 18 },
    right: { x: b.x + b.w - 14, y: b.y + 3, w: 12, h: 18 },
  };
}

const rgb = (h: string): RGB => {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

function swatch(
  s: Surface,
  b: { x: number; y: number; w: number; h: number },
  ramp: Ramp,
  on: boolean,
): void {
  blend(s, b.y, b.y + b.h, b.x, b.x + b.w, C.INK);
  blend(s, b.y + 1, b.y + b.h - 1, b.x + 1, b.x + b.w - 1, rgb(ramp[3]));
  blend(s, b.y + 1, b.y + 4, b.x + 1, b.x + b.w - 1, rgb(ramp[4]));
  blend(s, b.y + b.h - 4, b.y + b.h - 1, b.x + 1, b.x + b.w - 1, rgb(ramp[2]));
  if (on) {
    for (let i = -2; i < b.w + 2; i++) {
      px(s, b.x + i, b.y - 2, C.GOLD);
      px(s, b.x + i, b.y + b.h + 1, C.GOLD);
    }
    for (let j = -2; j < b.h + 2; j++) {
      px(s, b.x - 2, b.y + j, C.GOLD);
      px(s, b.x + b.w + 1, b.y + j, C.GOLD);
    }
  }
}

function arrows(
  s: Surface,
  x: number,
  y: number,
  row: 'style' | 'outfit',
  value: string,
  active: boolean,
): void {
  const a = arrowBoxes(x, y, row);
  const col = active ? C.GOLD : C.MUTED;
  text(s, a.left.x + 3, a.left.y + 5, '<', col);
  text(s, a.right.x + 3, a.right.y + 5, '>', col);
  const mid = (a.left.x + a.left.w + a.right.x) / 2;
  text(s, Math.round(mid - textWidthPx(value) / 2), a.left.y + 5, value, C.CREAM);
}

export interface CreatorView {
  look: Look;
  row: number;
  /** The text cursor blinks in the name field. */
  cursor: boolean;
}

export function drawCreator(s: Surface, x: number, y: number, v: CreatorView): void {
  const { w, h } = CREATOR;
  plate(s, x, y, w, h, C.EDGE, 0.96);
  text(s, x + 8, y + 7, 'NEW CHARACTER', C.GOLD, C.INK, 2);
  text(s, x + w - 8 - textWidthPx('GREYHAVEN'), y + 11, 'GREYHAVEN', C.MUTED);
  // the preview box (the sprite is drawn over it by the scene)
  const p = CREATOR.preview;
  blend(s, y + p.y, y + p.y + p.h, x + p.x, x + p.x + p.w, C.INK, 0.7);
  blend(s, y + p.y + p.h - 22, y + p.y + p.h - 21, x + p.x + 8, x + p.x + p.w - 8, C.PLATE_HI);
  const look = v.look;
  CREATOR_ROWS.forEach((row, k) => {
    const b = rowBox(x, y, k);
    const active = k === v.row;
    if (active) plate(s, b.x, b.y, b.w, b.h, C.EDGE, 0.9);
    else for (let gx = b.x + 2; gx < b.x + b.w - 2; gx += 2) px(s, gx, b.y + b.h - 1, C.PLATE_HI);
    if (row === 'start') {
      const label = LABEL.start;
      text(s, Math.round(b.x + (b.w - textWidthPx(label)) / 2), b.y + 8, label, active ? C.GOLD : C.CREAM);
      return;
    }
    text(s, b.x + 6, b.y + 8, LABEL[row], active ? C.CREAM : C.MUTED);
    if (row === 'name') {
      const nx = b.x + 92;
      blend(s, b.y + 4, b.y + b.h - 4, nx - 2, b.x + b.w - 6, C.INK, 0.8);
      const tw = text(s, nx + 2, b.y + 8, look.name, C.CREAM);
      if (active && v.cursor) blend(s, b.y + 7, b.y + 16, nx + 3 + tw, nx + 4 + tw, C.GOLD);
    } else if (row === 'style') arrows(s, x, y, 'style', STYLE_NAME[look.style], active);
    else if (row === 'outfit') arrows(s, x, y, 'outfit', outfitOf(look.outfit).name, active);
    else {
      const list = row === 'skin' ? SKIN_TONES : HAIR_COLOURS;
      const cur = row === 'skin' ? skinOf(look).id : hairOf(look).id;
      swatchBoxes(x, y, row).forEach((sb, i) =>
        swatch(s, sb, (list[i] as (typeof list)[number]).ramp, list[i]?.id === cur),
      );
    }
  });
  hintKeys(s, x + 8, y + h - 16, [
    ['W/S', 'ROW'],
    ['A/D', 'CHANGE'],
    ['ENTER', 'START'],
  ]);
}

/** Step a choice in a list, wrapping. */
export function cycle<T>(list: readonly T[], cur: T, by: number): T {
  const i = Math.max(0, list.indexOf(cur));
  return list[(((i + by) % list.length) + list.length) % list.length] as T;
}

/** The creator's starting outfits only (the clothing store sells the rest). */
export const CREATOR_OUTFITS = STARTING_OUTFITS;
