// List panels (docs/11 menus): the phone, the ATM and the bag. One page is a title, optional info lines and rows;
// choosing a row runs its action. Pages are built by functions, so balances refresh after every action.
// UI redesign (user request 2026-10-12: larger text, more images): rows carry a rendered icon or portrait and a
// second line; a page can lay its rows out as a grid of picture tiles (the phone's home screen, the bag, the ATM's
// cash buttons). The phone is drawn as a handset with a screen. Pure code, layout-tested in tests/panels.test.ts.

import {
  C,
  LINE,
  hintKeys,
  plate,
  px,
  text,
  textWidthPx,
  blend,
  small,
  markLastOver,
  type RGB,
  type Surface,
} from './hudDraw';
import { icon, iconSize, type IconName } from './icons';

export type ListAction = { open: () => ListPage } | { say: string } | { close: true } | { back: true };

export interface ListRow {
  label: string;
  /** Muted note on the right (a price, a balance, why it's unavailable). */
  detail?: string;
  /** A second, muted line under the label. */
  sub?: string;
  /** A picture: an item, an app, a portrait. */
  icon?: IconName;
  /** A count or alert in a red pill on the picture (unread messages, items held). */
  badge?: string;
  enabled?: boolean;
  act?: () => ListAction | void;
}

export interface ListPage {
  title: string;
  right?: string;
  /** Info lines above the rows (a balance, a status). */
  lines?: string[];
  /** A picture beside the info lines (the bank, a portrait). */
  icon?: IconName;
  /** Rows as a list (the default) or as a grid of picture tiles. */
  layout?: 'rows' | 'grid';
  rows: ListRow[];
}

export type ListStyle = 'phone' | 'menu';

export const LIST_SIZE: Record<ListStyle, { w: number; h: number }> = {
  phone: { w: 216, h: 330 },
  menu: { w: 300, h: 250 },
};
/** Row heights: with a picture, and text only. */
export const LIST_ROW_H = 38;
export const LIST_ROW_TEXT_H = 18;
export const TILE = { w: 60, h: 62 };
const LINE_H = 10;

export interface ListLayout {
  /** The screen (phone) or the panel's inside (menu). */
  screen: { x: number; y: number; w: number; h: number };
  titleY: number;
  rows: { x: number; y: number; w: number; h: number }[];
  /** How many rows fit, and the grid's columns (1 for a list). */
  visible: number;
  cols: number;
  lineY: number;
  messageY: number;
  hintY: number;
}

function screenOf(style: ListStyle, x: number, y: number): ListLayout['screen'] {
  const { w, h } = LIST_SIZE[style];
  return style === 'phone'
    ? { x: x + 9, y: y + 20, w: w - 18, h: h - 46 }
    : { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
}

export function listLayout(
  style: ListStyle,
  x: number,
  y: number,
  page: ListPage,
  scroll: number,
): ListLayout {
  const sc = screenOf(style, x, y);
  const titleY = sc.y + (style === 'phone' ? 14 : 7);
  const lineY = titleY + 2 * LINE + 6;
  const nLines = page.lines?.length ?? 0;
  const linesH = Math.max(nLines * LINE_H, page.icon && nLines ? iconSize(page.icon).h : 0);
  const top = lineY + (nLines ? linesH + 6 : 0);
  const hintY = sc.y + sc.h - 15;
  const messageY = hintY - 12;
  const bottom = messageY - 3;
  const inner = { x: sc.x + 6, w: sc.w - 12 };
  if (page.layout === 'grid') {
    const cols = Math.max(1, Math.floor(inner.w / TILE.w));
    const gap = Math.floor((inner.w - cols * TILE.w) / Math.max(1, cols - 1));
    const rowsFit = Math.max(1, Math.floor((bottom - top) / (TILE.h + 4)));
    const visible = cols * rowsFit;
    const start = Math.floor(scroll / cols) * cols;
    const rows = page.rows.slice(start, start + visible).map((_, k) => ({
      x: inner.x + (k % cols) * (TILE.w + gap),
      y: top + Math.floor(k / cols) * (TILE.h + 4),
      w: TILE.w,
      h: TILE.h,
    }));
    return { screen: sc, titleY, rows, visible, cols, lineY, messageY, hintY };
  }
  const iconH = Math.max(0, ...page.rows.map((r) => (r.icon ? iconSize(r.icon).h : 0)));
  const rh = iconH ? Math.max(LIST_ROW_H, iconH + 6) : LIST_ROW_TEXT_H;
  const visible = Math.max(1, Math.floor((bottom - top) / rh));
  const rows = page.rows.slice(scroll, scroll + visible).map((_, k) => ({
    x: inner.x,
    y: top + k * rh,
    w: inner.w,
    h: rh - 2,
  }));
  return { screen: sc, titleY, rows, visible, cols: 1, lineY, messageY, hintY };
}

/** The handset: a dark rounded body, a speaker slit, the screen, a home button. */
function handset(s: Surface, x: number, y: number, clock: string): void {
  const { w, h } = LIST_SIZE.phone;
  const BODY: RGB = [36, 30, 44];
  const BODY_HI: RGB = [72, 59, 80];
  const SCREEN: RGB = [45, 34, 46];
  for (let j = 0; j < h; j++) {
    // rounded corners, radius 6
    const dy = Math.max(0, 6 - j, j - (h - 7));
    const inset = dy ? 6 - Math.round(Math.sqrt(Math.max(0, 36 - dy * dy))) : 0;
    blend(s, y + j, y + j + 1, x + inset, x + w - inset, BODY);
  }
  blend(s, y + 2, y + 3, x + 7, x + w - 7, BODY_HI); // light on the top edge
  blend(s, y + 9, y + 11, x + w / 2 - 14, x + w / 2 + 14, [20, 16, 24]); // speaker
  const sc = screenOf('phone', x, y);
  blend(s, sc.y, sc.y + sc.h, sc.x, sc.x + sc.w, SCREEN);
  // status bar: the clock and a signal and battery
  blend(s, sc.y, sc.y + 9, sc.x, sc.x + sc.w, [36, 27, 40]);
  small(s, sc.x + 4, sc.y + 2, clock, C.MUTED);
  for (let k = 0; k < 4; k++)
    blend(s, sc.y + 6 - k, sc.y + 7, sc.x + sc.w - 30 + k * 3, sc.x + sc.w - 28 + k * 3, C.MUTED);
  blend(s, sc.y + 2, sc.y + 7, sc.x + sc.w - 14, sc.x + sc.w - 4, C.MUTED);
  blend(s, sc.y + 3, sc.y + 6, sc.x + sc.w - 13, sc.x + sc.w - 7, C.SAGE4);
  // home button
  const hb = { x: x + w / 2 - 9, y: y + h - 19 };
  blend(s, hb.y, hb.y + 12, hb.x + 2, hb.x + 16, BODY_HI);
  blend(s, hb.y + 2, hb.y + 10, hb.x, hb.x + 18, BODY_HI);
  blend(s, hb.y + 3, hb.y + 9, hb.x + 3, hb.x + 15, BODY);
}

function badge(s: Surface, xr: number, y: number, str: string): void {
  const w = textWidthPx(str, 1, 'small') + 6;
  blend(s, y, y + 9, xr - w, xr, C.RED3);
  blend(s, y + 1, y + 8, xr - w - 1, xr + 1, C.RED3);
  small(s, xr - w + 3, y + 2, str, C.CREAM);
  markLastOver();
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
  clock = '',
): void {
  const { w, h } = LIST_SIZE[style];
  const edge: RGB = style === 'phone' ? C.LAVLT2 : C.EDGE;
  if (style === 'phone') handset(s, x, y, clock);
  else plate(s, x, y, w, h, edge, 0.96);
  const L = listLayout(style, x, y, page, scroll);
  const sc = L.screen;
  const tx = sc.x + 6;
  const room = sc.w - 12 - (page.right ? textWidthPx(page.right) + 8 : 0);
  if (textWidthPx(page.title, 2) <= room) text(s, tx, L.titleY, page.title, C.GOLD, C.INK, 2);
  else text(s, tx, L.titleY + 4, page.title, C.GOLD, C.INK);
  if (page.right) text(s, sc.x + sc.w - 6 - textWidthPx(page.right), L.titleY + 4, page.right, C.MUTED);
  // a line under the title
  for (let gx = tx; gx < sc.x + sc.w - 6; gx += 2) px(s, gx, L.titleY + 2 * LINE + 2, C.PLATE_HI);
  let lx = tx;
  if (page.icon && page.lines?.length) {
    icon(s, tx, L.lineY, page.icon);
    lx += iconSize(page.icon).w + 6;
  }
  (page.lines ?? []).forEach((line, k) => text(s, lx, L.lineY + k * LINE_H, line, C.CREAM));
  const grid = page.layout === 'grid';
  const start = grid ? Math.floor(scroll / L.cols) * L.cols : scroll;
  L.rows.forEach((b, k) => {
    const i = start + k;
    const r = page.rows[i];
    if (!r) return;
    const on = r.enabled !== false;
    const sel = i === selected;
    if (grid) {
      if (sel) plate(s, b.x, b.y, b.w, b.h, on ? edge : C.PLATE_HI, 0.9);
      else blend(s, b.y, b.y + b.h, b.x, b.x + b.w, [36, 27, 40], 0.55);
      if (r.icon) {
        const z = iconSize(r.icon);
        icon(
          s,
          b.x + Math.floor((b.w - z.w) / 2),
          b.y + 4 + Math.floor((40 - z.h) / 2),
          r.icon,
          on ? 1 : 0.45,
        );
      }
      if (r.badge) badge(s, b.x + b.w - 3, b.y + 3, r.badge);
      const lw = textWidthPx(r.label);
      text(s, b.x + Math.floor((b.w - lw) / 2), b.y + b.h - 13, r.label, on ? C.CREAM : C.MUTED);
      return;
    }
    if (sel) plate(s, b.x, b.y, b.w, b.h, on ? edge : C.PLATE_HI, 0.9);
    else for (let gx = b.x + 2; gx < b.x + b.w - 2; gx += 2) px(s, gx, b.y + b.h - 1, C.PLATE_HI);
    let cx = b.x + 4;
    if (r.icon) {
      const z = iconSize(r.icon);
      icon(s, cx, b.y + Math.floor((b.h - z.h) / 2), r.icon, on ? 1 : 0.45);
      if (r.badge) badge(s, cx + z.w + 2, b.y + 2, r.badge);
      cx += z.w + 6;
    }
    const ty = r.sub ? b.y + Math.floor(b.h / 2) - LINE - 1 : b.y + Math.floor((b.h - LINE) / 2);
    text(s, cx, ty, r.label, on ? C.CREAM : C.MUTED);
    if (r.sub) text(s, cx, ty + LINE + 3, r.sub, C.MUTED);
    if (r.detail) text(s, b.x + b.w - 5 - textWidthPx(r.detail), ty, r.detail, on ? C.KHAKI4 : C.MUTED);
  });
  // scroll marks
  const first = L.rows[0];
  const last = L.rows.at(-1);
  if (start > 0 && first) text(s, sc.x + sc.w - 12, first.y - 9, '^', C.MUTED);
  if (start + L.visible < page.rows.length && last)
    text(s, sc.x + sc.w - 12, last.y + last.h + 1, 'V', C.MUTED);
  if (message) text(s, tx, L.messageY, message, C.SAGE4);
  else if (grid) {
    // a tile's picture says what it is; its line of detail shows while it's selected
    const r = page.rows[selected];
    const note = r ? [r.sub, r.detail].filter(Boolean).join('  ') : '';
    if (note) text(s, tx, L.messageY, note, C.MUTED);
  }
  hintKeys(s, tx, L.hintY, [
    ['ENTER', 'CHOOSE'],
    ['ESC', canGoBack ? 'BACK' : 'CLOSE'],
  ]);
}
