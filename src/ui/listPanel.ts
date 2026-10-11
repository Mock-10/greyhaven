// List panels (docs/11 menus): the phone, the ATM and the bag. One page is a title, optional info lines and a list
// of rows; choosing a row runs its action. Pages are built by functions, so balances refresh after every action.
// Drawn with the hud.py primitives in the plate style of the other panels; the phone gets the muted lavender edge
// that phone messages use (docs/11). Pure code, layout-tested in tests/panels.test.ts.

import { C, hintKeys, plate, px, text, textWidthPx, type RGB, type Surface } from './hudDraw';

export type ListAction = { open: () => ListPage } | { say: string } | { close: true } | { back: true };

export interface ListRow {
  label: string;
  /** Muted note on the right (a price, a balance, why it's unavailable). */
  detail?: string;
  enabled?: boolean;
  act?: () => ListAction | void;
}

export interface ListPage {
  title: string;
  right?: string;
  /** Info lines above the rows (a balance, a status). */
  lines?: string[];
  rows: ListRow[];
}

export type ListStyle = 'phone' | 'menu';

export const LIST_SIZE: Record<ListStyle, { w: number; h: number }> = {
  phone: { w: 176, h: 224 },
  menu: { w: 232, h: 184 },
};
export const LIST_ROW_H = 14;
const LINE_H = 9;

export interface ListLayout {
  rows: { x: number; y: number; w: number; h: number }[];
  /** How many rows fit. */
  visible: number;
  lineY: number;
  messageY: number;
  hintY: number;
}

export function listLayout(
  style: ListStyle,
  x: number,
  y: number,
  page: ListPage,
  scroll: number,
): ListLayout {
  const { w, h } = LIST_SIZE[style];
  const top = y + 26 + (page.lines?.length ?? 0) * LINE_H + (page.lines?.length ? 4 : 0);
  const bottom = y + h - 26;
  const visible = Math.max(1, Math.floor((bottom - top) / LIST_ROW_H));
  const rows = page.rows.slice(scroll, scroll + visible).map((_, k) => ({
    x: x + 8,
    y: top + k * LIST_ROW_H,
    w: w - 16,
    h: LIST_ROW_H - 2,
  }));
  return { rows, visible, lineY: y + 26, messageY: y + h - 23, hintY: y + h - 13 };
}

export function drawList(
  s: Surface,
  style: ListStyle,
  x: number,
  y: number,
  page: ListPage,
  selected: number,
  scroll: number,
  message: string | null,
  canGoBack: boolean,
): void {
  const { w, h } = LIST_SIZE[style];
  const edge: RGB = style === 'phone' ? C.LAVLT2 : C.EDGE;
  plate(s, x, y, w, h, edge, 0.96);
  const big = textWidthPx(page.title, 2) + (page.right ? textWidthPx(page.right) + 12 : 0) <= w - 16;
  if (big) text(s, x + 8, y + 7, page.title, C.GOLD, C.INK, 2);
  else text(s, x + 8, y + 9, page.title, C.GOLD, C.INK);
  if (page.right) text(s, x + w - 8 - textWidthPx(page.right), y + 9, page.right, C.MUTED);
  const L = listLayout(style, x, y, page, scroll);
  (page.lines ?? []).forEach((line, k) => text(s, x + 8, L.lineY + k * LINE_H, line, C.CREAM));
  L.rows.forEach((b, k) => {
    const i = scroll + k;
    const r = page.rows[i];
    if (!r) return;
    const on = r.enabled !== false;
    if (i === selected) plate(s, b.x, b.y, b.w, b.h, on ? edge : C.PLATE_HI, 0.9);
    else for (let gx = b.x + 2; gx < b.x + b.w - 2; gx += 2) px(s, gx, b.y + b.h - 1, C.PLATE_HI);
    text(s, b.x + 4, b.y + 4, r.label, on ? C.CREAM : C.MUTED);
    if (r.detail) text(s, b.x + b.w - 4 - textWidthPx(r.detail), b.y + 4, r.detail, C.MUTED);
  });
  // scroll marks
  const last = L.rows.at(-1);
  if (scroll > 0 && L.rows[0]) text(s, x + w - 12, L.rows[0].y - 7, '^', C.MUTED);
  if (scroll + L.visible < page.rows.length && last) text(s, x + w - 12, last.y + last.h + 1, 'V', C.MUTED);
  if (message) text(s, x + 8, L.messageY, message, C.SAGE4);
  hintKeys(s, x + 8, L.hintY, [
    ['ENTER', 'CHOOSE'],
    ['ESC', canGoBack ? 'BACK' : 'CLOSE'],
  ]);
}
