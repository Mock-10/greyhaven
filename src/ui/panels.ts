// Minigame and menu panels (docs/06, docs/11; mockup art/drafts/hud/hud_mockup_lockpick.png), drawn with the
// hud.py primitives. Pure code: each function draws one panel at (x, y) from a minigame's state, so the layout can
// be checked in tests (no text or icon may overlap another: tests/panels.test.ts).
// UI redesign (user request 2026-10-12: larger text, more images): bigger panels, the 5 × 7 body font, and the
// rendered item icons (art/source/ui_icons.py) on shop cards and in the trunk.

import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from '../data/items';
import type {
  DataEntryGame,
  DuffelGame,
  FilingGame,
  HotwireGame,
  MoneyCountGame,
  SearchGame,
  SkillCheckGame,
} from '../minigames/logic';
import { glints, type LootKind } from '../systems/loot';
import { TRAY_COLOURS, type WireColour } from '../minigames/logic';
import type { Grade } from '../systems/career';
import {
  C,
  bar,
  blend,
  hintKeys,
  hintKeysWidth,
  plate,
  px,
  text,
  textWidthPx,
  type RGB,
  type Surface,
} from './hudDraw';
import { icon, type IconName } from './icons';

export const PANEL_SIZE = {
  filing: { w: 248, h: 176 },
  dataEntry: { w: 248, h: 176 },
  lockpick: { w: 248, h: 176 },
  hotwire: { w: 248, h: 176 },
  moneyCount: { w: 248, h: 176 },
  duffel: { w: 248, h: 176 },
  shop: { w: 300, h: 236 },
  search: { w: 216, h: 196 },
} as const;
export type PanelKind = keyof typeof PANEL_SIZE;

/** Height of the strip along the top that drags the panel. */
export const DRAG_STRIP = 26;

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
/** The rendered picture of each shop item. */
export const ITEM_ICON: Record<ItemId, IconName> = {
  soda: 'item/soda',
  chips: 'item/chips',
  sandwich: 'item/sandwich',
  fuel_can: 'item/fuel_can',
  first_aid: 'item/first_aid',
  lockpicks: 'item/lockpicks',
  toolbox: 'item/toolbox',
  repair_kit: 'item/repair_kit',
};

/** The frame every panel shares: plate, gold 2× title, a muted label on the right, and a grip in the drag strip. */
export function frame(s: Surface, x: number, y: number, kind: PanelKind, title: string, right: string): void {
  const { w, h } = PANEL_SIZE[kind];
  plate(s, x, y, w, h, C.EDGE, 0.96);
  text(s, x + 8, y + 7, title, C.GOLD, C.INK, 2);
  const rw = textWidthPx(right);
  text(s, x + w - 8 - rw, y + 11, right, C.MUTED);
  // grip dots between the title and the right label: the panel can be dragged by its top strip
  const gx0 = x + 8 + textWidthPx(title, 2) + 8;
  const gx1 = x + w - 8 - rw - 8;
  for (let gx = gx0; gx + 1 < gx1; gx += 4) {
    px(s, gx, y + 12, C.PLATE_HI);
    px(s, gx, y + 16, C.PLATE_HI);
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
  text(s, x + Math.round((w - textWidthPx(caption)) / 2), y + 64, caption, C.MUTED);
  text(s, x + Math.round((w - textWidthPx(t, 2)) / 2), y + 78, t, col, C.INK, 2);
}

/** Key hints along the bottom of a minigame panel; returns their width. */
function footer(
  s: Surface,
  x: number,
  y: number,
  kind: PanelKind,
  items: readonly [string, string][],
): number {
  return hintKeys(s, x + 8, y + PANEL_SIZE[kind].h - 17, items);
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
    ? { x: Math.round(drag.x), y: Math.round(drag.y), w: 28, h: 34 }
    : { x: x + 54, y: Math.round(y + 32 + f.fall * 58), w: 28, h: 34 };
  return { paper, trays: [0, 1, 2].map((k) => ({ x: x + 8 + k * 44, y: y + 132, w: 38, h: 16 })) };
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
  blend(s, y + 30, y + 128, x + 8, x + 134, C.INK);
  TRAY_COLOURS.forEach((c, k) => {
    const t = L.trays[k] as FilingLayout['trays'][number];
    blend(s, t.y, t.y + t.h, t.x, t.x + t.w, TRAY_RGB[c]);
    blend(s, t.y, t.y + 3, t.x, t.x + t.w, C.INK, 0.4);
    text(s, t.x + Math.round((t.w - textWidthPx(String(k + 1))) / 2), t.y + 5, String(k + 1), C.CREAM);
  });
  if (f.current) {
    const r = L.paper;
    blend(s, r.y + 1, r.y + r.h + 1, r.x + 1, r.x + r.w + 1, C.INK, 0.6);
    blend(s, r.y, r.y + r.h, r.x, r.x + r.w, C.CREAM);
    blend(s, r.y, r.y + 8, r.x, r.x + r.w, TRAY_RGB[f.current]);
    for (let k = 0; k < 6; k++)
      blend(s, r.y + 12 + k * 4, r.y + 13 + k * 4, r.x + 4, r.x + r.w - 4 - (k % 2) * 7, C.MUTED);
  }
  const rx = x + 144;
  text(s, rx, y + 34, 'PROGRESS', C.MUTED);
  bar(s, rx, y + 45, 96, 7, f.index / f.papers.length, C.GOLD, C.GOLD_LO);
  text(s, rx, y + 60, `FILED ${f.correct}`, C.CREAM);
  text(s, rx, y + 72, `WRONG ${f.misfiled}`, f.misfiled ? C.RED3 : C.MUTED);
  text(s, rx, y + 84, `DROPPED ${f.missed}`, f.missed ? C.RED3 : C.MUTED);
  // the stamp of the last paper, in the right column so it never covers the trays
  if (f.last && f.last.t < 0.6) {
    const word = f.last.ok ? 'FILED' : 'WRONG';
    const col = f.last.ok ? C.SAGE4 : C.RED3;
    plate(s, rx - 3, y + 101, textWidthPx(word) + 9, 14, col, 0.9);
    text(s, rx + 2, y + 105, word, col);
  } else {
    text(s, rx, y + 100, 'DRAG TO', C.MUTED);
    text(s, rx, y + 110, 'A TRAY', C.MUTED);
  }
  footer(s, x, y, 'filing', [
    ['1-3', 'FILE'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ data entry
export function drawEntry(s: Surface, x: number, y: number, e: DataEntryGame, task: string): void {
  const W = PANEL_SIZE.dataEntry.w;
  frame(s, x, y, 'dataEntry', 'DATA ENTRY', task);
  if (e.done && e.grade) return resultCard(s, x, y, 'dataEntry', e.grade, 'TASK DONE');
  const word = e.word;
  const kw = 20;
  const wx = x + Math.round((W - word.length * (kw + 4)) / 2);
  text(s, x + 8, y + 34, `RECORD ${Math.min(e.round + 1, e.rounds.length)}/${e.rounds.length}`, C.MUTED);
  [...word].forEach((ch, k) => {
    const kx = wx + k * (kw + 4);
    const ky = y + 54;
    const done = k < e.pos;
    const cur = k === e.pos;
    blend(s, ky, ky + kw, kx, kx + kw, done ? C.SAGE1 : cur ? C.GOLD : C.CREAM);
    blend(s, ky + kw - 3, ky + kw, kx, kx + kw, done ? C.INK : C.GOLD_LO);
    text(s, kx + Math.round((kw - textWidthPx(ch)) / 2), ky + 5, ch, done ? C.SAGE4 : C.PLATE);
  });
  if (e.wrongT < 0.3) blend(s, y + 48, y + 49, x + 8, x + W - 8, C.RED3);
  text(s, x + 8, y + 92, 'TIME', C.MUTED);
  bar(s, x + 44, y + 92, W - 52, 7, e.timeLeft / e.timeTotal, C.GOLD, C.GOLD_LO);
  text(s, x + 8, y + 108, `ERRORS ${e.errors}`, e.errors ? C.RED3 : C.MUTED);
  footer(s, x, y, 'dataEntry', [
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
  target: string,
  tool: 'none' | 'basic' | 'pro' = 'none',
  uses = 0,
): void {
  frame(s, x, y, 'lockpick', 'LOCKPICK', `${target} T${tier}`);
  if (g.done && g.grade)
    return resultCard(s, x, y, 'lockpick', g.grade, g.grade === 'fail' ? 'THE PICK SLIPPED' : 'UNLOCKED');
  const dcx = x + 68;
  const dcy = y + 90;
  const r = 50;
  for (let j = -r - 2; j <= r + 2; j++)
    for (let i = -r - 2; i <= r + 2; i++) {
      const d = Math.hypot(i + 0.5, j + 0.5);
      const ang = ((Math.atan2(j + 0.5, i + 0.5) * 180) / Math.PI + 90 + 360) % 360;
      const off = Math.abs(((ang - g.zone + 540) % 360) - 180);
      if (d <= r - 17) px(s, dcx + i, dcy + j, C.PLATE);
      else if (d <= r - 13) px(s, dcx + i, dcy + j, C.PLATE_HI);
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
    px(s, nx, ny + 1, C.HP);
  }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(s, dcx + dx, dcy + dy, C.GOLD);
  const rx = x + 132;
  const rw = PANEL_SIZE.lockpick.w - 140;
  text(s, rx, y + 34, 'PROGRESS', C.MUTED);
  bar(s, rx, y + 45, rw, 7, g.progress, C.GOLD, C.GOLD_LO);
  text(s, rx, y + 60, 'CHECKS', C.MUTED);
  for (let k = 0; k < g.checks; k++)
    blend(s, y + 71, y + 79, rx + k * 14, rx + k * 14 + 10, k < g.passed ? C.GOLD : C.PLATE_HI);
  text(s, rx, y + 88, 'TOOL', C.MUTED);
  if (tool === 'none') text(s, rx, y + 104, 'BARE HANDS', C.MUTED);
  else {
    blend(s, y + 99, y + 135, rx, rx + 36, C.INK, 0.8);
    icon(s, rx + 2, y + 101, 'item/lockpicks');
    text(s, rx + 42, y + 104, tool === 'pro' ? 'PRO' : 'BASIC', C.CREAM);
    text(s, rx + 42, y + 116, `${uses} USES`, C.MUTED);
  }
  const hints: [string, string][] = [
    ['SPACE', 'HIT'],
    ['ESC', 'ABORT'],
  ];
  footer(s, x, y, 'lockpick', hints);
  const nx = x + 8 + hintKeysWidth(hints);
  const ny = y + PANEL_SIZE.lockpick.h - 15;
  text(s, nx, ny, 'NOISE', C.MUTED);
  for (let k = 0; k < 3; k++)
    blend(
      s,
      ny,
      ny + 7,
      nx + textWidthPx('NOISE') + 5 + k * 8,
      nx + textWidthPx('NOISE') + 11 + k * 8,
      k < Math.round(g.noise * 3) ? C.HP : C.PLATE_HI,
    );
}

// ------------------------------------------------------------------ hotwire
export function hotwireLayout(
  x: number,
  y: number,
  n: number,
): { left: { x: number; y: number }[]; right: { x: number; y: number }[] } {
  const rows = Array.from({ length: n }, (_, k) => y + 36 + k * 18);
  return { left: rows.map((ry) => ({ x: x + 26, y: ry })), right: rows.map((ry) => ({ x: x + 182, y: ry })) };
}

export function drawHotwire(s: Surface, x: number, y: number, g: HotwireGame): void {
  const W = PANEL_SIZE.hotwire.w;
  frame(s, x, y, 'hotwire', 'HOTWIRE', 'TIER 0');
  if (g.done && g.grade)
    return resultCard(s, x, y, 'hotwire', g.grade, g.grade === 'fail' ? 'IT WONT START' : 'ENGINE RUNNING');
  const L = hotwireLayout(x, y, g.left.length);
  const keysR = ['A', 'S', 'D', 'F', 'G'];
  blend(s, y + 30, y + 34 + g.left.length * 18, x + 8, x + W - 8, C.INK, 0.7);
  g.left.forEach((c, k) => {
    const p = L.left[k] as { x: number; y: number };
    text(s, x + 13, p.y, String(k + 1), g.selected === k ? C.GOLD : C.CREAM);
    blend(s, p.y + 1, p.y + 6, p.x, p.x + 26, WIRE_RGB[c]);
    if (g.selected === k) blend(s, p.y - 2, p.y + 9, p.x - 3, p.x, C.GOLD);
  });
  g.right.forEach((c, k) => {
    const p = L.right[k] as { x: number; y: number };
    blend(s, p.y + 1, p.y + 6, p.x, p.x + 26, WIRE_RGB[c]);
    text(s, p.x + 32, p.y, keysR[k] as string, C.CREAM);
  });
  // joined wires run straight across
  g.left.forEach((c, k) => {
    if (!g.connected[k]) return;
    const a = L.left[k] as { x: number; y: number };
    const j = g.right.indexOf(c);
    const b = L.right[j] as { x: number; y: number };
    const steps = 90;
    for (let t = 0; t <= steps; t++) {
      const xx = Math.round(a.x + 26 + ((b.x - a.x - 26) * t) / steps);
      const yy = Math.round(a.y + 2 + ((b.y - a.y) * t) / steps);
      px(s, xx, yy, WIRE_RGB[c]);
      px(s, xx, yy + 1, WIRE_RGB[c]);
      px(s, xx, yy + 2, WIRE_RGB[c]);
    }
  });
  if (g.sparkT < 0.3) blend(s, y + 30, y + 31, x + 8, x + W - 8, C.GOLD_HI);
  text(s, x + 8, y + 128, 'TIME', C.MUTED);
  bar(s, x + 44, y + 128, W - 52, 7, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  text(s, x + 8, y + 142, `SPARKS ${g.sparks}`, g.sparks ? C.RED3 : C.MUTED);
  footer(s, x, y, 'hotwire', [
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
  blend(s, y + 30, y + 134, x + 8, x + 124, C.INK, 0.7);
  for (let k = 0; k < Math.min(g.pile, MAX_PILE_ROWS); k++) {
    const by = y + 124 - k * 8;
    blend(s, by, by + 7, x + 18, x + 98, k >= 10 ? C.DIRTY : C.KHAKI4);
    blend(s, by + 1, by + 6, x + 50, x + 66, k >= 10 ? C.HP_LO : C.SAGE1);
  }
  for (let k = 0; k < g.bundles; k++) blend(s, y + 36 + k * 10, y + 44 + k * 10, x + 106, x + 116, C.SAGE4);
  const rx = x + 134;
  text(s, rx, y + 34, `PILE ${g.pile}/10`, g.pile === 10 ? C.GOLD : g.pile > 10 ? C.RED3 : C.CREAM);
  text(s, rx, y + 48, `COUNTED ${g.counted}/${g.bills}`, C.MUTED);
  text(s, rx, y + 60, `BUNDLES ${g.bundles}`, C.CREAM);
  text(s, rx, y + 72, `MISCOUNT ${g.miscounts}`, g.miscounts ? C.RED3 : C.MUTED);
  text(s, rx, y + 90, 'TIME', C.MUTED);
  bar(s, rx, y + 101, 104, 7, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  footer(s, x, y, 'moneyCount', [
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

const STACK_W = 24;
const STACK_H = 17;

export function duffelLayout(x: number, y: number, n: number): DuffelLayout {
  const slots: Box[] = [];
  for (let k = 0; k < n; k++)
    slots.push({ x: x + 13 + (k % 4) * 28, y: y + 42 + Math.floor(k / 4) * 40, w: STACK_W, h: STACK_H });
  return { slots, bag: { x: x + 134, y: y + 40, w: 104, h: 86 } };
}

/** A banded stack of bills; dye-stained ones carry red blotches. */
function cashStack(s: Surface, x: number, y: number, dyed: boolean): void {
  blend(s, y + 3, y + STACK_H, x + 1, x + STACK_W + 1, C.INK, 0.6); // shadow
  for (let k = 0; k < 3; k++)
    blend(s, y + 3 * k, y + 3 * k + 11, x, x + STACK_W, k === 2 ? C.KHAKI4 : C.STONE5);
  blend(s, y + 6, y + 17, x, x + STACK_W, C.KHAKI4);
  blend(s, y + 7, y + 16, x + 9, x + 15, C.SAGE1); // the band
  if (dyed) {
    for (const [dx, dy, w, h] of [
      [1, 7, 6, 4],
      [17, 6, 5, 5],
      [11, 13, 4, 3],
      [4, 1, 4, 3],
    ] as const)
      blend(s, y + dy, y + dy + h, x + dx, x + dx + w, C.DIRTY);
    px(s, x + 18, y + 8, C.HP);
    px(s, x + 3, y + 9, C.HP);
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
  blend(s, y + 32, y + 128, x + 8, x + 126, C.INK, 0.7);
  g.stacks.forEach((st, k) => {
    const r = L.slots[k] as Box;
    if (st.bagged || k === held) {
      blend(s, r.y + 6, r.y + 17, r.x, r.x + STACK_W, C.PLATE_HI);
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
  const top = b.y + 22;
  const bot = b.y + b.h - 2;
  const cx = b.x + b.w / 2;
  const mouth = Math.round(b.w * 0.35);
  for (let yy = top; yy < bot; yy++) {
    const t = (yy - (top + bot) / 2) / ((bot - top) / 2);
    const half = Math.round((b.w / 2 - 2) * Math.sqrt(Math.max(0, 1 - t * t * t * t)));
    if (half <= 0) continue;
    blend(s, yy, yy + 1, cx - half, cx + half, yy > bot - 8 ? NAVY_LO : NAVY);
    // end caps and a seam piping
    blend(s, yy, yy + 1, cx - half, cx - half + 7, NAVY_LO);
    blend(s, yy, yy + 1, cx + half - 7, cx + half, NAVY_LO);
    px(s, cx - half + 7, yy, NAVY_HI);
    px(s, cx + half - 8, yy, NAVY_HI);
  }
  blend(s, top + 9, top + 10, cx - mouth, cx + mouth, NAVY_HI); // light catching the upper curve
  // the mouth
  const my0 = top - 3;
  const my1 = top + 16;
  for (let yy = my0; yy < my1; yy++) {
    const t = (yy - (my0 + my1) / 2) / ((my1 - my0) / 2);
    const half = Math.round(mouth * Math.sqrt(Math.max(0, 1 - t * t)));
    blend(s, yy, yy + 1, cx - half, cx + half, C.INK);
  }
  // zip teeth along the rim, gold-free khaki
  for (let k = -mouth; k <= mouth; k += 3) {
    const ry = Math.round(
      my0 + (my1 - my0) / 2 - Math.sqrt(Math.max(0, 1 - (k / (mouth + 1)) ** 2)) * ((my1 - my0) / 2),
    );
    px(s, cx + k, ry - 1, flash ?? C.KHAKI4);
  }
  const inBag = g.stacks.filter((q) => q.bagged).length;
  for (let k = 0; k < inBag; k++) {
    const sx = cx - 26 + (k % 4) * 13;
    const sy = my1 - 7 - Math.floor(k / 4) * 4;
    blend(s, sy, sy + 4, sx, sx + 11, C.KHAKI4);
    blend(s, sy, sy + 1, sx, sx + 11, C.STONE5);
  }
  for (const hx of [cx - 24, cx + 13]) {
    blend(s, b.y + 8, b.y + 11, hx, hx + 11, NAVY_LO);
    blend(s, b.y + 8, top, hx, hx + 3, NAVY_LO);
    blend(s, b.y + 8, top, hx + 8, hx + 11, NAVY_LO);
  }
  text(s, x + 140, y + 30, 'LEAVE DYE OUT', C.MUTED);
  text(s, x + 8, y + 136, `IN BAG ${g.cleanBagged}/${g.cleanTotal}`, C.CREAM);
  if (g.dyedBagged) text(s, x + 86, y + 136, `DYE ${g.dyedBagged}`, C.RED3);
  text(s, x + 140, y + 136, 'TIME', C.MUTED);
  bar(s, x + 170, y + 136, 68, 7, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  footer(s, x, y, 'duffel', [
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
  return { x: x + 8 + (k % 2) * 146, y: y + 32 + Math.floor(k / 2) * 50, w: 138, h: 46 };
}

/** A card per item: its picture, name, what it does, the price and a number key. */
export function drawShop(s: Surface, x: number, y: number, v: ShopView): void {
  frame(s, x, y, 'shop', 'SHOP', v.title);
  v.stock.forEach((id, k) => {
    const c = shopCard(x, y, k);
    const price = BALANCE.shop[id].price;
    const can = v.clean >= price;
    plate(s, c.x, c.y, c.w, c.h, k === v.selected ? C.EDGE : C.LAVLT2, 0.9);
    // the picture in its own frame
    blend(s, c.y + 5, c.y + 41, c.x + 5, c.x + 41, C.INK, 0.8);
    icon(s, c.x + 7, c.y + 7, ITEM_ICON[id], can ? 1 : 0.5);
    text(s, c.x + 47, c.y + 6, ITEMS[id].name, can ? C.CREAM : C.MUTED);
    text(s, c.x + 47, c.y + 18, ITEMS[id].effect, C.MUTED);
    text(s, c.x + 47, c.y + 31, `$${price}`, can ? C.CREAM : C.RED3);
    // number key
    const key = String(k + 1);
    const kx = c.x + c.w - 15;
    blend(s, c.y + 29, c.y + 41, kx, kx + 11, C.GOLD);
    blend(s, c.y + 40, c.y + 41, kx, kx + 11, C.GOLD_LO);
    text(s, kx + 3, c.y + 31, key, C.PLATE);
  });
  const fy = y + 186;
  text(s, x + 8, fy, `CLEAN CASH $${v.clean}`, C.CREAM);
  const dirty = 'NO DIRTY CASH';
  text(s, x + PANEL_SIZE.shop.w - 8 - textWidthPx(dirty), fy, dirty, C.MUTED);
  if (v.message) text(s, x + 8, fy + 12, v.message, C.SAGE4);
  footer(s, x, y, 'shop', [
    [`1-${v.stock.length}`, 'BUY'],
    ['CLICK', 'BUY'],
    ['ESC', 'LEAVE'],
  ]);
}

// ------------------------------------------------------------------ search (trunks)
const LOOT_ICON: Record<LootKind, IconName> = {
  cash: 'item/cash',
  wallet: 'item/wallet',
  phone: 'item/phone',
  lockpicks: 'item/lockpicks',
  watch: 'item/watch',
  junk: 'item/junk',
};

export function searchCell(x: number, y: number, k: number, cols: number): Box {
  return { x: x + 8 + (k % cols) * 50, y: y + 32 + Math.floor(k / cols) * 42, w: 48, h: 40 };
}

/** The open trunk: a carpeted grid; valuables glint (a travelling sparkle), junk doesn't; grabbed cells empty. */
export function drawSearch(s: Surface, x: number, y: number, g: SearchGame, right: string, t: number): void {
  frame(s, x, y, 'search', 'SEARCH', right);
  if (g.done && g.grade)
    return resultCard(s, x, y, 'search', g.grade, `GRABBED ${g.taken} OF ${g.valuables}`);
  const CARPET: RGB = [58, 50, 62];
  const CARPET_LO: RGB = [46, 39, 50];
  g.cells.forEach((c, k) => {
    const r = searchCell(x, y, k, g.cols);
    blend(s, r.y, r.y + r.h, r.x, r.x + r.w, (k + Math.floor(k / g.cols)) % 2 ? CARPET : CARPET_LO);
    const flash = g.flash && g.flash.cell === k && g.flash.t < 0.3;
    if (k === g.cursor || flash) {
      const col = flash ? C.SAGE4 : C.LAVLT2;
      blend(s, r.y, r.y + 1, r.x, r.x + r.w, col);
      blend(s, r.y + r.h - 1, r.y + r.h, r.x, r.x + r.w, col);
      blend(s, r.y, r.y + r.h, r.x, r.x + 1, col);
      blend(s, r.y, r.y + r.h, r.x + r.w - 1, r.x + r.w, col);
    }
    if (!c.item || c.grabbed) return;
    icon(s, r.x + 8, r.y + 4, LOOT_ICON[c.item.kind]);
    if (glints(c.item.kind)) {
      // a sparkle that walks around the picture; gold (a valuable, CLAUDE.md rule 2)
      const ph = (t * 3 + k * 0.37) % 1;
      const sx = r.x + 8 + Math.round(ph * 32);
      const sy = r.y + 4 + Math.round(Math.abs(Math.sin(ph * Math.PI)) * 4);
      px(s, sx, sy, C.GOLD_HI);
      px(s, sx - 1, sy + 1, C.GOLD);
      px(s, sx + 1, sy + 1, C.GOLD);
      px(s, sx, sy + 2, C.GOLD);
      px(s, sx - 2, sy + 1, C.GOLD_LO);
      px(s, sx + 2, sy + 1, C.GOLD_LO);
    }
  });
  bar(s, x + 8, y + 162, PANEL_SIZE.search.w - 16, 6, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  footer(s, x, y, 'search', [
    ['CLICK/SPACE', 'GRAB'],
    ['ARROWS', 'MOVE'],
  ]);
}
