// Menu panels (docs/11 "Menus"): the pause menu and the save-slot lists, drawn with the hud.py primitives in the
// same plate style as the minigame panels. Pure code, layout-tested in tests/panels.test.ts.

import { C, hintKeys, plate, px, text, textWidthPx, type Surface } from './hudDraw';

export interface MenuRow {
  label: string;
  /** A muted note on the right (a save summary, why it's unavailable). */
  detail?: string;
  enabled: boolean;
}

export const MENU_PANEL = { w: 360, h: 236 };
export const MENU_ROW_H = 19;

export function menuRow(x: number, y: number, k: number): { x: number; y: number; w: number; h: number } {
  return { x: x + 8, y: y + 32 + k * MENU_ROW_H, w: MENU_PANEL.w - 16, h: MENU_ROW_H - 2 };
}

export function drawMenu(
  s: Surface,
  x: number,
  y: number,
  title: string,
  right: string,
  rows: readonly MenuRow[],
  selected: number,
  footer: string | null,
  message: string | null,
): void {
  const { w, h } = MENU_PANEL;
  plate(s, x, y, w, h, C.EDGE, 0.96);
  text(s, x + 8, y + 7, title, C.GOLD, C.INK, 2);
  text(s, x + w - 8 - textWidthPx(right), y + 11, right, C.MUTED);
  rows.forEach((r, k) => {
    const b = menuRow(x, y, k);
    if (k === selected) plate(s, b.x, b.y, b.w, b.h, r.enabled ? C.EDGE : C.LAVLT2, 0.9);
    else for (let gx = b.x + 2; gx < b.x + b.w - 2; gx += 2) px(s, gx, b.y + b.h - 1, C.PLATE_HI);
    text(s, b.x + 6, b.y + 5, r.label, r.enabled ? C.CREAM : C.MUTED);
    if (r.detail) text(s, b.x + b.w - 6 - textWidthPx(r.detail), b.y + 5, r.detail, C.MUTED);
  });
  if (message) text(s, x + 8, y + h - 42, message, C.SAGE4);
  if (footer) text(s, x + 8, y + h - 30, footer, C.MUTED);
  hintKeys(s, x + 8, y + h - 16, [
    ['ENTER', 'CHOOSE'],
    ['ESC', 'BACK'],
  ]);
}
