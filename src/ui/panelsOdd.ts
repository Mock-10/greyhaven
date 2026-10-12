// Panels for the weekend odd jobs (docs/02, docs/06), in the style of ui/panels.ts and the docs/11 UI redesign
// (2026-10-12): 248 × 176 plates with a 26 px drag strip, a 2× gold title, the 5 × 7 body font, and the task drawn
// as a picture (the side of a muddy car with the sponge and bucket; the bar counter with its patrons, taps and the
// glass). Pure code: each function draws one panel at (x, y) from a minigame's state; layout helpers give the click
// targets. tests/oddJobs.test.ts checks that no text or picture overlaps another and that nothing leaves its panel.

import { BALANCE_ODD } from '../config/balanceOdd';
import { DRINKS, GIGS, type GigId } from '../data/oddJobs';
import type { BarShiftGame } from '../minigames/barShift';
import type { CarWashGame } from '../minigames/carWash';
import type { Grade } from '../systems/career';
import type { GigPayout } from '../systems/oddJobs';
import { C, bar, blend, hintKeys, plate, px, text, textWidthPx, type RGB, type Surface } from './hudDraw';

export const ODD_PANEL_SIZE = {
  carWash: { w: 248, h: 176 },
  barShift: { w: 248, h: 176 },
  gigPay: { w: 248, h: 176 },
} as const;
export type OddPanelKind = keyof typeof ODD_PANEL_SIZE;

type Box = { x: number; y: number; w: number; h: number };

const GRADE_TEXT: Record<Grade, string> = {
  fail: 'FAILED',
  poor: 'POOR',
  ok: 'OK',
  good: 'GOOD',
  excellent: 'EXCELLENT',
};

// colours the pictures need beyond the HUD roles, all from art/palette.json ramps (no gold: it is for valuables)
const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const MUD = hex('#6f5748');
const MUD_HI = hex('#8d7360');
const TAR = hex('#2d222e');
const BIRD = hex('#ded6c8');
const TYRE = hex('#2d222e');
const RIM = hex('#989ea1');
const GLASS = hex('#768c9c');
const GLASS_HI = hex('#bcc3c4');
const TRIM = hex('#40414e');
const SPONGE = hex('#d2cca6');
const SPONGE_LO = hex('#a09b72');
const SPONGE_DRY = hex('#838459');
const PAIL = hex('#636e94');
const PAIL_LO = hex('#515670');
const WATER = hex('#adbcc0');
const WALL = hex('#3e3042');
const WALL_LO = hex('#2d222e');
const COUNTER = hex('#6f5748');
const COUNTER_HI = hex('#8d7360');
const COUNTER_LO = hex('#3a2c2c');
const BRASS = hex('#b1a599');
const FOAM = hex('#ded6c8');

/** Car body colours, picked per car. */
export const CAR_BODIES: readonly [RGB, RGB][] = [
  [hex('#636e94'), hex('#515670')],
  [hex('#98585b'), hex('#6f3c50')],
  [hex('#758672'), hex('#627462')],
  [hex('#a67c6a'), hex('#7d5249')],
  [hex('#70838b'), hex('#57646e')],
];

/** Each drink's colour in the glass, by DRINKS index: lager straw, stout near black, cider amber. */
export const DRINK_RGB: readonly RGB[] = [hex('#b9b48c'), hex('#3a2c2c'), hex('#bb9381')];
/** The tap handles, by DRINKS index. */
const HANDLE_RGB: readonly RGB[] = [hex('#93a387'), hex('#503f58'), hex('#b3726c')];
/** Patrons' tops and hair, picked by patron index. */
const SHIRTS: readonly RGB[] = [
  hex('#768c9c'),
  hex('#98585b'),
  hex('#758672'),
  hex('#a09b72'),
  hex('#7d7688'),
];
const HAIR: readonly RGB[] = [hex('#3a2c2c'), hex('#6f5748'), hex('#2d222e'), hex('#a98f78')];
const SKIN: readonly RGB[] = [hex('#a67c6a'), hex('#8a5f55'), hex('#c4ab92'), hex('#6a4540')];

/** The frame every panel shares (as ui/panels.ts frame): plate, gold 2× title, a muted label on the right, a grip. */
export function oddFrame(
  s: Surface,
  x: number,
  y: number,
  kind: OddPanelKind,
  title: string,
  right: string,
): void {
  const { w, h } = ODD_PANEL_SIZE[kind];
  plate(s, x, y, w, h, C.EDGE, 0.96);
  text(s, x + 8, y + 7, title, C.GOLD, C.INK, 2);
  const rw = textWidthPx(right);
  text(s, x + w - 8 - rw, y + 11, right, C.MUTED);
  const gx0 = x + 8 + textWidthPx(title, 2) + 8;
  const gx1 = x + w - 8 - rw - 8;
  for (let gx = gx0; gx + 1 < gx1; gx += 4) {
    px(s, gx, y + 12, C.PLATE_HI);
    px(s, gx, y + 16, C.PLATE_HI);
  }
}

/** The end-of-task card, drawn instead of the panel body once the task is done. */
export function oddResult(
  s: Surface,
  x: number,
  y: number,
  kind: OddPanelKind,
  grade: Grade,
  caption: string,
): void {
  const { w } = ODD_PANEL_SIZE[kind];
  const t = GRADE_TEXT[grade];
  const col = grade === 'fail' || grade === 'poor' ? C.RED3 : C.GOLD;
  text(s, x + Math.round((w - textWidthPx(caption)) / 2), y + 64, caption, C.MUTED);
  text(s, x + Math.round((w - textWidthPx(t, 2)) / 2), y + 78, t, col, C.INK, 2);
}

function footer(
  s: Surface,
  x: number,
  y: number,
  kind: OddPanelKind,
  items: readonly [string, string][],
): void {
  hintKeys(s, x + 8, y + ODD_PANEL_SIZE[kind].h - 17, items);
}

/** A labelled time bar. */
function timeBar(s: Surface, x: number, y: number, w: number, frac: number): void {
  text(s, x, y, 'TIME', C.MUTED);
  bar(s, x + 36, y, w - 36, 7, frac, C.GOLD, C.GOLD_LO);
}

/** A gold keycap (as on the shop cards): the taps and the bucket are the things to press. */
function keycap(s: Surface, x: number, y: number, key: string): void {
  const kw = textWidthPx(key) + 6;
  blend(s, y, y + 11, x, x + kw, C.GOLD);
  blend(s, y + 10, y + 11, x, x + kw, C.GOLD_LO);
  text(s, x + 3, y + 2, key, C.PLATE);
}

function disc(s: Surface, cx: number, cy: number, r: number, col: RGB): void {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) px(s, cx + i, cy + j, col);
}

/** A cheap, stable per-pixel hash for splatter patterns. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ car wash
const CELL_W = 12;
const CELL_H = 11;

/** The car's side, where the sponge goes (the dirt grid). */
export function carWashArea(x: number, y: number, g: CarWashGame): Box {
  return { x: x + 16, y: y + 32, w: g.cols * CELL_W, h: g.rows * CELL_H };
}

/** The bucket: click it to dunk the sponge. */
export function carWashBucket(x: number, y: number): Box {
  return { x: x + 8, y: y + 120, w: 30, h: 24 };
}

function bucket(s: Surface, r: Box, splash: boolean): void {
  // a tapered pail with a wire handle and a sudsy waterline
  for (let j = 0; j < r.h - 6; j++) {
    const inset = Math.floor((j * 3) / (r.h - 6));
    blend(s, r.y + 6 + j, r.y + 7 + j, r.x + inset, r.x + r.w - inset, j > r.h - 10 ? PAIL_LO : PAIL);
  }
  blend(s, r.y + 6, r.y + 8, r.x, r.x + r.w, WATER);
  for (let i = 1; i < r.w - 1; i += 3) px(s, r.x + i, r.y + 5 - ((i >> 1) % 2), C.CREAM);
  for (let i = 4; i < r.w - 4; i++) px(s, r.x + i, r.y + 1 + Math.round(Math.abs(i - r.w / 2) / 4), TRIM);
  if (splash)
    for (const [dx, dy] of [
      [4, 2],
      [r.w - 6, 1],
      [r.w / 2, 0],
      [9, -1],
      [r.w - 10, -2],
    ] as const)
      px(s, r.x + Math.round(dx), r.y + dy, WATER);
}

export function drawCarWash(s: Surface, x: number, y: number, g: CarWashGame, task: string, car = 0): void {
  const W = BALANCE_ODD.carWash;
  oddFrame(s, x, y, 'carWash', GIGS.carWash.title, task);
  if (g.done && g.grade)
    return oddResult(
      s,
      x,
      y,
      'carWash',
      g.grade,
      `${g.dirtyCells - g.dirtyLeft} OF ${g.dirtyCells} SPOTS CLEAN`,
    );
  const A = carWashArea(x, y, g);
  const [body, bodyLo] = CAR_BODIES[car % CAR_BODIES.length] as [RGB, RGB];
  const cabinRows = W.cabin.rows;
  // the car's side: cabin (windows between pillars) over the body, bumpers, a trim line and the wheels
  for (let j = 0; j < g.rows; j++)
    for (let i = 0; i < g.cols; i++) {
      const k = j * g.cols + i;
      if (!g.body[k]) continue;
      const cx = A.x + i * CELL_W;
      const cy = A.y + j * CELL_H;
      const glass = j < cabinRows && j > 0;
      blend(s, cy, cy + CELL_H, cx, cx + CELL_W, glass ? GLASS : j === g.rows - 1 ? bodyLo : body);
    }
  const c0 = A.x + Math.round(W.cabin.from * g.cols) * CELL_W;
  const c1 = A.x + Math.round(W.cabin.to * g.cols) * CELL_W;
  // the roof line slopes into the windscreen and the rear window
  for (let j = 0; j < CELL_H * cabinRows; j++) {
    const cut = Math.max(0, CELL_W - Math.floor(j / 2));
    blend(s, A.y + j, A.y + j + 1, c0, c0 + cut, C.PLATE, 0.96);
    blend(s, A.y + j, A.y + j + 1, c1 - cut, c1, C.PLATE, 0.96);
  }
  blend(
    s,
    A.y + CELL_H,
    A.y + CELL_H * cabinRows,
    Math.round((c0 + c1) / 2) - 1,
    Math.round((c0 + c1) / 2) + 2,
    body,
  );
  blend(s, A.y + CELL_H + 2, A.y + CELL_H + 3, c0 + 10, c1 - 10, GLASS_HI);
  // rounded nose and tail
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [2, 0],
    [0, 2],
  ] as const) {
    const top = A.y + cabinRows * CELL_H;
    blend(s, top + dy, top + dy + 1, A.x + dx, A.x + dx + 1, C.PLATE, 0.96);
    blend(s, top + dy, top + dy + 1, A.x + A.w - 1 - dx, A.x + A.w - dx, C.PLATE, 0.96);
  }
  blend(s, A.y + cabinRows * CELL_H + 15, A.y + cabinRows * CELL_H + 16, A.x + 4, A.x + A.w - 4, bodyLo); // trim
  blend(s, A.y + cabinRows * CELL_H + 13, A.y + cabinRows * CELL_H + 15, A.x + 100, A.x + 106, TRIM); // handle
  blend(s, A.y + cabinRows * CELL_H + 13, A.y + cabinRows * CELL_H + 15, A.x + 150, A.x + 156, TRIM);
  // dirt over the paint and glass: splatter whose density follows the coats left
  for (let j = 0; j < g.rows; j++)
    for (let i = 0; i < g.cols; i++) {
      const k = j * g.cols + i;
      const d = g.dirt[k] as number;
      if (!g.body[k] || d <= W.cleanAt) continue;
      const cx = A.x + i * CELL_W;
      const cy = A.y + j * CELL_H;
      const sp = g.spot[k];
      if (sp) {
        const share = d / W.stubborn;
        const col = sp === 'bird' ? BIRD : TAR;
        for (let v = 0; v < CELL_H; v++)
          for (let u = 0; u < CELL_W; u++) {
            const r = Math.hypot(u - CELL_W / 2 + 0.5, (v - CELL_H / 2 + 0.5) * 1.2);
            if (r < 4.5 * share + 0.5 || (r < 5.5 && hash(cx + u, cy + v) < share * 0.5))
              px(s, cx + u, cy + v, col);
          }
        continue;
      }
      const share = Math.min(1, d / 2);
      for (let v = 0; v < CELL_H; v++)
        for (let u = 0; u < CELL_W; u++) {
          const h = hash((cx + u) >> 1, (cy + v) >> 1);
          if (h < share * 0.9) px(s, cx + u, cy + v, h < share * 0.25 ? MUD_HI : MUD);
        }
    }
  // wheels tucked under the sills, in arches cut out of the body
  const wy = A.y + A.h + 3;
  for (const wx of [A.x + 40, A.x + A.w - 40]) {
    disc(s, wx, wy, 11, C.PLATE);
    disc(s, wx, wy, 9, TYRE);
    disc(s, wx, wy, 4, RIM);
    disc(s, wx, wy, 1, TRIM);
  }
  blend(s, wy + 10, wy + 11, A.x - 6, A.x + A.w + 6, C.LAVLT2); // the wet ground line
  // the bucket and the suds left in the sponge
  const B = carWashBucket(x, y);
  bucket(s, B, g.dunking > 0);
  text(s, B.x + B.w + 6, B.y + 4, 'SUDS', C.MUTED);
  bar(s, B.x + B.w + 38, B.y + 4, 60, 7, g.suds, g.dry ? C.RED3 : C.GLASS4, C.ARM_LO);
  const left = `DIRTY ${g.dirtyLeft}`;
  text(
    s,
    x + ODD_PANEL_SIZE.carWash.w - 8 - textWidthPx(left),
    B.y + 4,
    left,
    g.dirtyLeft ? C.CREAM : C.SAGE4,
  );
  if (g.dunking > 0) text(s, B.x + B.w + 6, B.y + 16, 'DUNKING...', C.GLASS4);
  else if (g.dry) {
    text(s, B.x + B.w + 6, B.y + 16, 'DRY: DUNK IT', C.RED3);
    keycap(s, B.x + B.w + 6 + textWidthPx('DRY: DUNK IT') + 4, B.y + 14, 'R');
  }
  timeBar(s, x + 8, y + 149, ODD_PANEL_SIZE.carWash.w - 16, g.timeLeft / g.timeTotal);
  // the sponge: over the car, or in the bucket while dunking
  const sx = g.dunking > 0 ? B.x + B.w / 2 : A.x + g.sponge.x * A.w;
  const sy = g.dunking > 0 ? B.y + 8 : A.y + g.sponge.y * A.h;
  const x0 = Math.round(sx - 7);
  const y0 = Math.round(sy - 5);
  const face = g.dry ? SPONGE_DRY : SPONGE;
  blend(s, y0 + 1, y0 + 10, x0, x0 + 14, face);
  blend(s, y0, y0 + 1, x0 + 1, x0 + 13, face);
  blend(s, y0 + 8, y0 + 10, x0, x0 + 14, SPONGE_LO);
  for (const [u, v] of [
    [3, 3],
    [8, 2],
    [11, 5],
    [5, 6],
  ] as const)
    px(s, x0 + u, y0 + v, SPONGE_LO);
  if (g.scrubbing && !g.dry && g.dunking === 0)
    for (let n = 0; n < 6; n++) {
      const a = n * 1.05 + g.timeLeft * 3;
      disc(s, Math.round(sx + Math.cos(a) * 10), Math.round(sy + Math.sin(a) * 7), n % 2, C.CREAM);
    }
  footer(s, x, y, 'carWash', [
    ['MOUSE', 'AIM'],
    ['SPACE', 'SCRUB'],
    ['R', 'DUNK'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ bar shift
const SEAT_W = 76;

/** A stool's spot at the counter (the patron and their order above it). */
export function barSeat(x: number, y: number, k: number): Box {
  return { x: x + 10 + k * (SEAT_W + 2), y: y + 28, w: SEAT_W, h: 60 };
}

/** A tap: click to put the glass under it. */
export function barTap(x: number, y: number, k: number): Box {
  return { x: x + 10 + k * 58, y: y + 96, w: 52, h: 46 };
}

/** The glass under the selected tap: hold the mouse here (or Space) to pour. */
export function barGlass(x: number, y: number): Box {
  return { x: x + 190, y: y + 100, w: 22, h: 30 };
}

/** A pint glass filled to `fill` (0–1) with a drink, with the fill line marked. */
function glass(s: Surface, r: Box, drink: number, fill: number, line: boolean): void {
  blend(s, r.y, r.y + r.h, r.x, r.x + r.w, C.INK, 0.5);
  const inner = { x: r.x + 3, y: r.y + 2, w: r.w - 6, h: r.h - 5 };
  const lvl = Math.round(inner.h * Math.min(1, fill));
  if (lvl > 0) {
    const col = DRINK_RGB[drink] as RGB;
    blend(s, inner.y + inner.h - lvl, inner.y + inner.h, inner.x, inner.x + inner.w, col);
    blend(
      s,
      inner.y + inner.h - lvl,
      inner.y + inner.h - lvl + Math.min(3, lvl),
      inner.x,
      inner.x + inner.w,
      FOAM,
    );
  }
  // the glass walls and base
  blend(s, r.y, r.y + r.h, r.x + 1, r.x + 2, GLASS_HI);
  blend(s, r.y, r.y + r.h, r.x + r.w - 2, r.x + r.w - 1, GLASS_HI);
  blend(s, r.y + r.h - 3, r.y + r.h - 1, r.x + 1, r.x + r.w - 1, GLASS_HI);
  if (line) {
    const B = BALANCE_ODD.barShift;
    const ly = inner.y + inner.h - Math.round(inner.h * B.line);
    const band = Math.max(1, Math.round(inner.h * B.good));
    blend(s, ly - band, ly + band + 1, r.x - 3, r.x, C.SAGE4);
    blend(s, ly, ly + 1, r.x - 4, r.x + r.w, C.CREAM);
  }
}

/** A small glass for an order bubble. */
function miniGlass(s: Surface, x: number, y: number, drink: number): void {
  blend(s, y, y + 10, x, x + 7, GLASS_HI);
  blend(s, y + 1, y + 9, x + 1, x + 6, DRINK_RGB[drink] as RGB);
  blend(s, y + 1, y + 3, x + 1, x + 6, FOAM);
}

const FLASH_TEXT: Record<string, string> = {
  perfect: 'PERFECT',
  fine: 'THANKS',
  short: 'SHORT',
  missed: 'WALKED OUT',
};

function patron(s: Surface, r: Box, who: number, mood: number): void {
  const cx = r.x + Math.round(r.w / 2);
  const shirt = SHIRTS[who % SHIRTS.length] as RGB;
  const skin = SKIN[(who * 3 + 1) % SKIN.length] as RGB;
  const hair = HAIR[(who * 5 + 2) % HAIR.length] as RGB;
  const base = r.y + r.h; // the counter's top edge
  // shoulders and arms on the counter, head, hair
  blend(s, base - 14, base, cx - 13, cx + 13, shirt);
  blend(s, base - 15, base - 14, cx - 11, cx + 11, shirt);
  blend(s, base - 3, base, cx - 17, cx - 9, shirt);
  blend(s, base - 3, base, cx + 9, cx + 17, shirt);
  disc(s, cx, base - 21, 6, skin);
  blend(s, base - 28, base - 23, cx - 6, cx + 7, hair);
  blend(s, base - 23, base - 19, cx - 7, cx - 5, hair);
  // eyes and a mouth that sours as they wait
  px(s, cx - 2, base - 21, C.INK);
  px(s, cx + 2, base - 21, C.INK);
  if (mood > 0.6) blend(s, base - 17, base - 16, cx - 2, cx + 3, C.INK);
  else {
    px(s, cx - 2, base - 17, C.INK);
    blend(s, base - 18, base - 17, cx - 1, cx + 2, C.INK);
    px(s, cx + 2, base - 17, C.INK);
  }
}

export function drawBarShift(s: Surface, x: number, y: number, g: BarShiftGame, task: string): void {
  const B = BALANCE_ODD.barShift;
  const P = ODD_PANEL_SIZE.barShift;
  oddFrame(s, x, y, 'barShift', GIGS.barShift.title, task);
  if (g.done && g.grade)
    return oddResult(s, x, y, 'barShift', g.grade, `${g.served} OF ${g.patrons.length} SERVED`);
  // the back wall of The Low Tide, the counter, and the patrons on their stools with their orders
  blend(s, y + 27, y + 88, x + 4, x + P.w - 4, WALL);
  for (let k = 0; k < 9; k++) blend(s, y + 27, y + 88, x + 14 + k * 27, x + 15 + k * 27, WALL_LO);
  for (let k = 0; k < B.seats; k++) {
    const r = barSeat(x, y, k);
    const p = g.atSeat(k);
    if (!p) continue;
    const who = g.patrons.indexOf(p);
    const mood = 1 - p.waited / B.patience;
    patron(s, r, who, mood);
    // the order bubble: a small glass, the drink's name and the patience left
    const name = (DRINKS[p.drink] as (typeof DRINKS)[number]).name;
    const bw = 13 + textWidthPx(name) + 4;
    const bx = r.x + Math.round((r.w - bw) / 2);
    plate(s, bx, r.y + 1, bw, 16, C.PLATE_HI, 0.95);
    miniGlass(s, bx + 4, r.y + 4, p.drink);
    text(s, bx + 13, r.y + 5, name, C.CREAM);
    bar(s, bx, r.y + 18, bw, 5, mood, mood > 0.35 ? C.SAGE4 : C.RED3, C.SAGE1);
  }
  blend(s, y + 88, y + 92, x + 4, x + P.w - 4, COUNTER_HI);
  blend(s, y + 92, y + 94, x + 4, x + P.w - 4, COUNTER);
  blend(s, y + 94, y + 95, x + 4, x + P.w - 4, COUNTER_LO);
  // a flash over the seat that was just served (or walked out)
  if (g.last && g.last.t < 0.8 && 'seat' in g.last) {
    const word = FLASH_TEXT[g.last.kind] as string;
    const ok = g.last.kind === 'perfect' || g.last.kind === 'fine';
    const r = barSeat(x, y, g.last.seat);
    const wx = r.x + Math.round((r.w - textWidthPx(word)) / 2);
    plate(s, wx - 3, r.y + 31, textWidthPx(word) + 7, 13, ok ? C.SAGE4 : C.RED3, 0.95);
    text(s, wx, r.y + 34, word, ok ? C.SAGE4 : C.RED3);
  }
  // the three taps, each with its key, its handle and the drink's name
  for (let k = 0; k < DRINKS.length; k++) {
    const r = barTap(x, y, k);
    const sel = k === g.tap;
    if (sel) plate(s, r.x, r.y, r.w, r.h, C.EDGE, 0.5);
    const cx = r.x + Math.round(r.w / 2);
    blend(s, r.y + 4, r.y + 20, cx - 3, cx + 3, HANDLE_RGB[k] as RGB);
    blend(s, r.y + 4, r.y + 6, cx - 3, cx + 3, C.CREAM);
    blend(s, r.y + 20, r.y + 24, cx - 6, cx + 7, BRASS);
    blend(s, r.y + 24, r.y + 27, cx - 1, cx + 2, BRASS);
    keycap(s, r.x + 4, r.y + 31, String(k + 1));
    const name = (DRINKS[k] as (typeof DRINKS)[number]).name;
    text(s, r.x + r.w - 4 - textWidthPx(name), r.y + 33, name, sel ? C.CREAM : C.MUTED);
  }
  // the glass under the chosen tap, filling as it pours; a spill or a wasted pour flashes beside it
  const G = barGlass(x, y);
  const spout = G.x + Math.round(G.w / 2);
  blend(s, y + 95, y + 98, spout - 4, spout + 4, BRASS);
  blend(s, y + 98, y + 99, spout - 1, spout + 2, BRASS);
  blend(s, y + 96, y + 97, spout - 4, spout + 4, HANDLE_RGB[g.tap] as RGB);
  glass(s, G, g.tap, g.fill, true);
  if (g.pouring) {
    const top = G.y + 2 + (G.h - 5) - Math.round((G.h - 5) * Math.min(1, g.fill));
    blend(s, y + 99, top, spout - 1, spout + 1, DRINK_RGB[g.tap] as RGB);
  }
  if (g.last && g.last.t < 0.8 && 'tap' in g.last) {
    const word = g.last.kind === 'spill' ? 'SPILT' : 'NOBODY';
    text(s, G.x + Math.round((G.w - textWidthPx(word)) / 2), G.y + G.h + 3, word, C.RED3);
  }
  // the tally
  text(s, x + 8, y + 146, `SERVED ${g.served}/${g.patrons.length}`, C.CREAM);
  if (g.missed) text(s, x + 98, y + 146, `GONE ${g.missed}`, C.RED3);
  if (g.queued) text(s, x + 158, y + 146, `WAITING ${g.queued}`, C.MUTED);
  footer(s, x, y, 'barShift', [
    ['1-3', 'TAP'],
    ['SPACE', 'HOLD TO POUR'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ gig pay
/** The end of a gig: each task's grade, the pay, the tips and the total. */
export function drawGigPay(
  s: Surface,
  x: number,
  y: number,
  id: GigId,
  grades: readonly Grade[],
  p: GigPayout,
): void {
  const P = ODD_PANEL_SIZE.gigPay;
  const gig = GIGS[id];
  oddFrame(s, x, y, 'gigPay', gig.title, 'DONE');
  text(s, x + 8, y + 32, gig.where, C.MUTED);
  grades.forEach((g, k) => {
    const ly = y + 48 + k * 13;
    text(s, x + 16, ly, `${gig.unit} ${k + 1}`, C.CREAM);
    const t = GRADE_TEXT[g];
    text(s, x + 120, ly, t, g === 'fail' || g === 'poor' ? C.RED3 : C.SAGE4);
  });
  const ty = y + 48 + grades.length * 13 + 8;
  blend(s, ty - 4, ty - 3, x + 8, x + P.w - 8, C.PLATE_HI);
  const row = (k: number, label: string, v: string, col: RGB) => {
    text(s, x + 16, ty + k * 13, label, C.MUTED);
    text(s, x + P.w - 16 - textWidthPx(v), ty + k * 13, v, col);
  };
  row(0, 'PAY (60%)', `$${p.pay}`, C.CREAM);
  row(1, 'TIPS', `$${p.tips}`, C.CREAM);
  row(2, 'TOTAL', `$${p.total}`, C.GOLD);
  text(s, x + 8, y + P.h - 32, 'NO PROMOTION XP', C.MUTED);
  footer(s, x, y, 'gigPay', [['SPACE', 'OK']]);
}
