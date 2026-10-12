// Panels for the M7 job minigames (docs/06, docs/03), in the style of ui/panels.ts and the docs/11 UI redesign
// (2026-10-12): 248 × 176 plates with a 26 px drag strip, a 2× gold title, the 5 × 7 body font, and the task drawn
// as a picture (the wheel, the tree, the truck bed, the street map, the desk). Pure code: each function draws one
// panel at (x, y) from a minigame's state; layout helpers give the click targets. tests/panelsJobs.test.ts checks
// that no text or picture overlaps another and that nothing leaves its panel.

import type { BoltTorqueGame } from '../minigames/boltTorque';
import type { ChopGame } from '../minigames/chop';
import type { DiagnoseGame } from '../minigames/diagnose';
import type { DoorstepGame } from '../minigames/doorstep';
import type { FellGame } from '../minigames/fell';
import type { LoadGame, Piece } from '../minigames/load';
import type { MeetingGame } from '../minigames/meeting';
import type { ResprayGame } from '../minigames/respray';
import type { RouteGame } from '../minigames/route';
import type { SignatureGame } from '../minigames/signature';
import type { StampSignGame } from '../minigames/stampSign';
import type { TyreChangeGame, ArrowDir } from '../minigames/tyreChange';
import { TYRE_STEPS } from '../minigames/tyreChange';
import { BALANCE_JOBS } from '../config/balanceJobs';
import { FAULTS, type SymptomKind } from '../data/faults';
import { MEETING_BOSS } from '../data/meetings';
import type { Grade } from '../systems/career';
import {
  C,
  LINE,
  bar,
  blend,
  hintKeys,
  plate,
  px,
  spriteScaled,
  text,
  textWidthPx,
  wrapPx,
  type RGB,
  type Surface,
} from './hudDraw';
import { icon } from './icons';

export const JOB_PANEL_SIZE = {
  diagnose: { w: 248, h: 176 },
  boltTorque: { w: 248, h: 176 },
  tyreChange: { w: 248, h: 176 },
  respray: { w: 248, h: 176 },
  chop: { w: 248, h: 176 },
  load: { w: 248, h: 176 },
  route: { w: 248, h: 176 },
  stampSign: { w: 248, h: 176 },
  meeting: { w: 248, h: 176 },
  fell: { w: 248, h: 176 },
  doorstep: { w: 248, h: 176 },
  signature: { w: 248, h: 176 },
} as const;
export type JobPanelKind = keyof typeof JOB_PANEL_SIZE;

type Box = { x: number; y: number; w: number; h: number };

const GRADE_TEXT: Record<Grade, string> = {
  fail: 'FAILED',
  poor: 'POOR',
  ok: 'OK',
  good: 'GOOD',
  excellent: 'EXCELLENT',
};

// a few colours the job pictures need beyond the HUD roles (all from art/palette.json ramps)
const NAVY: RGB = [94, 114, 160];
const NAVY_LO: RGB = [70, 82, 118];
const TYRE: RGB = [46, 39, 50];
const RIM: RGB = [152, 158, 161];
const RIM_LO: RGB = [81, 86, 112];
const BARK: RGB = [111, 78, 66];
const BARK_LO: RGB = [80, 58, 56];
const WOOD: RGB = [201, 172, 132];
const WOOD_LO: RGB = [160, 128, 98];
const PAINT: RGB = [152, 69, 79];
const PAINT_HI: RGB = [185, 94, 94];
const PAINT_RUN: RGB = [111, 53, 69];
const PRIMER: RGB = [168, 160, 170];
const SKIN: RGB = [210, 170, 140];
const DIM: RGB = [80, 63, 88];

/** Route colours, in the order the routes are listed. */
export const ROUTE_RGB: readonly RGB[] = [C.RED3, NAVY, C.SAGE4];

/** The frame every panel shares (as ui/panels.ts frame): plate, gold 2× title, a muted label on the right, a grip. */
export function jobFrame(
  s: Surface,
  x: number,
  y: number,
  kind: JobPanelKind,
  title: string,
  right: string,
): void {
  const { w, h } = JOB_PANEL_SIZE[kind];
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
export function jobResult(
  s: Surface,
  x: number,
  y: number,
  kind: JobPanelKind,
  grade: Grade,
  caption: string,
): void {
  const { w } = JOB_PANEL_SIZE[kind];
  const t = GRADE_TEXT[grade];
  const col = grade === 'fail' || grade === 'poor' ? C.RED3 : C.GOLD;
  text(s, x + Math.round((w - textWidthPx(caption)) / 2), y + 64, caption, C.MUTED);
  text(s, x + Math.round((w - textWidthPx(t, 2)) / 2), y + 78, t, col, C.INK, 2);
}

function footer(
  s: Surface,
  x: number,
  y: number,
  kind: JobPanelKind,
  items: readonly [string, string][],
): void {
  hintKeys(s, x + 8, y + JOB_PANEL_SIZE[kind].h - 17, items);
}

/** A labelled time bar across the panel. */
function timeBar(s: Surface, x: number, y: number, w: number, frac: number): void {
  text(s, x, y, 'TIME', C.MUTED);
  bar(s, x + 36, y, w - 36, 7, frac, C.GOLD, C.GOLD_LO);
}

/** A gold number keycap (as on the shop cards). */
function keycap(s: Surface, x: number, y: number, key: string): void {
  const kw = textWidthPx(key) + 6;
  blend(s, y, y + 11, x, x + kw, C.GOLD);
  blend(s, y + 10, y + 11, x, x + kw, C.GOLD_LO);
  text(s, x + 3, y + 2, key, C.PLATE);
}

/** A 1 px outline. */
function outline(s: Surface, r: Box, col: RGB): void {
  blend(s, r.y, r.y + 1, r.x, r.x + r.w, col);
  blend(s, r.y + r.h - 1, r.y + r.h, r.x, r.x + r.w, col);
  blend(s, r.y, r.y + r.h, r.x, r.x + 1, col);
  blend(s, r.y, r.y + r.h, r.x + r.w - 1, r.x + r.w, col);
}

/** A filled disc. */
function disc(s: Surface, cx: number, cy: number, r: number, col: RGB): void {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) px(s, cx + i, cy + j, col);
}

/** A flash word ("RIGHT", "WRONG") on a small plate. */
function stampWord(s: Surface, x: number, y: number, word: string, ok: boolean): void {
  const col = ok ? C.SAGE4 : C.RED3;
  plate(s, x - 3, y - 4, textWidthPx(word) + 9, 15, col, 0.9);
  text(s, x + 2, y, word, col);
}

// ------------------------------------------------------------------ diagnose
const SYMPTOM_ICON: Record<SymptomKind, readonly string[]> = {
  sound: ['..#....', '.##.#..', '###..#.', '###..#.', '###..#.', '.##.#..', '..#....'],
  smoke: ['..##...', '.####..', '..##.#.', '....###', '.##..#.', '####...', '.##....'],
  leak: ['...#...', '...#...', '..###..', '.#####.', '.#####.', '.#####.', '..###..'],
  dash: ['...#...', '..#.#..', '..#.#..', '.#.#.#.', '.#...#.', '#..#..#', '#######'],
  feel: ['.#####.', '#.....#', '#..#..#', '#######', '#..#..#', '#.....#', '.#####.'],
};
const SYMPTOM_RGB: Record<SymptomKind, RGB> = {
  sound: C.GLASS4,
  smoke: C.STONE5,
  leak: C.SAGE4,
  dash: C.DIRTY,
  feel: C.KHAKI4,
};
/** Symptom lines end before the car picture. */
export const SYMPTOM_TEXT_W = 150;

export function diagnoseOption(x: number, y: number, k: number): Box {
  return { x: x + 8 + (k % 2) * 118, y: y + 86 + Math.floor(k / 2) * 26, w: 114, h: 22 };
}

/** A side-on hatchback with the hood up, and the signs of its fault around it. */
function carPicture(s: Surface, x: number, y: number, kinds: readonly SymptomKind[]): void {
  blend(s, y, y + 46, x, x + 62, C.INK, 0.7);
  const by = y + 26;
  blend(s, by, by + 9, x + 4, x + 58, NAVY); // body
  blend(s, by - 8, by, x + 16, x + 44, NAVY); // cabin
  blend(s, by - 6, by - 1, x + 19, x + 29, C.GLASS4);
  blend(s, by - 6, by - 1, x + 31, x + 41, C.GLASS4);
  blend(s, by + 7, by + 9, x + 4, x + 58, NAVY_LO);
  for (let k = 0; k < 8; k++) px(s, x + 46 + k, by - 2 - k, NAVY_LO); // the open hood
  for (const wx of [x + 15, x + 47]) {
    disc(s, wx, by + 10, 5, TYRE);
    disc(s, wx, by + 10, 2, RIM);
  }
  if (kinds.includes('smoke'))
    for (const [dx, dy, r] of [
      [50, 8, 3],
      [54, 4, 2],
      [47, 3, 2],
    ] as const)
      disc(s, x + dx, y + dy, r, C.STONE5);
  if (kinds.includes('leak')) blend(s, by + 15, by + 17, x + 26, x + 40, C.SAGE4);
  if (kinds.includes('sound'))
    for (let k = 0; k < 3; k++) {
      px(s, x + 3 + k * 2, by - 6 - k, C.GLASS4);
      px(s, x + 3 + k * 2, by - 2 + k, C.GLASS4);
    }
  if (kinds.includes('dash')) disc(s, x + 30, by - 12, 2, C.DIRTY);
}

export function drawDiagnose(s: Surface, x: number, y: number, g: DiagnoseGame, task: string): void {
  jobFrame(s, x, y, 'diagnose', 'DIAGNOSE', task);
  if (g.done && g.grade)
    return jobResult(s, x, y, 'diagnose', g.grade, `${g.right} OF ${g.cars.length} RIGHT`);
  const fault = g.fault;
  const car = g.car;
  if (!fault || !car) return;
  text(s, x + 8, y + 32, `CAR ${g.round + 1}/${g.cars.length}`, C.MUTED);
  if (g.last && g.last.t < 0.6) stampWord(s, x + 80, y + 32, g.last.ok ? 'RIGHT' : 'WRONG', g.last.ok);
  fault.symptoms.forEach((sym, k) => {
    const ry = y + 46 + k * 18;
    spriteScaled(s, x + 8, ry - 3, SYMPTOM_ICON[sym.kind], { '#': SYMPTOM_RGB[sym.kind] }, 2);
    text(s, x + 26, ry, sym.text, C.CREAM);
  });
  carPicture(
    s,
    x + 178,
    y + 30,
    fault.symptoms.map((q) => q.kind),
  );
  car.options.forEach((f, k) => {
    const r = diagnoseOption(x, y, k);
    plate(s, r.x, r.y, r.w, r.h, C.LAVLT2, 0.9);
    keycap(s, r.x + 5, r.y + 5, String(k + 1));
    text(s, r.x + 22, r.y + 7, FAULTS[f]?.part ?? '', C.CREAM);
  });
  timeBar(s, x + 8, y + 143, JOB_PANEL_SIZE.diagnose.w - 16, g.timeLeft / g.timeTotal);
  footer(s, x, y, 'diagnose', [
    ['1-4', 'PICK THE PART'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ bolt torque
export function drawBoltTorque(s: Surface, x: number, y: number, g: BoltTorqueGame, task: string): void {
  jobFrame(s, x, y, 'boltTorque', 'TORQUE', task);
  if (g.done && g.grade)
    return jobResult(s, x, y, 'boltTorque', g.grade, g.grade === 'fail' ? 'STRIPPED A STUD' : 'WHEEL ON');
  const cx = x + 68;
  const cy = y + 92;
  const r = 50;
  // the dial ring round the wheel: cream good zone, gold great zone (as the lockpick)
  for (let j = -r - 2; j <= r + 2; j++)
    for (let i = -r - 2; i <= r + 2; i++) {
      const d = Math.hypot(i + 0.5, j + 0.5);
      const ang = ((Math.atan2(j + 0.5, i + 0.5) * 180) / Math.PI + 90 + 360) % 360;
      const off = Math.abs(((ang - g.zone + 540) % 360) - 180);
      if (d <= r - 12 && d > r - 22) px(s, cx + i, cy + j, TYRE);
      else if (d <= r - 22 && d > r - 25) px(s, cx + i, cy + j, RIM_LO);
      else if (d <= r - 25) px(s, cx + i, cy + j, RIM);
      else if (d <= r - 1 && d > r - 12)
        px(s, cx + i, cy + j, off <= g.great / 2 ? C.GOLD : off <= g.good / 2 ? C.CREAM : DIM);
      else if (d <= r + 1 && d > r - 12) px(s, cx + i, cy + j, C.INK);
    }
  // tread blocks on the tyre
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    px(s, Math.round(cx + Math.cos(a) * (r - 17)), Math.round(cy + Math.sin(a) * (r - 17)), C.PLATE_HI);
  }
  disc(s, cx, cy, 6, RIM_LO);
  disc(s, cx, cy, 3, RIM);
  // the nuts: dark when loose, cream torqued, gold torqued just right; the next one ringed
  for (let b = 0; b < g.bolts; b++) {
    const a = (b / g.bolts) * Math.PI * 2 - Math.PI / 2;
    const nx = Math.round(cx + Math.cos(a) * 14);
    const ny = Math.round(cy + Math.sin(a) * 14);
    const st = g.state[b];
    if (b === g.bolt) {
      blend(s, ny - 4, ny + 5, nx - 4, nx + 5, C.CREAM);
      blend(s, ny - 3, ny + 4, nx - 3, nx + 4, RIM_LO);
    }
    blend(s, ny - 2, ny + 3, nx - 2, nx + 3, st === 'great' ? C.GOLD : st === 'good' ? C.CREAM : C.INK);
  }
  // the needle sweeps the ring only, so it never hides the nuts
  const a = ((g.needle - 90) * Math.PI) / 180;
  for (let t = r - 12; t <= r - 1; t += 0.5) {
    const nx = Math.round(cx + t * Math.cos(a));
    const ny = Math.round(cy + t * Math.sin(a));
    px(s, nx, ny, C.HP);
    px(s, nx + 1, ny, C.HP);
    px(s, nx, ny + 1, C.HP);
  }
  const rx = x + 132;
  const rw = JOB_PANEL_SIZE.boltTorque.w - 140;
  text(s, rx, y + 34, 'PROGRESS', C.MUTED);
  bar(s, rx, y + 45, rw, 7, g.progress, C.GOLD, C.GOLD_LO);
  text(s, rx, y + 60, `NUTS ${g.step}/${g.bolts}`, C.CREAM);
  text(s, rx, y + 74, `JUST RIGHT ${g.greats}`, g.greats ? C.GOLD : C.MUTED);
  const maxM = BALANCE_JOBS.boltTorque.maxMisses;
  text(s, rx, y + 88, `OVER ${g.misses}/${maxM}`, g.misses ? C.RED3 : C.MUTED);
  if (g.flash && g.flash.t < 0.4)
    stampWord(s, rx + 3, y + 110, g.flash.ok ? 'TIGHT' : 'TOO HARD', g.flash.ok);
  else text(s, rx, y + 110, 'STAR PATTERN', C.MUTED);
  footer(s, x, y, 'boltTorque', [
    ['SPACE', 'TORQUE'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ tyre change
const ARROW_ROWS: Record<ArrowDir, readonly string[]> = {
  up: ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'],
  down: ['..###..', '..###..', '..###..', '#######', '.#####.', '..###..', '...#...'],
  left: ['...#...', '..##...', '.######', '#######', '.######', '..##...', '...#...'],
  right: ['...#...', '...##..', '######.', '#######', '######.', '...##..', '...#...'],
};

/** The car's corner: the body, the jack once it's in, the wheel (raised, off, or the spare going on). */
function wheelPicture(s: Surface, x: number, y: number, step: number): void {
  blend(s, y, y + 82, x, x + 100, C.INK, 0.7);
  const lift = step >= 2 && step < 6 ? 6 : 0;
  const floor = y + 76;
  blend(s, floor, floor + 2, x + 2, x + 98, C.PLATE_HI);
  // the body, with the wheel arch cut out
  const by = y + 22 - lift;
  blend(s, by, by + 26, x + 4, x + 96, NAVY);
  blend(s, by, by + 2, x + 4, x + 96, C.GLASS4);
  blend(s, by + 22, by + 26, x + 4, x + 96, NAVY_LO);
  for (let j = 0; j < 14; j++) {
    const half = Math.round(Math.sqrt(Math.max(0, 196 - (14 - j) * (14 - j))));
    blend(s, by + 12 + j, by + 13 + j, x + 50 - half - 4, x + 50 + half + 4, C.INK);
  }
  // the jack under the sill
  if (step >= 2 && step < 6) {
    blend(s, floor - 3, floor, x + 74, x + 92, C.HP_LO);
    for (let k = 0; k < lift + 20; k++) {
      px(s, x + 76 + Math.round((k * 14) / (lift + 20)), floor - 3 - k, C.HP);
      px(s, x + 90 - Math.round((k * 14) / (lift + 20)), floor - 3 - k, C.HP);
    }
  }
  const wheel = (cx: number, cy: number, nuts: boolean) => {
    disc(s, cx, cy, 15, TYRE);
    disc(s, cx, cy, 9, RIM_LO);
    disc(s, cx, cy, 7, RIM);
    if (nuts)
      for (let b = 0; b < 5; b++) {
        const a = (b / 5) * Math.PI * 2;
        px(s, Math.round(cx + Math.cos(a) * 4), Math.round(cy + Math.sin(a) * 4), C.INK);
      }
  };
  const wy = floor - 16 - lift;
  // steps: 0 loosen, 1 jack, 2 pull, 3 fit spare, 4 tighten, 5 lower
  if (step <= 2) wheel(x + 50, wy, step === 0);
  else wheel(x + 50, wy, step >= 5);
  if (step >= 3) {
    // the old wheel leaning on the left, the flat at the bottom
    disc(s, x + 16, floor - 13, 12, TYRE);
    disc(s, x + 16, floor - 13, 5, RIM_LO);
    blend(s, floor - 2, floor, x + 6, x + 26, TYRE);
  }
}

export function drawTyreChange(s: Surface, x: number, y: number, g: TyreChangeGame, task: string): void {
  const W = JOB_PANEL_SIZE.tyreChange.w;
  jobFrame(s, x, y, 'tyreChange', 'TYRE CHANGE', task);
  if (g.done && g.grade) return jobResult(s, x, y, 'tyreChange', g.grade, 'TYRE CHANGED');
  wheelPicture(s, x + 8, y + 30, g.step);
  const lx = x + 116;
  TYRE_STEPS.forEach((name, k) => {
    const ly = y + 32 + k * 13;
    const done = k < g.step;
    const cur = k === g.step;
    if (cur) blend(s, ly - 3, ly + 10, lx - 3, x + W - 8, C.PLATE_HI);
    blend(s, ly, ly + 7, lx, lx + 7, done ? C.SAGE4 : cur ? C.CREAM : C.PLATE_HI);
    if (done) blend(s, ly + 2, ly + 5, lx + 2, lx + 5, C.SAGE1);
    text(s, lx + 12, ly, name, done ? C.SAGE4 : cur ? C.CREAM : C.MUTED);
  });
  // the keys for this step, as big keycaps; pressed ones go dark
  const ky = y + 116;
  g.keys.forEach((dir, k) => {
    const kx = lx + k * 22;
    const pressed = k < g.pos;
    blend(s, ky, ky + 18, kx, kx + 18, pressed ? C.SAGE1 : C.GOLD);
    blend(s, ky + 16, ky + 18, kx, kx + 18, pressed ? C.INK : C.GOLD_LO);
    spriteScaled(s, kx + 5, ky + 4, ARROW_ROWS[dir], { '#': pressed ? C.SAGE4 : C.PLATE }, 1);
  });
  if (g.wrongT < 0.3) blend(s, ky + 20, ky + 21, lx, x + W - 8, C.RED3);
  text(s, lx + 72, ky + 6, `ERRORS ${g.errors}`, g.errors ? C.RED3 : C.MUTED);
  timeBar(s, x + 8, y + 143, W - 16, g.timeLeft / g.timeTotal);
  footer(s, x, y, 'tyreChange', [
    ['ARROWS', 'DO THE STEP'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ respray
/** The door panel on screen: map the mouse to the nozzle with it. */
export function resprayArea(x: number, y: number, g: ResprayGame): Box {
  const cell = 12;
  return { x: x + 28, y: y + 36, w: g.cols * cell, h: g.rows * cell };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

export function drawRespray(s: Surface, x: number, y: number, g: ResprayGame, task: string): void {
  const R = BALANCE_JOBS.respray;
  jobFrame(s, x, y, 'respray', 'RESPRAY', task);
  if (g.done && g.grade) return jobResult(s, x, y, 'respray', g.grade, `${g.even} OF ${g.coat.length} EVEN`);
  const A = resprayArea(x, y, g);
  const cell = A.w / g.cols;
  blend(s, A.y - 6, A.y + A.h + 10, A.x - 6, A.x + A.w + 6, C.INK, 0.8);
  // the door: primer grey going to the paint as coats build, darker past even, a drip below a run
  for (let j = 0; j < g.rows; j++)
    for (let i = 0; i < g.cols; i++) {
      const c = g.coat[j * g.cols + i] as number;
      const col =
        c < R.lo
          ? mix(PRIMER, PAINT, c / R.lo)
          : c <= R.hi
            ? PAINT
            : mix(PAINT, PAINT_RUN, (c - R.hi) / R.hi);
      const cx = A.x + i * cell;
      const cy = A.y + j * cell;
      blend(s, cy, cy + cell, cx, cx + cell, col);
      if (c > R.runAt) blend(s, cy + cell - 2, cy + cell + 4, cx + 4, cx + 6, PAINT_RUN);
    }
  blend(s, A.y + 2, A.y + 3, A.x + 2, A.x + A.w - 2, PAINT_HI, 0.35); // a shine along the top
  blend(s, A.y + 26, A.y + 30, A.x + A.w - 30, A.x + A.w - 12, C.INK, 0.5); // the handle recess
  outline(s, A, C.INK);
  // the nozzle: a ring, with a mist when spraying
  const nx = Math.round(A.x + g.nozzle.x * A.w);
  const ny = Math.round(A.y + g.nozzle.y * A.h);
  const rr = Math.round(R.radius * cell);
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    px(
      s,
      Math.round(nx + Math.cos(a) * rr),
      Math.round(ny + Math.sin(a) * rr),
      g.spraying ? C.CREAM : C.MUTED,
    );
  }
  blend(s, ny, ny + 1, nx - 3, nx + 4, C.CREAM);
  blend(s, ny - 3, ny + 4, nx, nx + 1, C.CREAM);
  text(s, x + 8, y + 126, `EVEN ${g.even}/${g.coat.length}`, C.CREAM);
  text(s, x + 104, y + 126, `RUNS ${g.runs}`, g.runs ? C.RED3 : C.MUTED);
  timeBar(s, x + 8, y + 143, JOB_PANEL_SIZE.respray.w - 16, g.timeLeft / g.timeTotal);
  footer(s, x, y, 'respray', [
    ['HOLD', 'SPRAY'],
    ['ARROWS', 'AIM'],
    ['ENTER', 'DONE'],
  ]);
}

// ------------------------------------------------------------------ chop
/** The swing meter's bar. */
export function chopMeter(x: number, y: number): Box {
  return { x: x + 8, y: y + 132, w: JOB_PANEL_SIZE.chop.w - 16, h: 10 };
}

export function drawChop(s: Surface, x: number, y: number, g: ChopGame, task: string): void {
  const B = BALANCE_JOBS.chop;
  jobFrame(s, x, y, 'chop', 'CHOP', task);
  if (g.done && g.grade)
    return jobResult(s, x, y, 'chop', g.grade, g.felled ? 'TIMBER' : 'THE TREE STILL STANDS');
  // the trunk, with the notch cut into its right side
  const tx = x + 30;
  const ty = y + 30;
  blend(s, ty, ty + 96, x + 8, x + 110, C.INK, 0.7);
  blend(s, ty, ty + 96, tx, tx + 44, BARK);
  for (let k = 0; k < 10; k++)
    blend(s, ty + 4 + k * 9, ty + 6 + k * 9, tx + 4 + (k % 3) * 11, tx + 12 + (k % 3) * 11, BARK_LO);
  blend(s, ty, ty + 96, tx, tx + 3, BARK_LO);
  blend(s, ty + 92, ty + 96, x + 8, x + 110, C.SAGE1); // the ground
  const deep = Math.round((Math.min(g.depth, g.depthNeeded) / g.depthNeeded) * 30);
  const ny = ty + 62;
  for (let j = -8; j <= 8; j++) {
    const w = Math.round(deep * (1 - Math.abs(j) / 9));
    if (w > 0) blend(s, ny + j, ny + j + 1, tx + 44 - w, tx + 44, j < 0 ? WOOD : WOOD_LO);
  }
  if (g.last && g.last.t < 0.3 && g.last.result !== 'miss')
    for (const [dx, dy] of [
      [6, -10],
      [12, -4],
      [9, 3],
      [16, -8],
    ] as const)
      blend(s, ny + dy, ny + dy + 2, tx + 46 + dx, tx + 48 + dx, WOOD);
  const rx = x + 120;
  icon(s, x + 206, y + 30, 'job/lumber');
  text(s, rx, y + 34, 'NOTCH', C.MUTED);
  bar(s, rx, y + 45, 80, 7, g.depth / g.depthNeeded, C.GOLD, C.GOLD_LO, g.depthNeeded);
  text(s, rx, y + 64, `SWINGS ${g.swings}/${g.maxSwings}`, C.CREAM);
  text(s, rx, y + 78, `GLANCED ${g.misses}`, g.misses ? C.RED3 : C.MUTED);
  if (g.last && g.last.t < 0.5) {
    const w = g.last.result === 'great' ? 'DEEP CUT' : g.last.result === 'good' ? 'CUT' : 'GLANCED';
    stampWord(s, rx + 3, y + 100, w, g.last.result !== 'miss');
  } else text(s, rx, y + 100, 'STOP IN THE ZONE', C.MUTED);
  // the swing meter: cream good zone, gold centre, red cursor
  const M = chopMeter(x, y);
  blend(s, M.y, M.y + M.h, M.x, M.x + M.w, DIM);
  const zx = (u: number) => Math.round(M.x + u * M.w);
  blend(s, M.y + 1, M.y + M.h - 1, zx(g.spot - B.good), zx(g.spot + B.good), C.CREAM);
  blend(s, M.y + 1, M.y + M.h - 1, zx(g.spot - B.great), zx(g.spot + B.great), C.GOLD);
  outline(s, M, C.INK);
  const cx = zx(g.cursor);
  blend(s, M.y - 3, M.y + M.h + 3, cx - 1, cx + 1, C.HP);
  footer(s, x, y, 'chop', [
    ['SPACE', 'SWING'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ load / stack
export const LOAD_CELL = 14;

/** The truck bed on screen (column 0 at the left, row 0 at the floor). */
export function loadBed(x: number, y: number, g: LoadGame): Box {
  return { x: x + 10, y: y + 68, w: g.cols * LOAD_CELL, h: g.rows * LOAD_CELL };
}

/** One piece: a crate (planks and a cross brace) or a log (bark with a cut end). */
function pieceArt(
  s: Surface,
  px0: number,
  py0: number,
  p: Piece,
  cell: number,
  logs: boolean,
  ghost = false,
): void {
  const w = p.w * cell;
  const h = p.h * cell;
  if (ghost) {
    outline(s, { x: px0, y: py0, w, h }, C.CREAM);
    return;
  }
  if (logs) {
    blend(s, py0 + 1, py0 + h - 1, px0, px0 + w, BARK);
    blend(s, py0 + 1, py0 + 3, px0, px0 + w, BARK_LO);
    blend(s, py0 + h - 3, py0 + h - 1, px0, px0 + w, BARK_LO);
    const r = Math.max(1, Math.floor(h / 2) - 1);
    disc(s, px0 + r + 1, py0 + Math.floor(h / 2), r, WOOD);
    if (r > 2) disc(s, px0 + r + 1, py0 + Math.floor(h / 2), Math.floor(r / 2), WOOD_LO);
    return;
  }
  blend(s, py0, py0 + h, px0, px0 + w, C.KHAKI4);
  outline(s, { x: px0, y: py0, w, h }, WOOD_LO);
  for (let k = 1; k < p.h * 2; k++)
    blend(
      s,
      py0 + Math.round((k * h) / (p.h * 2)),
      py0 + Math.round((k * h) / (p.h * 2)) + 1,
      px0 + 1,
      px0 + w - 1,
      WOOD_LO,
    );
  if (cell >= 8)
    for (let t = 2; t < Math.min(w, h) * 4 - 2; t++) {
      const u = t / (Math.min(w, h) * 4);
      px(s, px0 + Math.round(u * w), py0 + Math.round(u * h), WOOD_LO);
    }
}

export function drawLoad(s: Surface, x: number, y: number, g: LoadGame, task: string): void {
  const logs = g.mode === 'logs';
  jobFrame(s, x, y, 'load', logs ? 'LOAD LOGS' : 'LOAD VAN', task);
  if (g.done && g.grade)
    return jobResult(s, x, y, 'load', g.grade, `LOADED ${g.loadedCells} OF ${g.totalCells}`);
  const B = loadBed(x, y, g);
  // the bed: dark inside, a headboard and cab on the right, the tailgate on the left, wheels underneath
  blend(s, y + 30, B.y + B.h + 12, x + 8, B.x + B.w + 20, C.INK, 0.7);
  blend(s, B.y, B.y + B.h, B.x, B.x + B.w, C.PLATE_HI, 0.6);
  for (let c = 1; c < g.cols; c++)
    blend(s, B.y, B.y + B.h, B.x + c * LOAD_CELL, B.x + c * LOAD_CELL + 1, C.PLATE, 0.5);
  blend(s, B.y + B.h, B.y + B.h + 3, B.x - 2, B.x + B.w + 16, RIM_LO); // the floor
  blend(s, B.y - 2, B.y + B.h, B.x + B.w, B.x + B.w + 3, RIM_LO); // the headboard
  blend(s, B.y + 12, B.y + B.h, B.x + B.w + 3, B.x + B.w + 16, logs ? C.HP_LO : NAVY); // the cab
  blend(s, B.y + 16, B.y + 26, B.x + B.w + 6, B.x + B.w + 14, C.GLASS4);
  blend(s, B.y + B.h - 22, B.y + B.h, B.x - 2, B.x, RIM_LO); // the tailgate
  for (const wx of [B.x + 24, B.x + B.w - 10]) {
    disc(s, wx, B.y + B.h + 6, 5, TYRE);
    disc(s, wx, B.y + B.h + 6, 2, RIM);
  }
  // the roof line: nothing may stick out over it
  for (let k = B.x; k < B.x + B.w; k += 4) px(s, k, B.y - 1, C.DIRTY);
  const row = (r: number, h: number) => B.y + B.h - (r + h) * LOAD_CELL;
  for (const p of g.placed) pieceArt(s, B.x + p.x * LOAD_CELL, row(p.y, p.h), p, LOAD_CELL, logs);
  const cur = g.current;
  if (cur) {
    const land = g.landing(cur, g.x);
    if (land !== null) pieceArt(s, B.x + g.x * LOAD_CELL, row(land, cur.h), cur, LOAD_CELL, logs, true);
    // the piece waiting above the bed
    pieceArt(s, B.x + g.x * LOAD_CELL, B.y - 4 - cur.h * LOAD_CELL, cur, LOAD_CELL, logs);
    if (land === null)
      blend(s, B.y - 3, B.y - 2, B.x + g.x * LOAD_CELL, B.x + (g.x + cur.w) * LOAD_CELL, C.RED3);
  }
  // the queue, small
  const rx = x + 170;
  text(s, rx, y + 32, 'NEXT', C.MUTED);
  let qy = y + 44;
  for (const p of g.upcoming.slice(0, 3)) {
    pieceArt(s, rx, qy, p, 6, logs);
    qy += p.h * 6 + 4;
  }
  text(s, rx, y + 92, `ON ${g.loadedCells}/${g.totalCells}`, C.CREAM);
  text(s, rx, y + 104, `LEFT ${g.leftBehind.length}`, g.leftBehind.length ? C.RED3 : C.MUTED);
  if (g.last && g.last.t < 0.5 && !g.last.ok) stampWord(s, rx + 3, y + 120, 'NO ROOM', false);
  timeBar(s, x + 8, y + 143, JOB_PANEL_SIZE.load.w - 16, g.timeLeft / g.timeTotal);
  footer(s, x, y, 'load', [
    ['A/D', 'MOVE'],
    logs ? ['SPACE', 'DROP'] : ['W', 'TURN'],
    ...(logs ? [] : ([['SPACE', 'DROP']] as [string, string][])),
  ]);
}

// ------------------------------------------------------------------ route
const ROUTE_BLOCK = 15;

/** The street map on screen. */
export function routeMap(x: number, y: number): Box {
  const R = BALANCE_JOBS.route;
  return { x: x + 12, y: y + 34, w: R.gridW * ROUTE_BLOCK, h: R.gridH * ROUTE_BLOCK };
}

export function routeOption(x: number, y: number, k: number): Box {
  return { x: x + 140, y: y + 32 + k * 24, w: 100, h: 20 };
}

export function drawRoute(s: Surface, x: number, y: number, g: RouteGame, task: string): void {
  const R = BALANCE_JOBS.route;
  jobFrame(s, x, y, 'route', 'ROUTE', task);
  if (g.done && g.grade)
    return jobResult(s, x, y, 'route', g.grade, `${g.right} OF ${g.rounds.length} SHORTEST`);
  const round = g.current;
  if (!round) return;
  const M = routeMap(x, y);
  // blocks of houses between the streets
  blend(s, M.y - 4, M.y + M.h + 4, M.x - 4, M.x + M.w + 4, C.INK, 0.8);
  for (let j = 0; j < R.gridH; j++)
    for (let i = 0; i < R.gridW; i++) {
      const bx = M.x + i * ROUTE_BLOCK + 2;
      const by = M.y + j * ROUTE_BLOCK + 2;
      blend(s, by, by + ROUTE_BLOCK - 3, bx, bx + ROUTE_BLOCK - 3, (i + j) % 3 ? C.PLATE_HI : DIM);
    }
  // the routes, each nudged a pixel so shared streets show every colour
  round.routes.forEach((r, k) => {
    const col = ROUTE_RGB[k] as RGB;
    const off = k - 1;
    for (let p = 1; p < r.points.length; p++) {
      const a = r.points[p - 1]!;
      const b = r.points[p]!;
      const ax = M.x + a.x * ROUTE_BLOCK + off;
      const ay = M.y + a.y * ROUTE_BLOCK + off;
      const bx = M.x + b.x * ROUTE_BLOCK + off;
      const by = M.y + b.y * ROUTE_BLOCK + off;
      blend(s, Math.min(ay, by), Math.max(ay, by) + 2, Math.min(ax, bx), Math.max(ax, bx) + 2, col);
    }
  });
  // the depot (left) and the drop (right)
  const first = round.routes[0]!.points;
  const a = first[0]!;
  const b = first[first.length - 1]!;
  blend(s, M.y + a.y * ROUTE_BLOCK - 4, M.y + a.y * ROUTE_BLOCK + 5, M.x - 4, M.x + 5, C.CREAM);
  const dx = M.x + b.x * ROUTE_BLOCK;
  const dy = M.y + b.y * ROUTE_BLOCK;
  for (let j = -4; j <= 4; j++)
    blend(s, dy + j, dy + j + 1, dx - (4 - Math.abs(j)), dx + 5 - Math.abs(j), C.GOLD);
  round.routes.forEach((_, k) => {
    const o = routeOption(x, y, k);
    const picked = g.last && g.last.t < 0.5 && g.last.route === k;
    plate(s, o.x, o.y, o.w, o.h, C.LAVLT2, 0.9);
    keycap(s, o.x + 5, o.y + 4, String(k + 1));
    blend(s, o.y + 8, o.y + 12, o.x + 22, o.x + 44, ROUTE_RGB[k] as RGB);
    text(
      s,
      o.x + 50,
      o.y + 6,
      picked ? (g.last!.ok ? 'RIGHT' : 'WRONG') : 'ROUTE',
      picked ? (g.last!.ok ? C.SAGE4 : C.RED3) : C.MUTED,
    );
  });
  text(s, x + 140, y + 108, `DROP ${g.round + 1}/${g.rounds.length}`, C.CREAM);
  text(s, x + 140, y + 120, `SHORTEST ${g.right}`, C.MUTED);
  timeBar(s, x + 8, y + 143, JOB_PANEL_SIZE.route.w - 16, 1 - g.t / g.seconds);
  footer(s, x, y, 'route', [
    ['1-3', 'PICK THE SHORTEST'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ stamp and sign
const PAPER_PX = 70;

export function drawStampSign(s: Surface, x: number, y: number, g: StampSignGame, task: string): void {
  const W = JOB_PANEL_SIZE.stampSign.w;
  const S = BALANCE_JOBS.stamp;
  jobFrame(s, x, y, 'stampSign', 'STAMP & SIGN', task);
  if (g.done && g.grade) return jobResult(s, x, y, 'stampSign', g.grade, 'PAPERWORK DONE');
  // the desk
  const dx0 = x + 8;
  const dx1 = x + W - 8;
  const dy = y + 56;
  blend(s, y + 30, y + 120, dx0, dx1, C.INK, 0.7);
  blend(s, dy - 4, dy + 60, dx0, dx1, WOOD_LO);
  blend(s, dy - 4, dy - 2, dx0, dx1, WOOD);
  const head = x + Math.round(W / 2);
  const toX = (pos: number) => head + Math.round(pos * PAPER_PX);
  // clipped drawing so papers slide in and out of the desk's edges
  const clip = (y0: number, y1: number, x0: number, x1: number, col: RGB) =>
    blend(s, y0, y1, Math.max(dx0, x0), Math.min(dx1, x1), col);
  for (let d = 0; d < g.docs; d++) {
    const lead = toX(g.docPos - d * S.pitch);
    const left = lead - Math.round(PAPER_PX * 0.86);
    if (lead < dx0 || left > dx1) continue;
    clip(dy + 2, dy + 54, left + 1, lead + 1, C.INK);
    clip(dy, dy + 52, left, lead, C.CREAM);
    for (let k = 0; k < 5; k++) clip(dy + 6 + k * 5, dy + 7 + k * 5, left + 6, lead - 30, C.MUTED);
  }
  for (const m of g.marks) {
    const mx = toX(m.pos);
    if (mx < dx0 + 8 || mx > dx1 - 8) continue;
    if (m.kind === 'stamp') {
      const r = { x: mx - 8, y: dy + 6, w: 16, h: 16 };
      outline(s, r, m.result === null ? C.MUTED : m.result === 'miss' ? C.RED3 : C.HP);
      if (m.result === 'great' || m.result === 'good') {
        blend(s, r.y + 3, r.y + 13, r.x + 3, r.x + 13, C.HP);
        blend(s, r.y + 6, r.y + 10, r.x + 6, r.x + 10, C.CREAM);
      } else if (m.result === 'miss') blend(s, r.y + 2, r.y + 14, r.x + 9, r.x + 16, C.DIRTY);
    } else {
      blend(s, dy + 42, dy + 43, mx - 12, mx + 12, C.PLATE);
      if (m.result === 'great' || m.result === 'good')
        for (let k = 0; k < 22; k++)
          px(s, mx - 11 + k, dy + 40 - Math.round(Math.abs(Math.sin(k * 0.7)) * 4), NAVY_LO);
      else if (m.result === 'miss') blend(s, dy + 36, dy + 40, mx - 10, mx + 4, C.DIRTY);
    }
  }
  // the stamp and the pen over the mark line
  blend(s, y + 30, y + 46, head - 6, head + 6, C.HP_LO);
  blend(s, y + 44, y + 50, head - 9, head + 9, C.HP);
  blend(s, y + 50, dy + 58, head, head + 1, C.GOLD_HI, 0.5);
  const nx = g.next;
  text(s, x + 8, y + 126, nx ? (nx.kind === 'stamp' ? 'NEXT STAMP' : 'NEXT SIGN') : '', C.MUTED);
  text(s, x + 96, y + 126, `PAPER ${Math.min(g.docs, (nx?.doc ?? g.docs - 1) + 1)}/${g.docs}`, C.CREAM);
  if (g.last && g.last.t < 0.5) {
    const w = g.last.result === 'great' ? 'NEAT' : g.last.result === 'good' ? 'OK' : 'SMUDGED';
    stampWord(s, x + 178, y + 126, w, g.last.result !== 'miss');
  } else text(s, x + 178, y + 126, `MISS ${g.count('miss')}`, g.count('miss') ? C.RED3 : C.MUTED);
  footer(s, x, y, 'stampSign', [
    ['SPACE', 'STAMP / SIGN'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ meeting
const BOSS_FACE = [
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hssssssh.',
  '.ssssssss.',
  '.sgg..ggs.',
  '.sggssggs.',
  '.ssssssss.',
  '.ssssssss.',
  '.ssmmmmss.',
  '..ssssss..',
  '...ssss...',
  '.tttwwttt.',
];
const MOUTH: Record<'happy' | 'flat' | 'cross', readonly string[]> = {
  happy: ['.sm....ms.', '.ssmmmmss.'],
  flat: ['.ssssssss.', '.ssmmmmss.'],
  cross: ['.ssmmmmss.', '.sm....ms.'],
};

export function meetingReply(x: number, y: number, k: number): Box {
  return { x: x + 8, y: y + 84 + k * 20, w: JOB_PANEL_SIZE.meeting.w - 16, h: 18 };
}

/** Widest reply that fits its row. */
export const MEETING_REPLY_W = JOB_PANEL_SIZE.meeting.w - 16 - 26;

export function drawMeeting(s: Surface, x: number, y: number, g: MeetingGame, task: string): void {
  const W = JOB_PANEL_SIZE.meeting.w;
  const M = BALANCE_JOBS.meeting;
  jobFrame(s, x, y, 'meeting', 'MEETING', task);
  if (g.done && g.grade)
    return jobResult(
      s,
      x,
      y,
      'meeting',
      g.grade,
      g.mood >= M.moodFor.good ? 'THE BOSS IS PLEASED' : 'THE BOSS SIGHS',
    );
  const r = g.current;
  if (!r) return;
  const face = g.mood >= M.moodFor.good ? 'happy' : g.mood >= M.moodFor.ok ? 'flat' : 'cross';
  const rows = [...BOSS_FACE.slice(0, 8), ...MOUTH[face], ...BOSS_FACE.slice(10)];
  blend(s, y + 30, y + 58, x + 8, x + 34, C.INK, 0.8);
  spriteScaled(
    s,
    x + 11,
    y + 32,
    rows.slice(0, 12),
    { h: [80, 63, 88], s: SKIN, g: C.INK, m: C.HP_LO, t: NAVY_LO, w: C.CREAM },
    2,
  );
  text(s, x + 40, y + 32, MEETING_BOSS, C.CREAM);
  // the boss's reaction to the last answer, briefly, then the question
  const showing = g.last && g.last.t < 1.2 ? g.last : null;
  const said = showing ? showing.reaction : r.question.boss;
  wrapPx(said, W - 48)
    .slice(0, 2)
    .forEach((line, k) => text(s, x + 40, y + 44 + k * (LINE + 3), line, showing ? C.MUTED : C.CREAM));
  text(s, x + 8, y + 68, 'MOOD', C.MUTED);
  bar(s, x + 44, y + 68, W - 52, 7, g.mood / 100, g.mood >= M.moodFor.ok ? C.SAGE4 : C.RED3, C.SAGE1);
  r.replies.forEach((rep, k) => {
    const o = meetingReply(x, y, k);
    plate(s, o.x, o.y, o.w, o.h, C.LAVLT2, 0.9);
    keycap(s, o.x + 4, o.y + 3, String(k + 1));
    text(s, o.x + 20, o.y + 5, rep.text, C.CREAM);
  });
  blend(s, y + 146, y + 149, x + 8, x + 8 + Math.round((W - 16) * (g.timeLeft / g.timeTotal)), C.GOLD_LO);
  footer(s, x, y, 'meeting', [
    ['1-3', 'ANSWER'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ fell direction
const LEAF: RGB = [50, 64, 56];
const LEAF_HI: RGB = [98, 116, 98];

/** An arrow along direction (dx, dy) from (x0, y0), `len` long, with a small head. */
function arrowLine(s: Surface, x0: number, y0: number, dx: number, dy: number, len: number, col: RGB): void {
  for (let t = 0; t <= len; t += 0.5) {
    const ax = Math.round(x0 + dx * t);
    const ay = Math.round(y0 + dy * t);
    px(s, ax, ay, col);
    px(s, ax + 1, ay, col);
    px(s, ax, ay + 1, col);
  }
  const hx = x0 + dx * len;
  const hy = y0 + dy * len;
  for (const side of [-1, 1])
    for (let t = 0; t <= 4; t += 0.5)
      px(s, Math.round(hx - dx * t + -dy * side * t), Math.round(hy - dy * t + dx * side * t), col);
}

export function drawFell(s: Surface, x: number, y: number, g: FellGame, task: string): void {
  const F = BALANCE_JOBS.fell;
  jobFrame(s, x, y, 'fell', 'FELL', task);
  if (g.done && g.grade) return jobResult(s, x, y, 'fell', g.grade, 'TREES DOWN');
  const tr = g.tree;
  if (!tr) return;
  // the clearing seen from above: grass, the clear lane, and what must not be hit all around it
  const cx = x + 66;
  const cy = y + 90;
  const R = 54;
  const dir = (deg: number) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)] as const;
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      if (i * i + j * j > R * R) continue;
      const ang = ((Math.atan2(i, -j) * 180) / Math.PI + 360) % 360;
      const inLane = Math.abs(((ang - tr.lane + 540) % 360) - 180) <= F.lane;
      px(
        s,
        cx + i,
        cy + j,
        inLane ? (i * i + j * j > 100 ? WOOD_LO : C.SAGE1) : (i * 7 + j * 13) % 23 ? C.SAGE1 : LEAF_HI,
      );
    }
  // the lane's centre line, and the trees, the truck and the cabin round the rest of the clearing
  const [lx, ly] = dir(tr.lane);
  for (let t = 12; t < R - 2; t += 3) px(s, Math.round(cx + lx * t), Math.round(cy + ly * t), WOOD);
  for (let k = 0; k < 14; k++) {
    const a = tr.lane + F.lane + 10 + k * ((360 - 2 * F.lane - 20) / 13);
    const [ox, oy] = dir(a);
    const ox0 = Math.round(cx + ox * (R - 9));
    const oy0 = Math.round(cy + oy * (R - 9));
    if (k === 4) {
      blend(s, oy0 - 5, oy0 + 6, ox0 - 7, ox0 + 8, C.HP_LO); // the log truck
      blend(s, oy0 - 3, oy0 + 1, ox0 + 2, ox0 + 6, C.GLASS4);
    } else if (k === 9) {
      blend(s, oy0 - 6, oy0 + 7, ox0 - 6, ox0 + 7, WOOD_LO); // the site cabin
      blend(s, oy0 - 6, oy0 - 3, ox0 - 7, ox0 + 8, BARK_LO);
    } else {
      disc(s, ox0, oy0, 5, LEAF);
      disc(s, ox0 - 1, oy0 - 1, 2, LEAF_HI);
    }
  }
  // the tree: a stump with its crown, the lean and the wind as arrows across the lane's end
  const [tx, ty] = dir(tr.lane + 90);
  const ex = cx + lx * (R - 16);
  const ey = cy + ly * (R - 16);
  arrowLine(
    s,
    Math.round(ex),
    Math.round(ey),
    tx * Math.sign(tr.lean),
    ty * Math.sign(tr.lean),
    Math.abs(tr.lean) * 2,
    BARK,
  );
  if (Math.abs(tr.wind) >= 1)
    arrowLine(
      s,
      Math.round(ex - lx * 8),
      Math.round(ey - ly * 8),
      tx * Math.sign(tr.wind),
      ty * Math.sign(tr.wind),
      Math.abs(tr.wind) * 2,
      C.GLASS4,
    );
  // the aim: where the cut points
  const [ax, ay] = dir(g.aim);
  for (let t = 8; t <= R; t += 0.5) {
    px(s, Math.round(cx + ax * t), Math.round(cy + ay * t), C.HP);
    px(s, Math.round(cx + ax * t) + 1, Math.round(cy + ay * t), C.HP);
  }
  disc(s, cx, cy, 7, BARK);
  disc(s, cx, cy, 4, WOOD);
  const rx = x + 132;
  text(s, rx, y + 32, `TREE ${g.round + 1}/${g.trees.length}`, C.CREAM);
  if (g.last && g.last.t < 0.6) {
    const w = { great: 'CLEAN', good: 'CLOSE', ok: 'JUST IN', miss: 'HIT IT' }[g.last.result];
    stampWord(s, rx + 3, y + 50, w, g.last.result !== 'miss');
  } else text(s, rx, y + 50, 'FELL IT DOWN', C.MUTED);
  text(s, rx, y + 62, 'THE LANE', C.MUTED);
  blend(s, y + 78, y + 81, rx, rx + 12, BARK);
  text(s, rx + 18, y + 76, 'LEAN', C.MUTED);
  blend(s, y + 92, y + 95, rx, rx + 12, C.GLASS4);
  text(s, rx + 18, y + 90, 'WIND', C.MUTED);
  blend(s, y + 106, y + 109, rx, rx + 12, C.HP);
  text(s, rx + 18, y + 104, 'YOUR AIM', C.MUTED);
  text(s, rx, y + 120, 'AIM AGAINST THEM', C.MUTED);
  timeBar(s, x + 8, y + 150 - 7, JOB_PANEL_SIZE.fell.w - 16, 1 - g.t / F.seconds);
  footer(s, x, y, 'fell', [
    ['SPACE', 'CUT'],
    ['ESC', 'QUIT'],
  ]);
}

// ------------------------------------------------------------------ doorstep
const HOUSE_W = 28;
const WALLS: readonly RGB[] = [
  [185, 180, 140],
  [157, 176, 201],
  [201, 172, 132],
  [147, 163, 135],
  [222, 214, 200],
  [187, 147, 129],
];

export function doorstepHouse(x: number, y: number, k: number): Box {
  return { x: x + 12 + k * HOUSE_W, y: y + 36, w: HOUSE_W, h: 66 };
}

export function drawDoorstep(s: Surface, x: number, y: number, g: DoorstepGame, task: string): void {
  jobFrame(s, x, y, 'doorstep', 'DOORSTEP', task);
  if (g.done && g.grade) return jobResult(s, x, y, 'doorstep', g.grade, 'PARCELS DELIVERED');
  const label = g.label;
  // the street strip: a row of narrow houses, each with a roof, a window, a door and its number above it
  blend(s, y + 30, y + 110, x + 8, x + JOB_PANEL_SIZE.doorstep.w - 8, C.INK, 0.7);
  g.numbers.forEach((n, k) => {
    const h = doorstepHouse(x, y, k);
    const wall = WALLS[(n * 7) % WALLS.length] as RGB;
    const top = h.y + 12 + ((n * 3) % 3) * 2;
    for (let j = 0; j < 8; j++) blend(s, top - 8 + j, top - 7 + j, h.x + 7 - j, h.x + h.w - 7 + j, BARK_LO); // roof
    blend(s, top, h.y + h.h - 6, h.x + 1, h.x + h.w - 1, wall);
    blend(s, top + 4, top + 11, h.x + 5, h.x + 12, C.GLASS4);
    blend(s, h.y + h.h - 24, h.y + h.h - 6, h.x + 15, h.x + 23, k === g.at ? C.CREAM : NAVY_LO); // the door
    const ns = String(n);
    blend(s, h.y + h.h - 36, h.y + h.h - 27, h.x + 2, h.x + h.w - 2, C.PLATE);
    text(s, h.x + Math.round((h.w - textWidthPx(ns)) / 2), h.y + h.h - 35, ns, C.CREAM);
  });
  blend(s, y + 102, y + 110, x + 8, x + JOB_PANEL_SIZE.doorstep.w - 8, C.PLATE_HI); // the pavement
  // the courier, in uniform, at the door
  const c = doorstepHouse(x, y, g.at);
  const fx = c.x + c.w / 2 - 3;
  blend(s, y + 92, y + 96, fx + 1, fx + 6, SKIN);
  blend(s, y + 96, y + 103, fx, fx + 7, NAVY);
  blend(s, y + 98, y + 102, fx + 5, fx + 10, C.KHAKI4); // the parcel
  if (g.last && g.last.t < 0.3) blend(s, y + 31, y + 33, c.x, c.x + c.w, g.last.ok ? C.SAGE4 : C.RED3);
  // the parcel's label
  icon(s, x + 8, y + 112, 'job/delivery');
  if (label !== null) {
    text(s, x + 46, y + 114, 'DELIVER TO', C.MUTED);
    text(s, x + 46, y + 124, `NO. ${label}`, C.CREAM, C.INK, 2);
  }
  const rx = x + 150;
  text(s, rx, y + 114, `PARCEL ${Math.min(g.parcel + 1, g.parcels.length)}/${g.parcels.length}`, C.CREAM);
  if (g.last && g.last.t < 0.6 && !g.last.ok) stampWord(s, rx + 3, y + 129, 'WRONG DOOR', false);
  else text(s, rx, y + 128, `WRONG ${g.errors}`, g.errors ? C.RED3 : C.MUTED);
  bar(s, x + 8, y + 148, JOB_PANEL_SIZE.doorstep.w - 16, 5, g.timeLeft / g.timeTotal, C.GOLD, C.GOLD_LO);
  footer(s, x, y, 'doorstep', [
    ['A/D', 'WALK'],
    ['SPACE', 'HAND OVER'],
    ['CLICK', 'GO TO'],
  ]);
}

// ------------------------------------------------------------------ signature
/** The signature pad on screen: map the mouse to pad units (0–1 across) with it. */
export function signaturePad(x: number, y: number, g: SignatureGame): Box {
  const w = JOB_PANEL_SIZE.signature.w - 28;
  return { x: x + 14, y: y + 36, w, h: Math.round(w * g.aspect) };
}

export function drawSignature(s: Surface, x: number, y: number, g: SignatureGame, task: string): void {
  jobFrame(s, x, y, 'signature', 'SIGNATURE', task);
  if (g.done && g.grade) return jobResult(s, x, y, 'signature', g.grade, 'SIGNED FOR');
  const P = signaturePad(x, y, g);
  // the courier's handheld: a dark body round a pale screen
  blend(s, P.y - 6, P.y + P.h + 6, P.x - 6, P.x + P.w + 6, C.PLATE_HI);
  blend(s, P.y, P.y + P.h, P.x, P.x + P.w, C.STONE5);
  blend(s, P.y + P.h - 12, P.y + P.h - 11, P.x + 8, P.x + P.w - 8, C.MUTED); // the sign-here line
  const toPx = (q: { x: number; y: number }) =>
    [Math.round(P.x + q.x * P.w), Math.round(P.y + q.y * P.w)] as const;
  // the customer's line, faint where it is still to trace, sage where the pen has covered it
  for (let k = 1; k < g.line.length; k++) {
    const [ax, ay] = toPx(g.line[k - 1]!);
    const [bx, by] = toPx(g.line[k]!);
    const col = g.covered[k] && g.covered[k - 1] ? C.SAGE4 : C.MUTED;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let t = 0; t <= n; t++)
      px(s, Math.round(ax + ((bx - ax) * t) / n), Math.round(ay + ((by - ay) * t) / n), col);
  }
  // the pen's strokes
  for (const st of g.strokes)
    for (let k = 1; k < st.length; k++) {
      const [ax, ay] = toPx(st[k - 1]!);
      const [bx, by] = toPx(st[k]!);
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
      for (let t = 0; t <= n; t++) {
        const qx = Math.round(ax + ((bx - ax) * t) / n);
        const qy = Math.round(ay + ((by - ay) * t) / n);
        px(s, qx, qy, NAVY_LO);
        px(s, qx, qy + 1, NAVY_LO);
      }
    }
  text(s, x + 8, y + 128, `COVERED ${Math.round(g.coverage * 100)}%`, C.CREAM);
  text(
    s,
    x + 120,
    y + 128,
    `ON THE LINE ${Math.round(g.accuracy * 100)}%`,
    g.samples && g.accuracy < 0.7 ? C.RED3 : C.MUTED,
  );
  timeBar(s, x + 8, y + 143, JOB_PANEL_SIZE.signature.w - 16, g.timeLeft / g.timeTotal);
  footer(s, x, y, 'signature', [
    ['DRAG', 'TRACE IT'],
    ['RELEASE', 'DONE'],
    ['ESC', 'QUIT'],
  ]);
}
