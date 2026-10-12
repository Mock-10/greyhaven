// Panels for the Phase 3 crime minigames (docs/06), in the style of ui/panelsOdd.ts: 248 × 176 plates, a 2× gold
// title, the 5 × 7 body font and the task drawn as a picture (the clerk's nerve meter, the safe dial, the ATM keypad,
// the drill's heat gauge, the DVR tape and the alarm panel's wires). Pure code: each function draws one panel at
// (x, y) from a minigame's state.

import { WIRE_COLOURS, type WireColour } from '../minigames/logic';
import {
  ARROW_LIST,
  type Arrow,
  type AtmHackGame,
  type BypassGame,
  type DrillGame,
  type IntimidateGame,
  type SafeCrackGame,
  type WipeGame,
} from '../minigames/crime';
import type { Grade } from '../systems/career';
import { C, bar, blend, hintKeys, plate, px, text, textWidthPx, type RGB, type Surface } from './hudDraw';
import { icon } from './icons';

export const CRIME_PANEL_SIZE = {
  intimidate: { w: 248, h: 176 },
  safeCrack: { w: 248, h: 176 },
  atmHack: { w: 248, h: 176 },
  drill: { w: 248, h: 176 },
  wipe: { w: 248, h: 176 },
  bypass: { w: 248, h: 176 },
} as const;
export type CrimePanelKind = keyof typeof CRIME_PANEL_SIZE;

const W = 248;
const H = 176;

const GRADE_TEXT: Record<Grade, string> = {
  fail: 'FAILED',
  poor: 'POOR',
  ok: 'OK',
  good: 'GOOD',
  excellent: 'EXCELLENT',
};

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const STEEL = hex('#989ea1');
const STEEL_LO = hex('#57646e');
const STEEL_DK = hex('#40414e');
const SCREEN = hex('#2d3a3e');
const SCREEN_HI = hex('#758672');
const TAPE = hex('#3a2c2c');
const TAPE_HI = hex('#6f5748');
const WIRE_RGB: Record<WireColour, RGB> = {
  red: hex('#b95e5e'),
  navy: hex('#636e94'),
  sage: hex('#93a387'),
  khaki: hex('#b9b48c'),
  white: hex('#ded6c8'),
};

function frame(s: Surface, x: number, y: number, title: string, right: string): void {
  plate(s, x, y, W, H, C.EDGE, 0.96);
  text(s, x + 8, y + 7, title, C.GOLD, C.INK, 2);
  const rw = textWidthPx(right);
  text(s, x + W - 8 - rw, y + 11, right, C.MUTED);
  const gx0 = x + 8 + textWidthPx(title, 2) + 8;
  const gx1 = x + W - 8 - rw - 8;
  for (let gx = gx0; gx + 1 < gx1; gx += 4) {
    px(s, gx, y + 12, C.PLATE_HI);
    px(s, gx, y + 16, C.PLATE_HI);
  }
}

function result(s: Surface, x: number, y: number, grade: Grade, caption: string): void {
  const t = GRADE_TEXT[grade];
  const col = grade === 'fail' || grade === 'poor' ? C.RED3 : C.CREAM;
  text(s, x + Math.round((W - textWidthPx(caption)) / 2), y + 64, caption, C.MUTED);
  text(s, x + Math.round((W - textWidthPx(t, 2)) / 2), y + 78, t, col, C.INK, 2);
}

function footer(s: Surface, x: number, y: number, items: readonly [string, string][]): void {
  hintKeys(s, x + 8, y + H - 17, items);
}

/** A labelled time bar (cream, not gold: gold is for valuables and things to press). */
function timeBar(s: Surface, x: number, y: number, w: number, frac: number): void {
  text(s, x, y, 'TIME', C.MUTED);
  bar(s, x + 36, y, w - 36, 7, frac, frac < 0.25 ? C.HP : C.CREAM, frac < 0.25 ? C.HP_LO : C.MUTED);
}

function disc(s: Surface, cx: number, cy: number, r: number, col: RGB): void {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) px(s, cx + i, cy + j, col);
}

function line(s: Surface, x0: number, y0: number, x1: number, y1: number, col: RGB, thick = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    const xx = Math.round(x0 + ((x1 - x0) * k) / n);
    const yy = Math.round(y0 + ((y1 - y0) * k) / n);
    for (let t = 0; t < thick; t++) {
      px(s, xx + t, yy, col);
      px(s, xx, yy + t, col);
    }
  }
}

// ------------------------------------------------------------------ intimidate
export function drawIntimidate(s: Surface, x: number, y: number, g: IntimidateGame, label: string): void {
  frame(s, x, y, 'INTIMIDATE', label);
  if (g.done && g.grade)
    return result(s, x, y, g.grade, g.grade === 'fail' ? 'THE CLERK HIT THE ALARM' : 'THE REGISTER IS OPEN');
  // the clerk, hands up when the nerve is in the band
  blend(s, y + 32, y + 104, x + 12, x + 84, C.INK, 0.7);
  icon(s, x + 32, y + 46, 'face/clerk');
  const inBand = g.nerve >= g.band[0] && g.nerve <= g.band[1];
  const say = g.nerve > g.band[1] ? 'PANICKING' : inBand ? 'COMPLYING' : 'STALLING';
  text(s, x + 48 - Math.round(textWidthPx(say) / 2), y + 88, say, inBand ? C.SAGE4 : C.RED3);
  // the nerve meter: a tall bar, the band in sage, the alarm line in red
  const mx = x + 104;
  const my = y + 32;
  const mh = 104;
  const mw = 22;
  blend(s, my, my + mh, mx, mx + mw, C.PLATE_HI);
  const yAt = (v: number) => my + mh - Math.round(Math.min(1, v) * mh);
  blend(s, yAt(g.band[1]), yAt(g.band[0]), mx, mx + mw, C.SAGE1);
  blend(s, my, yAt(g.alarmAt), mx, mx + mw, C.HP_LO);
  const ny = yAt(g.nerve);
  blend(s, ny - 1, ny + 2, mx - 4, mx + mw + 4, C.CREAM);
  text(s, mx - 2, my + mh + 4, 'NERVE', C.MUTED);
  // progress and time
  const rx = x + 140;
  text(s, rx, y + 34, 'COMPLY', C.MUTED);
  bar(s, rx, y + 45, W - 148, 7, g.progress, C.SAGE4, C.SAGE1);
  text(s, rx, y + 62, 'ALARM', C.MUTED);
  text(s, rx, y + 74, 'TOP OF', C.RED3);
  text(s, rx, y + 84, 'THE METER', C.RED3);
  timeBar(s, rx, y + 104, W - 148, g.timeLeft / 10);
  footer(s, x, y, [
    ['SPACE', 'HOLD TO PRESS'],
    ['ESC', 'BACK OFF'],
  ]);
}

// ------------------------------------------------------------------ safe crack
export function drawSafeCrack(s: Surface, x: number, y: number, g: SafeCrackGame, label: string): void {
  frame(s, x, y, 'SAFE', label);
  if (g.done && g.grade)
    return result(s, x, y, g.grade, g.grade === 'fail' ? 'THE DIAL JAMMED' : 'THE SAFE IS OPEN');
  const cx = x + 70;
  const cy = y + 92;
  const r = 52;
  const click = g.clicking;
  disc(s, cx, cy, r + 2, C.INK);
  disc(s, cx, cy, r, click ? C.STONE5 : STEEL);
  disc(s, cx, cy, r - 6, STEEL_LO);
  disc(s, cx, cy, r - 18, STEEL_DK);
  // ticks every 2, a long tick every 10, turning with the dial (the pointer stays at the top)
  for (let n = 0; n < 100; n += 2) {
    const a = ((n - g.dial) / 100) * Math.PI * 2 - Math.PI / 2;
    const long = n % 10 === 0;
    const r0 = long ? r - 13 : r - 9;
    line(
      s,
      Math.round(cx + Math.cos(a) * r0),
      Math.round(cy + Math.sin(a) * r0),
      Math.round(cx + Math.cos(a) * (r - 7)),
      Math.round(cy + Math.sin(a) * (r - 7)),
      long ? C.CREAM : C.MUTED,
    );
  }
  disc(s, cx, cy, 7, STEEL);
  // the pointer
  blend(s, cy - r - 6, cy - r + 4, cx - 1, cx + 2, C.HP);
  // the numbers set so far
  const rx = x + 136;
  text(s, rx, y + 34, 'COMBINATION', C.MUTED);
  g.targets.forEach((t, k) => {
    const bx = rx + k * 20;
    blend(s, y + 46, y + 60, bx, bx + 17, k < g.set ? C.SAGE1 : C.PLATE_HI);
    if (k < g.set) text(s, bx + 2, y + 50, String(t).padStart(2, '0'), C.CREAM);
  });
  text(s, rx, y + 70, click ? 'CLICK!' : 'LISTEN...', click ? C.CREAM : C.MUTED);
  text(s, rx, y + 86, `MISSES ${g.misses}/3`, g.misses ? C.RED3 : C.MUTED);
  if (g.flash && g.flash.t < 0.3) blend(s, y + 30, y + 31, x + 8, x + W - 8, g.flash.ok ? C.SAGE4 : C.HP);
  timeBar(s, rx, y + 104, W - 144, g.timeLeft / 40);
  footer(s, x, y, [
    ['A/D', 'TURN'],
    ['SPACE', 'SET'],
    ['ESC', 'STOP'],
  ]);
}

// ------------------------------------------------------------------ ATM hack
const ARROW_KEY: Record<Arrow, string> = { up: 'W', right: 'D', down: 'S', left: 'A' };

function arrowGlyph(s: Surface, cx: number, cy: number, a: Arrow, col: RGB): void {
  // a small solid triangle pointing the arrow's way
  for (let k = 0; k < 6; k++) {
    for (let w = -k; w <= k; w++) {
      if (a === 'up') px(s, cx + w, cy - 3 + k, col);
      else if (a === 'down') px(s, cx + w, cy + 3 - k, col);
      else if (a === 'left') px(s, cx - 3 + k, cy + w, col);
      else px(s, cx + 3 - k, cy + w, col);
    }
  }
}

export function drawAtmHack(s: Surface, x: number, y: number, g: AtmHackGame, label: string): void {
  frame(s, x, y, 'ATM HACK', label);
  if (g.done && g.grade)
    return result(s, x, y, g.grade, g.grade === 'fail' ? 'ALARM TRIPPED' : 'CASSETTE UNLOCKED');
  // the ATM's screen and its four arrow pads
  blend(s, y + 32, y + 140, x + 12, x + 124, STEEL_DK);
  blend(s, y + 38, y + 70, x + 20, x + 116, SCREEN);
  const status = g.showT !== null ? 'WATCH' : 'REPEAT';
  text(s, x + 68 - Math.round(textWidthPx(status) / 2), y + 44, status, SCREEN_HI);
  for (let k = 0; k < g.length; k++) {
    const dx = x + 68 - g.length * 7 + k * 14;
    blend(s, y + 58, y + 64, dx, dx + 10, k < g.entered ? SCREEN_HI : STEEL_LO);
  }
  const pads: Record<Arrow, [number, number]> = {
    up: [68, 86],
    left: [44, 108],
    right: [92, 108],
    down: [68, 128],
  };
  for (const a of ARROW_LIST) {
    const [px0, py0] = pads[a];
    const lit = g.lit === a;
    blend(s, y + py0 - 9, y + py0 + 9, x + px0 - 10, x + px0 + 10, lit ? C.CREAM : STEEL_LO);
    arrowGlyph(s, x + px0, y + py0, a, lit ? C.INK : C.CREAM);
  }
  const rx = x + 136;
  text(s, rx, y + 34, `ROUND ${Math.min(g.round + 1, g.rounds)}/${g.rounds}`, C.CREAM);
  text(s, rx, y + 50, 'WATCH THE PADS', C.MUTED);
  text(s, rx, y + 62, 'LIGHT UP, THEN', C.MUTED);
  text(s, rx, y + 74, 'PRESS THEM BACK', C.MUTED);
  text(s, rx, y + 86, 'IN ORDER.', C.MUTED);
  text(s, rx, y + 104, 'A WRONG KEY', C.RED3);
  text(s, rx, y + 114, 'TRIPS THE ALARM', C.RED3);
  footer(s, x, y, [
    ['WASD', 'PRESS'],
    ['ESC', 'WALK AWAY'],
  ]);
}

export function arrowForKey(k: string): Arrow | null {
  for (const a of ARROW_LIST) if (ARROW_KEY[a] === k) return a;
  if (k === 'ARROWUP') return 'up';
  if (k === 'ARROWDOWN') return 'down';
  if (k === 'ARROWLEFT') return 'left';
  if (k === 'ARROWRIGHT') return 'right';
  return null;
}

// ------------------------------------------------------------------ drill
export function drawDrill(s: Surface, x: number, y: number, g: DrillGame, label: string): void {
  frame(s, x, y, 'DRILL', label);
  if (g.done && g.grade)
    return result(s, x, y, g.grade, g.grade === 'fail' ? 'THE BIT SNAPPED' : 'THROUGH THE LOCK');
  // the ATM's face plate with the hole growing through it
  blend(s, y + 32, y + 140, x + 12, x + 108, STEEL_DK);
  blend(s, y + 40, y + 132, x + 20, x + 100, STEEL_LO);
  disc(s, x + 60, y + 86, 30, STEEL);
  disc(s, x + 60, y + 86, Math.max(1, Math.round(4 + g.progress * 20)), C.INK);
  icon(s, x + 72, y + 102, 'item/drill');
  if (g.holding)
    for (let k = 0; k < 6; k++) px(s, x + 60 + ((k * 7) % 13) - 6, y + 86 + ((k * 5) % 11) - 5, C.CREAM);
  // heat gauge
  const gx = x + 124;
  text(s, gx, y + 34, 'HEAT', C.MUTED);
  const gy = y + 46;
  const gh = 90;
  blend(s, gy, gy + gh, gx, gx + 16, C.PLATE_HI);
  blend(s, gy, gy + Math.round((1 - g.red) * gh), gx, gx + 16, C.HP_LO);
  const hy = gy + gh - Math.round(Math.min(1, g.heat) * gh);
  blend(s, hy, gy + gh, gx + 3, gx + 13, g.heat >= g.red ? C.HP : C.CREAM);
  const rx = x + 152;
  text(s, rx, y + 34, 'THROUGH', C.MUTED);
  bar(s, rx, y + 45, W - 160, 7, g.progress, C.SAGE4, C.SAGE1);
  text(s, rx, y + 62, 'JAMS', C.MUTED);
  for (let k = 0; k < 3; k++)
    blend(s, y + 73, y + 81, rx + k * 14, rx + k * 14 + 10, k < g.jams ? C.HP : C.PLATE_HI);
  text(s, rx, y + 90, 'EASE OFF', C.MUTED);
  text(s, rx, y + 100, 'IN THE RED', C.MUTED);
  timeBar(s, rx, y + 120, W - 160, g.timeLeft / 30);
  footer(s, x, y, [
    ['SPACE', 'HOLD TO DRILL'],
    ['ESC', 'STOP'],
  ]);
}

// ------------------------------------------------------------------ wipe footage
export function drawWipe(s: Surface, x: number, y: number, g: WipeGame, label: string): void {
  frame(s, x, y, 'WIPE TAPE', label);
  if (g.done && g.grade)
    return result(s, x, y, g.grade, g.grade === 'fail' ? 'NOT ALL OF IT' : 'THE TAPE IS CLEAN');
  // the DVR's tape strip, the moving window and the scrub marker
  const tx = x + 16;
  const tw = W - 32;
  const ty = y + 52;
  blend(s, ty - 12, ty + 40, x + 10, x + W - 10, STEEL_DK);
  blend(s, ty, ty + 24, tx, tx + tw, TAPE);
  for (let k = 0; k < tw; k += 10) blend(s, ty + 2, ty + 5, tx + k, tx + k + 5, TAPE_HI);
  for (let k = 0; k < tw; k += 10) blend(s, ty + 19, ty + 22, tx + k, tx + k + 5, TAPE_HI);
  const wx0 = tx + Math.round((g.window - g.halfWidth) * tw);
  const wx1 = tx + Math.round((g.window + g.halfWidth) * tw);
  blend(s, ty, ty + 24, Math.max(tx, wx0), Math.min(tx + tw, wx1), C.SAGE1, 0.85);
  const mx = tx + Math.round(g.marker * tw);
  blend(s, ty - 6, ty + 30, mx - 1, mx + 2, g.inside ? C.CREAM : C.HP);
  text(s, x + 16, y + 98, 'ERASED', C.MUTED);
  bar(s, x + 70, y + 98, W - 86, 7, g.progress, C.SAGE4, C.SAGE1);
  text(
    s,
    x + 16,
    y + 114,
    g.holding ? (g.inside ? 'ERASING' : 'SMEARING') : 'HOLD SPACE INSIDE THE GREEN',
    g.holding && !g.inside ? C.RED3 : C.MUTED,
  );
  timeBar(s, x + 16, y + 132, W - 32, g.timeLeft / 25);
  footer(s, x, y, [
    ['A/D', 'MOVE'],
    ['SPACE', 'HOLD TO ERASE'],
    ['ESC', 'STOP'],
  ]);
}

// ------------------------------------------------------------------ alarm bypass
export function drawBypass(s: Surface, x: number, y: number, g: BypassGame, label: string): void {
  frame(s, x, y, 'ALARM PANEL', label);
  if (g.done && g.grade)
    return result(
      s,
      x,
      y,
      g.grade,
      label === 'CCTV'
        ? g.grade === 'fail'
          ? 'WRONG WIRE'
          : 'CAMERAS OFF'
        : g.grade === 'fail'
          ? 'THE ALARM IS RINGING'
          : 'PANEL CUT',
    );
  // the wiring diagram: the order to cut, as coloured chips
  text(s, x + 12, y + 34, 'CUT IN THIS ORDER', C.MUTED);
  g.order.forEach((wi, k) => {
    const bx = x + 12 + k * 24;
    blend(s, y + 46, y + 58, bx, bx + 18, WIRE_RGB[g.wires[wi] ?? WIRE_COLOURS[0]]);
    if (k < g.cut.length) line(s, bx, y + 46, bx + 17, y + 57, C.INK, 2);
  });
  // the panel's wires, keyed 1–4
  const n = g.wires.length;
  blend(s, y + 66, y + 138, x + 12, x + W - 12, STEEL_DK);
  g.wires.forEach((c, k) => {
    const wx = x + 32 + k * Math.round((W - 64) / Math.max(1, n - 1));
    const cut = g.cut.includes(k);
    blend(s, y + 72, cut ? y + 96 : y + 126, wx - 2, wx + 2, WIRE_RGB[c]);
    if (cut) blend(s, y + 104, y + 126, wx - 2, wx + 2, WIRE_RGB[c]);
    text(s, wx - 2, y + 128, String(k + 1), C.CREAM);
  });
  timeBar(s, x + 132, y + 34, W - 144, g.timeLeft / Math.max(1, g.seconds));
  footer(s, x, y, [
    ['1-4', 'CUT'],
    ['ESC', 'RUN'],
  ]);
}
