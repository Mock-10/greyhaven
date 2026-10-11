// Minigame and menu panels (docs/06, docs/11; mockup art/drafts/hud/hud_mockup_lockpick.png), drawn with the
// hud.py primitives. Pure code: each function draws one panel at (x, y) from a minigame's state, so the layout can
// be checked in tests (no text or icon may overlap another: tests/panels.test.ts).

import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from '../data/items';
import type {
  DataEntryGame,
  DuffelGame,
  FilingGame,
  HotwireGame,
  MoneyCountGame,
  SkillCheckGame,
} from '../minigames/logic';
import { TRAY_COLOURS, type WireColour } from '../minigames/logic';
import type { Grade } from '../systems/career';
import {
  C,
  ITEM_CHIPS,
  ITEM_FUEL,
  ITEM_PAL,
  ITEM_SANDWICH,
  ITEM_SODA,
  bar,
  blend,
  hintKeys,
  plate,
  px,
  sprite,
  text,
  textWidthPx,
  type RGB,
  type Surface,
} from './hudDraw';

export const PANEL_SIZE = {
  filing: { w: 176, h: 128 },
  dataEntry: { w: 176, h: 128 },
  lockpick: { w: 176, h: 128 },
  hotwire: { w: 176, h: 128 },
  moneyCount: { w: 176, h: 128 },
  duffel: { w: 176, h: 128 },
  shop: { w: 208, h: 140 },
} as const;
export type PanelKind = keyof typeof PANEL_SIZE;

/** Height of the strip along the top that drags the panel. */
export const DRAG_STRIP = 20;

const GRADE_TEXT: Record<Grade, string> = {
  fail: 'FAILED',
  poor: 'POOR',
  ok: 'OK',
  good: 'GOOD',
  excellent: 'EXCELLENT',
};
const TRAY_RGB: Record<(typeof TRAY_COLOURS)[number], RGB> = {
  red: [185, 94, 94],
  navy: [94, 114, 160],
  sage: [117, 134, 114],
};
const WIRE_RGB: Record<WireColour, RGB> = {
  red: [185, 94, 94],
  navy: [94, 114, 160],
  sage: [117, 134, 114],
  khaki: [185, 180, 140],
  white: [238, 233, 232],
};
export const ITEM_ICON: Record<ItemId, readonly string[]> = {
  soda: ITEM_SODA,
  chips: ITEM_CHIPS,
  sandwich: ITEM_SANDWICH,
  fuel_can: ITEM_FUEL,
};

/** The frame every panel shares: plate, gold 2× title, a muted label on the right, and a grip in the drag strip. */
export function frame(s: Surface, x: number, y: number, kind: PanelKind, title: string, right: string): void {
  const { w, h } = PANEL_SIZE[kind];
  plate(s, x, y, w, h, C.EDGE, 0.96);
  text(s, x + 8, y + 7, title, C.GOLD, C.INK, 2);
  const rw = textWidthPx(right);
  text(s, x + w - 8 - rw, y + 9, right, C.MUTED);
  // grip dots between the title and the right label: the panel can be dragged by its top strip
  const gx0 = x + 8 + textWidthPx(title, 2) + 8;
  const gx1 = x + w - 8 - rw - 8;
  for (let gx = gx0; gx + 1 < gx1; gx += 4) {
    px(s, gx, y + 9, C.PLATE_HI);
    px(s, gx, y + 12, C.PLATE_HI);
  }
}

/** The end-of-task card: drawn instead of the panel body once a minigame is done. */
export function resultCard(
  s: Surface,
  x: number,
  y: number,
  kind: PanelKind,
  grade: Grade,
  caption: string,
): void {
  const { w } = PANEL_SIZE[kind];
  const t = GRADE_TEXT[grade];
  const col = grade === 'fail' || grade === 'poor' ? C.RED3 : C.GOLD;
  text(s, x + Math.round((w - textWidthPx(caption)) / 2), y + 44, caption, C.MUTED);
  text(s, x + Math.round((w - textWidthPx(t, 2)) / 2), y + 54, t, col, C.INK, 2);
}

// ------------------------------------------------------------------ filing
export interface FilingLayout {
  paper: { x: number; y: number; w: number; h: number };
  trays: { x: number; y: number; w: number; h: number }[];
}

export function filingLayout(
  x: number,
  y: number,
  f: FilingGame,
  drag: { x: number; y: number } | null,
): FilingLayout {
  const paper = drag
    ? { x: Math.round(drag.x), y: Math.round(drag.y), w: 22, h: 26 }
    : { x: x + 38, y: Math.round(y + 24 + f.fall * 34), w: 22, h: 26 };
  return { paper, trays: [0, 1, 2].map((k) => ({ x: x + 8 + k * 30, y: y + 88, w: 26, h: 10 })) };
}

export function drawFiling(
  s: Surface,
  x: number,
  y: number,
  f: FilingGame,
  task: string,
  drag: { x: number; y: number } | null,
): void {
  frame(s, x, y, 'filing', 'FILING', task);
  if (f.done && f.grade) return resultCard(s, x, y, 'filing', f.grade, 'TASK DONE');
  const L = filingLayout(x, y, f, drag);
  blend(s, y + 22, y + 85, x + 8, x + 92, C.INK);
  TRAY_COLOURS.forEach((c, k) => {
    const t = L.trays[k] as FilingLayout['trays'][number];
    blend(s, t.y, t.y + t.h, t.x, t.x + t.w, TRAY_RGB[c]);
    blend(s, t.y, t.y + 2, t.x, t.x + t.w, C.INK, 0.4);
    text(s, t.x + Math.round((t.w - textWidthPx(String(k + 1))) / 2), t.y + 3, String(k + 1), C.CREAM);
  });
  if (f.current) {
    const r = L.paper;
    blend(s, r.y + 1, r.y + r.h + 1, r.x + 1, r.x + r.w + 1, C.INK, 0.6);
    blend(s, r.y, r.y + r.h, r.x, r.x + r.w, C.CREAM);
    blend(s, r.y, r.y + 6, r.x, r.x + r.w, TRAY_RGB[f.current]);
    for (let k = 0; k < 5; k++)
      blend(s, r.y + 9 + k * 3, r.y + 10 + k * 3, r.x + 3, r.x + r.w - 3 - (k % 2) * 5, C.MUTED);
  }
  const rx = x + 100;
  text(s, rx, y + 26, 'PROGRESS', C.MUTED);
  bar(s, rx, y + 34, 66, 7, f.index / f.papers.length, C.GOLD, C.GOLD_LO);
  text(s, rx, y + 46, `FILED ${f.correct}`, C.CREAM);
  text(s, rx, y + 55, `MISFILED ${f.misfiled}`, f.misfiled ? C.RED3 : C.MUTED);
  text(s, rx, y + 64, `DROPPED ${f.missed}`, f.missed ? C.RED3 : C.MUTED);
  // the stamp of the last paper, in the right column so it never covers the trays
  if (f.last && f.last.t < 0.6) {
    const word = f.last.ok ? 'FILED' : 'WRONG';
    const col = f.last.ok ? C.SAGE4 : C.RED3;
    plate(s, rx - 2, y + 75, textWidthPx(word) + 7, 11, col, 0.9);
    text(s, rx + 2, y + 78, word, col);
  } else text(s, rx, y + 78, 'DRAG TO A TRAY', C.MUTED);
  hintKeys(s, x + 8, y + 112, [
    ['1-3', 'FILE'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ data entry
export function drawEntry(s: Surface, x: number, y: number, e: DataEntryGame, task: string): void {
  frame(s, x, y, 'dataEntry', 'DATA ENTRY', task);
  if (e.done && e.grade) return resultCard(s, x, y, 'dataEntry', e.grade, 'TASK DONE');
  const word = e.word;
  const kw = 13;
  const wx = x + Math.round((PANEL_SIZE.dataEntry.w - word.length * (kw + 3)) / 2);
  text(s, x + 8, y + 28, `RECORD ${Math.min(e.round + 1, e.rounds.length)}/${e.rounds.length}`, C.MUTED);
  [...word].forEach((ch, k) => {
    const kx = wx + k * (kw + 3);
    const ky = y + 42;
    const done = k < e.pos;
    const cur = k === e.pos;
    blend(s, ky, ky + kw, kx, kx + kw, done ? C.SAGE1 : cur ? C.GOLD : C.CREAM);
    blend(s, ky + kw - 2, ky + kw, kx, kx + kw, done ? C.INK : C.GOLD_LO);
    text(s, kx + Math.round((kw - textWidthPx(ch)) / 2), ky + 3, ch, done ? C.SAGE4 : C.PLATE);
  });
  if (e.wrongT < 0.3) blend(s, y + 38, y + 39, x + 8, x + PANEL_SIZE.dataEntry.w - 8, C.RED3);
  text(s, x + 8, y + 70, 'TIME', C.MUTED);
  bar(s, x + 32, y + 69, PANEL_SIZE.dataEntry.w - 40, 7, e.timeLeft / e.timeTotal, C.GOLD, C.GOLD_LO);
  text(s, x + 8, y + 84, `ERRORS ${e.errors}`, e.errors ? C.RED3 : C.MUTED);
  hintKeys(s, x + 8, y + 112, [
    ['A-Z', 'TYPE'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ lockpick (the mockup)
export function drawLockpick(
  s: Surface,
  x: number,
  y: number,
  g: SkillCheckGame,
  tier: number,
  tool: string,
): void {
  frame(s, x, y, 'lockpick', 'LOCKPICK', `TIER ${tier}`);
  if (g.done && g.grade)
    return resultCard(s, x, y, 'lockpick', g.grade, g.grade === 'fail' ? 'THE PICK SLIPPED' : 'UNLOCKED');
  const dcx = x + 54;
  const dcy = y + 70;
  const r = 32;
  for (let j = -r - 2; j <= r + 2; j++)
    for (let i = -r - 2; i <= r + 2; i++) {
      const d = Math.hypot(i + 0.5, j + 0.5);
      const ang = ((Math.atan2(j + 0.5, i + 0.5) * 180) / Math.PI + 90 + 360) % 360;
      const off = Math.abs(((ang - g.zone + 540) % 360) - 180);
      if (d <= r - 12) px(s, dcx + i, dcy + j, C.PLATE);
      else if (d <= r - 9) px(s, dcx + i, dcy + j, C.PLATE_HI);
      else if (d <= r - 1)
        px(
          s,
          dcx + i,
          dcy + j,
          off <= g.great / 2 ? C.GOLD : off <= g.good / 2 ? C.CREAM : ([80, 63, 88] as RGB),
        );
      else if (d <= r + 1) px(s, dcx + i, dcy + j, C.INK);
    }
  const a = ((g.needle - 90) * Math.PI) / 180;
  for (let t = 0; t <= r - 2; t += 0.5) {
    const nx = Math.round(dcx + t * Math.cos(a));
    const ny = Math.round(dcy + t * Math.sin(a));
    px(s, nx, ny, C.HP);
    px(s, nx + 1, ny, C.HP);
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(s, dcx + dx, dcy + dy, C.GOLD);
  const rx = x + 100;
  text(s, rx, y + 30, 'PROGRESS', C.MUTED);
  bar(s, rx, y + 38, 66, 7, g.progress, C.GOLD, C.GOLD_LO);
  text(s, rx, y + 52, 'CHECKS', C.MUTED);
  for (let k = 0; k < g.checks; k++)
    blend(s, y + 60, y + 66, rx + k * 10, rx + k * 10 + 7, k < g.passed ? C.GOLD : C.PLATE_HI);
  text(s, rx, y + 74, 'TOOL', C.MUTED);
  text(s, rx, y + 82, tool, C.CREAM);
  hintKeys(s, x + 8, y + 112, [
    ['SPACE', 'HIT'],
    ['ESC', 'ABORT'],
  ]);
  text(s, x + 104, y + 114, 'NOISE', C.MUTED);
  for (let k = 0; k < 3; k++)
    blend(
      s,
      y + 114,
      y + 119,
      x + 128 + k * 6,
      x + 132 + k * 6,
      k < Math.round(g.noise * 3) ? C.HP : C.PLATE_HI,
    );
}

// ------------------------------------------------------------------ hotwire
export function hotwireLayout(
  x: number,
  y: number,
  n: number,
): { left: { x: number; y: number }[]; right: { x: number; y: number }[] } {
  const rows = Array.from({ length: n }, (_, k) => y + 28 + k * 14);
  return { left: rows.map((ry) => ({ x: x + 20, y: ry })), right: rows.map((ry) => ({ x: x + 136, y: ry })) };
}

export function drawHotwire(s: Surface, x: number, y: number, g: HotwireGame): void {
  frame(s, x, y, 'hotwire', 'HOTWIRE', 'TIER 0');
  if (g.done && g.grade)
    return resultCard(s, x, y, 'hotwire', g.grade, g.grade === 'fail' ? 'IT WONT START' : 'ENGINE RUNNING');
  const L = hotwireLayout(x, y, g.left.length);
  const keysR = ['A', 'S', 'D', 'F', 'G'];
  blend(s, y + 24, y + 28 + g.left.length * 14, x + 8, x + 168, C.INK, 0.7);
  g.left.forEach((c, k) => {
    const p = L.left[k] as { x: number; y: number };
    text(s, x + 11, p.y, String(k + 1), g.selected === k ? C.GOLD : C.CREAM);
    blend(s, p.y + 1, p.y + 4, p.x, p.x + 18, WIRE_RGB[c]);
    if (g.selected === k) blend(s, p.y - 1, p.y + 6, p.x - 2, p.x, C.GOLD);
  });
  g.right.forEach((c, k) => {
    const p = L.right[k] as { x: number; y: number };
    blend(s, p.y + 1, p.y + 4, p.x, p.x + 18, WIRE_RGB[c]);
    text(s, p.x + 22, p.y, keysR[k] as string, C.CREAM);
  });
  // joined wires run straight across
  g.left.forEach((c, k) => {
    if (!g.connected[k]) return;
    const a = L.left[k] as { x: number; y: number };
    const j = g.right.indexOf(c);
    const b = L.right[j] as { x: number; y: number };
    const steps = 60;
    for (let t = 0; t <= steps; t++) {
      const xx = Math.round(a.x + 18 + ((b.x - a.x - 18) * t) / steps);
      const yy = Math.round(a.y + 2 + ((b.y - a.y) * t) / steps);
      px(s, xx, yy, WIRE_RGB[c]);
      px(s, xx, yy + 1, WIRE_RGB[c]);
    }
  });
  if (g.sparkT < 0.3) blend(s, y + 24, y + 25, x + 8, x + 168, C.GOLD_HI);
  text(s, x + 8, y + 90, 'TIME', C.MUTED);
  bar(s, x + 32, y + 89, 136, 7, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  text(s, x + 8, y + 101, `SPARKS ${g.sparks}`, g.sparks ? C.RED3 : C.MUTED);
  hintKeys(s, x + 8, y + 112, [
    ['1-4', 'PICK'],
    ['ASDF', 'JOIN'],
    ['ESC', 'ABORT'],
  ]);
}

// ------------------------------------------------------------------ money count
/** Bill rows that fit on the table drawn in the money-count panel. */
export const MAX_PILE_ROWS = 12;

export function drawMoneyCount(s: Surface, x: number, y: number, g: MoneyCountGame, right: string): void {
  frame(s, x, y, 'moneyCount', 'COUNT CASH', right);
  if (g.done && g.grade) return resultCard(s, x, y, 'moneyCount', g.grade, 'CASH COUNTED');
  // the pile on the table: one bill per row, a band of khaki and sage; bills past ten turn red (over-count),
  // and the stack stops growing at the top of the table
  blend(s, y + 24, y + 98, x + 8, x + 88, C.INK, 0.7);
  for (let k = 0; k < Math.min(g.pile, MAX_PILE_ROWS); k++) {
    const by = y + 90 - k * 6;
    blend(s, by, by + 5, x + 20, x + 76, k >= 10 ? C.DIRTY : C.KHAKI4);
    blend(s, by + 1, by + 4, x + 42, x + 54, k >= 10 ? C.HP_LO : C.SAGE1);
  }
  for (let k = 0; k < g.bundles; k++) blend(s, y + 30 + k * 8, y + 36 + k * 8, x + 80, x + 86, C.SAGE4);
  const rx = x + 96;
  text(s, rx, y + 28, `PILE ${g.pile}/10`, g.pile === 10 ? C.GOLD : g.pile > 10 ? C.RED3 : C.CREAM);
  text(s, rx, y + 40, `COUNTED ${g.counted}/${g.bills}`, C.MUTED);
  text(s, rx, y + 49, `BUNDLES ${g.bundles}`, C.CREAM);
  text(s, rx, y + 58, `MISCOUNTS ${g.miscounts}`, g.miscounts ? C.RED3 : C.MUTED);
  text(s, rx, y + 72, 'TIME', C.MUTED);
  bar(s, rx, y + 80, 70, 7, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  hintKeys(s, x + 8, y + 112, [
    ['SPACE', 'COUNT'],
    ['B', 'BAND'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ duffel (Dez's laundering)
type Box = { x: number; y: number; w: number; h: number };

export interface DuffelLayout {
  /** One rect per table slot. */
  slots: Box[];
  /** Drop a stack anywhere over the bag. */
  bag: Box;
}

const STACK_W = 17;
const STACK_H = 12;

export function duffelLayout(x: number, y: number, n: number): DuffelLayout {
  const slots: Box[] = [];
  for (let k = 0; k < n; k++)
    slots.push({ x: x + 12 + (k % 4) * 20, y: y + 34 + Math.floor(k / 4) * 28, w: STACK_W, h: STACK_H });
  return { slots, bag: { x: x + 100, y: y + 30, w: 68, h: 62 } };
}

/** A banded stack of bills; dye-stained ones carry red blotches. */
function cashStack(s: Surface, x: number, y: number, dyed: boolean): void {
  blend(s, y + 2, y + STACK_H, x + 1, x + STACK_W + 1, C.INK, 0.6); // shadow
  for (let k = 0; k < 3; k++)
    blend(s, y + 2 * k, y + 2 * k + 8, x, x + STACK_W, k === 2 ? C.KHAKI4 : C.STONE5);
  blend(s, y + 4, y + 12, x, x + STACK_W, C.KHAKI4);
  blend(s, y + 5, y + 11, x + 6, x + 11, C.SAGE1); // the band
  if (dyed) {
    for (const [dx, dy, w, h] of [
      [1, 5, 4, 3],
      [12, 4, 4, 4],
      [8, 9, 3, 2],
      [3, 1, 3, 2],
    ] as const)
      blend(s, y + dy, y + dy + h, x + dx, x + dx + w, C.DIRTY);
    px(s, x + 13, y + 6, C.HP);
    px(s, x + 2, y + 6, C.HP);
  }
}

/** A stack being dragged, drawn at the pointer. */
export function drawHeldStack(s: Surface, x: number, y: number, dyed: boolean): void {
  cashStack(s, Math.round(x - STACK_W / 2), Math.round(y - STACK_H / 2), dyed);
}

export function drawDuffel(
  s: Surface,
  x: number,
  y: number,
  g: DuffelGame,
  right: string,
  held: number | null,
): void {
  frame(s, x, y, 'duffel', 'BAG IT', right);
  if (g.done && g.grade) return resultCard(s, x, y, 'duffel', g.grade, 'CASH BAGGED');
  const L = duffelLayout(x, y, g.stacks.length);
  // the counting table
  blend(s, y + 26, y + 96, x + 8, x + 94, C.INK, 0.7);
  g.stacks.forEach((st, k) => {
    const r = L.slots[k] as Box;
    if (st.bagged || k === held) {
      blend(s, r.y + 4, r.y + 12, r.x, r.x + STACK_W, C.PLATE_HI);
      return;
    }
    cashStack(s, r.x, r.y, st.dyed);
  });
  // the open duffel: a navy canvas barrel with darker end caps, a dark open mouth along the top with the zip
  // pulled back, bagged stacks showing in the mouth, and two carry handles
  const b = L.bag;
  const flash = g.flash && g.flash.t < 0.35 ? (g.flash.ok ? C.SAGE4 : C.RED3) : null;
  const NAVY: RGB = [70, 82, 118];
  const NAVY_LO: RGB = [52, 62, 94];
  const NAVY_HI: RGB = [96, 110, 150];
  const top = b.y + 16;
  const bot = b.y + 60;
  const cx = b.x + b.w / 2;
  for (let yy = top; yy < bot; yy++) {
    const t = (yy - (top + bot) / 2) / ((bot - top) / 2);
    const half = Math.round((b.w / 2 - 2) * Math.sqrt(Math.max(0, 1 - t * t * t * t)));
    if (half <= 0) continue;
    blend(s, yy, yy + 1, cx - half, cx + half, yy > bot - 6 ? NAVY_LO : NAVY);
    // end caps and a seam piping
    blend(s, yy, yy + 1, cx - half, cx - half + 5, NAVY_LO);
    blend(s, yy, yy + 1, cx + half - 5, cx + half, NAVY_LO);
    px(s, cx - half + 5, yy, NAVY_HI);
    px(s, cx + half - 6, yy, NAVY_HI);
  }
  blend(s, top + 6, top + 7, cx - 22, cx + 22, NAVY_HI); // light catching the upper curve
  // the mouth
  const my0 = top - 2;
  const my1 = top + 12;
  for (let yy = my0; yy < my1; yy++) {
    const t = (yy - (my0 + my1) / 2) / ((my1 - my0) / 2);
    const half = Math.round(24 * Math.sqrt(Math.max(0, 1 - t * t)));
    blend(s, yy, yy + 1, cx - half, cx + half, C.INK);
  }
  // zip teeth along the rim, gold-free khaki
  for (let k = -24; k <= 24; k += 3) {
    const ry = Math.round(
      my0 + (my1 - my0) / 2 - Math.sqrt(Math.max(0, 1 - (k / 25) ** 2)) * ((my1 - my0) / 2),
    );
    px(s, cx + k, ry - 1, flash ?? C.KHAKI4);
  }
  const inBag = g.stacks.filter((q) => q.bagged).length;
  for (let k = 0; k < inBag; k++) {
    const sx = cx - 18 + (k % 4) * 9;
    const sy = my1 - 5 - Math.floor(k / 4) * 3;
    blend(s, sy, sy + 3, sx, sx + 8, C.KHAKI4);
    blend(s, sy, sy + 1, sx, sx + 8, C.STONE5);
  }
  for (const hx of [cx - 16, cx + 9]) {
    blend(s, b.y + 6, b.y + 8, hx, hx + 8, NAVY_LO);
    blend(s, b.y + 6, top, hx, hx + 2, NAVY_LO);
    blend(s, b.y + 6, top, hx + 6, hx + 8, NAVY_LO);
  }
  text(s, x + 8, y + 101, `IN BAG ${g.cleanBagged}/${g.cleanTotal}`, C.CREAM);
  if (g.dyedBagged) text(s, x + 58, y + 101, `DYE ${g.dyedBagged}`, C.RED3);
  text(s, x + 100, y + 101, 'TIME', C.MUTED);
  bar(s, x + 120, y + 100, 48, 7, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  text(s, x + 106, y + 23, 'LEAVE DYE OUT', C.MUTED);
  hintKeys(s, x + 8, y + 112, [
    ['DRAG', 'INTO BAG'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ shop
export interface ShopView {
  title: string;
  stock: readonly ItemId[];
  clean: number;
  selected: number;
  message: string | null;
}

export function shopCard(x: number, y: number, k: number): { x: number; y: number; w: number; h: number } {
  return { x: x + 8 + (k % 2) * 98, y: y + 24 + Math.floor(k / 2) * 40, w: 94, h: 36 };
}

export function drawShop(s: Surface, x: number, y: number, v: ShopView): void {
  frame(s, x, y, 'shop', 'SHOP', v.title);
  v.stock.forEach((id, k) => {
    const c = shopCard(x, y, k);
    const price = BALANCE.shop[id].price;
    const can = v.clean >= price;
    plate(s, c.x, c.y, c.w, c.h, k === v.selected ? C.EDGE : C.LAVLT2, 0.9);
    // icon in its own frame
    blend(s, c.y + 4, c.y + 32, c.x + 4, c.x + 26, C.INK, 0.8);
    sprite(s, c.x + 8, c.y + 11, ITEM_ICON[id], ITEM_PAL);
    text(s, c.x + 30, c.y + 6, ITEMS[id].name, can ? C.CREAM : C.MUTED);
    const eff = BALANCE.shop[id].heal ? `+${BALANCE.shop[id].heal} HP` : '10 FUEL';
    text(s, c.x + 30, c.y + 15, eff, C.MUTED);
    text(s, c.x + 30, c.y + 25, `$${price}`, can ? C.CREAM : C.RED3);
    // number key
    const key = String(k + 1);
    blend(s, c.y + 22, c.y + 31, c.x + c.w - 13, c.x + c.w - 4, C.GOLD);
    blend(s, c.y + 30, c.y + 31, c.x + c.w - 13, c.x + c.w - 4, C.GOLD_LO);
    text(s, c.x + c.w - 11, c.y + 24, key, C.PLATE);
  });
  text(s, x + 8, y + 106, `CLEAN CASH $${v.clean}`, C.CREAM);
  const dirty = 'DIRTY CASH NOT ACCEPTED';
  text(s, x + PANEL_SIZE.shop.w - 8 - textWidthPx(dirty), y + 106, dirty, C.MUTED);
  if (v.message) text(s, x + 8, y + 116, v.message, C.SAGE4);
  hintKeys(s, x + 8, y + 126, [
    ['1-4', 'BUY'],
    ['CLICK', 'BUY'],
    ['ESC', 'LEAVE'],
  ]);
}
