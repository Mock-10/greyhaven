// HUD drawing primitives, ported from art/source/hud.py (docs/11: "the shapes, colours and sizes in it are
// the spec"). They draw into an RGBA pixel buffer at 1 UI pixel per pixel; the HUD scene shows that
// buffer scaled by a whole number. Pure code (no Phaser), so it can be unit tested.

import { textBits } from './pixelFont';

export type RGB = readonly [number, number, number];

export interface Surface {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

// palette roles (hud.py), all from art/palette.json
export const C = {
  PLATE: [45, 34, 46] as RGB,
  PLATE_HI: [62, 48, 66] as RGB,
  EDGE: [185, 143, 58] as RGB,
  GOLD: [239, 212, 134] as RGB,
  GOLD_HI: [251, 234, 184] as RGB,
  GOLD_LO: [185, 143, 58] as RGB,
  CREAM: [238, 233, 232] as RGB,
  MUTED: [168, 160, 170] as RGB,
  DIRTY: [208, 132, 120] as RGB,
  HP: [185, 94, 94] as RGB,
  HP_LO: [111, 53, 69] as RGB,
  ARM: [152, 158, 161] as RGB,
  ARM_LO: [81, 86, 112] as RGB,
  INK: [36, 27, 40] as RGB,
  POLICE_R: [208, 132, 120] as RGB,
  POLICE_B: [129, 149, 192] as RGB,
  LAVLT2: [125, 118, 136] as RGB,
  STONE5: [222, 214, 200] as RGB,
  KHAKI4: [185, 180, 140] as RGB,
  RED3: [185, 94, 94] as RGB,
  SAGE1: [76, 93, 82] as RGB,
  SAGE4: [147, 163, 135] as RGB,
  GLASS4: [157, 176, 201] as RGB,
  CLEAN_LABEL: [120, 112, 120] as RGB,
  DIRTY_LABEL: [120, 86, 98] as RGB,
} as const;

export function createSurface(width: number, height: number): Surface {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function clear(s: Surface): void {
  s.data.fill(0);
}

/**
 * Blend a colour over a rect (hud.py blend). This is the "over" operator on a transparent overlay, so a
 * 90% plate drawn here and then shown over the world looks the same as hud.py blending it onto the world.
 */
export function blend(s: Surface, y0: number, y1: number, x0: number, x1: number, col: RGB, a = 1): void {
  y0 = Math.max(0, y0);
  x0 = Math.max(0, x0);
  y1 = Math.min(s.height, y1);
  x1 = Math.min(s.width, x1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (y * s.width + x) * 4;
      const da = (s.data[k + 3] as number) / 255;
      const oa = a + da * (1 - a);
      for (let c = 0; c < 3; c++) {
        s.data[k + c] =
          oa > 0 ? Math.round(((col[c] as number) * a + (s.data[k + c] as number) * da * (1 - a)) / oa) : 0;
      }
      s.data[k + 3] = Math.round(oa * 255);
    }
  }
}

export function px(s: Surface, x: number, y: number, col: RGB): void {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return;
  const k = (y * s.width + x) * 4;
  s.data[k] = col[0];
  s.data[k + 1] = col[1];
  s.data[k + 2] = col[2];
  s.data[k + 3] = 255;
}

/** Rounded dark plate with a 1 px edge (hud.py plate). */
export function plate(
  s: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  edge: RGB = C.EDGE,
  alpha = 0.9,
): void {
  blend(s, y + 1, y + h - 1, x, x + w, C.PLATE, alpha);
  blend(s, y, y + h, x + 1, x + w - 1, C.PLATE, alpha);
  blend(s, y, y + 1, x + 1, x + w - 1, edge);
  blend(s, y + h - 1, y + h, x + 1, x + w - 1, edge);
  blend(s, y + 1, y + h - 1, x, x + 1, edge);
  blend(s, y + 1, y + h - 1, x + w - 1, x + w, edge);
}

export function bar(
  s: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  col: RGB,
  colLo: RGB,
  segs = 0,
): void {
  blend(s, y, y + h, x, x + w, C.INK);
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
  blend(s, y + 1, y + h - 1, x + 1, x + 1 + fw, col);
  blend(s, y + 1, y + 2, x + 1, x + 1 + fw, [
    Math.min(255, col[0] + 30),
    Math.min(255, col[1] + 30),
    Math.min(255, col[2] + 30),
  ]);
  blend(s, y + h - 2, y + h - 1, x + 1, x + 1 + fw, colLo);
  for (let k = 1; k < segs; k++) {
    const sx = x + 1 + Math.floor(((w - 2) * k) / segs);
    blend(s, y + 1, y + h - 1, sx, sx + 1, C.INK, 0.6);
  }
}

export function sprite(
  s: Surface,
  x: number,
  y: number,
  rows: readonly string[],
  pal: Record<string, RGB | null>,
): void {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = pal[ch];
      if (ch !== '.' && c) px(s, x + i, y + j, c);
    });
  });
}

/** Pixel-font text (hud.py draw_text), with an optional 1 px drop shadow; returns the width. */
export function text(
  s: Surface,
  x: number,
  y: number,
  str: string,
  col: RGB,
  shadow?: RGB,
  scale = 1,
): number {
  const bits = textBits(str);
  const w = (bits[0] as boolean[]).length;
  const put = (dx: number, dy: number, c: RGB) => {
    bits.forEach((row, j) =>
      row.forEach((on, i) => {
        if (!on) return;
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++) px(s, x + i * scale + sx + dx, y + j * scale + sy + dy, c);
      }),
    );
  };
  if (shadow) put(0, 1, shadow);
  put(0, 0, col);
  return w * scale;
}

export function textWidthPx(str: string, scale = 1): number {
  return (textBits(str)[0] as boolean[]).length * scale;
}

// ------------------------------------------------------------------ icons (hud.py)
const STAR = [
  '....#....',
  '...#o#...',
  '...#o#...',
  '#########',
  '.#ooooo#.',
  '..#ooo#..',
  '.#oo#oo#.',
  '.#o#.#o#.',
  '.##...##.',
];
export const STAR_FILL = STAR.map((r) => r.replace(/o/g, 'g').replace(/#/g, 'G'));
export const STAR_EMPTY = STAR.map((r) => r.replace(/o/g, 'd').replace(/#/g, 'e'));
export const STAR_FLASH = STAR.map((r) => r.replace(/o/g, 'w').replace(/#/g, 'G'));
export const STAR_PAL: Record<string, RGB> = {
  g: C.GOLD,
  G: C.GOLD_LO,
  d: C.PLATE_HI,
  e: [92, 79, 98],
  w: C.GOLD_HI,
};
export const ICON_CLEAN = [
  '#########',
  '#ccccccc#',
  '#c.ccc.c#',
  '#cc$$$cc#',
  '#c.ccc.c#',
  '#ccccccc#',
  '#########',
];
export const ICON_DIRTY = [
  '#########',
  '#rrrrrrr#',
  '#r.rrr.r#',
  '#rr$$$rr#',
  '#r.rrr.r#',
  '#rrrrrrr#',
  '#########',
];
export const ICON_PAL: Record<string, RGB | null> = {
  '#': C.INK,
  c: C.KHAKI4,
  r: C.RED3,
  $: C.SAGE1,
  '.': null,
};
export const MOON = ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'];
export const SUN = ['#..#..#', '.#####.', '.#ooo#.', '##ooo##', '.#ooo#.', '.#####.', '#..#..#'];
export const PHONE = ['#####', '#ccc#', '#ccc#', '#ccc#', '#ccc#', '#####', '##.##'];
export const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
export const SHIELD = ['#####', '#####', '#####', '.###.', '..#..'];
export const HOME = ['...#...', '..#c#..', '.#ccc#.', '#ccccc#', '.#c#c#.', '.#c#c#.', '.#####.'];
export const SHOP = ['#####', '#ggg#', '#g#g#', '#ggg#', '#####'];
export const ARROW = ['...#...', '..#w#..', '.#www#.', '#wwwww#', '...w...', '...w...', '.......'];

// ------------------------------------------------------------------ HUD panels (hud.py)
export function topLeft(
  s: Surface,
  x: number,
  y: number,
  o: { ammo: string; label: string; hp: number; armor: number },
): void {
  plate(s, x, y, 112, 36);
  const [clip, reserve] = o.ammo.split('/') as [string, string];
  const cw = text(s, x + 34, y + 7, clip, C.CREAM, C.INK, 2);
  text(s, x + 26 + 12 + cw + 1, y + 12, `/${reserve}`, C.MUTED);
  text(s, x + 108 - textWidthPx(o.label), y + 7, o.label, C.MUTED);
  sprite(s, x + 5, y + 21, HEART, { '#': C.HP });
  bar(s, x + 13, y + 21, 94, 5, o.hp, C.HP, C.HP_LO);
  sprite(s, x + 5, y + 28, SHIELD, { '#': C.ARM });
  bar(s, x + 13, y + 28, 94, 4, o.armor, C.ARM, C.ARM_LO, 2);
}

export function stars(s: Surface, cx: number, y: number, n: number, flash = false): void {
  const w = 5 * 11 + 6;
  plate(s, cx - Math.floor(w / 2) - 2, y, w + 4, 15);
  for (let k = 0; k < 5; k++) {
    let spr = k < n ? STAR_FILL : STAR_EMPTY;
    if (flash && k < n) spr = STAR_FLASH;
    sprite(s, cx - Math.floor(w / 2) + 4 + k * 11, y + 3, spr, STAR_PAL);
  }
}

export function topRight(
  s: Surface,
  xr: number,
  y: number,
  o: { day: string; clock: string; clean: string; dirty: string; night: boolean },
): void {
  const w = 92;
  const x = xr - w;
  plate(s, x, y, w, 36);
  sprite(s, x + 5, y + 4, o.night ? MOON : SUN, { '#': C.STONE5, o: C.GOLD });
  text(s, x + 15, y + 5, o.day, C.MUTED);
  text(s, x + 15 + textWidthPx(o.day) + 4, y + 5, o.clock, C.CREAM);
  sprite(s, x + 5, y + 14, ICON_CLEAN, ICON_PAL);
  text(s, x + 17, y + 15, `$${o.clean}`, C.CREAM, C.INK);
  sprite(s, x + 5, y + 24, ICON_DIRTY, ICON_PAL);
  text(s, x + 17, y + 25, `$${o.dirty}`, C.DIRTY, C.INK);
  text(s, x + w - 4 - textWidthPx('DIRTY'), y + 25, 'DIRTY', C.DIRTY_LABEL);
  text(s, x + w - 4 - textWidthPx('CLEAN'), y + 15, 'CLEAN', C.CLEAN_LABEL);
}

export function objective(s: Surface, cx: number, y: number, str: string): void {
  const w = textWidthPx(str) + 18;
  const x = cx - Math.floor(w / 2);
  plate(s, x, y, w, 13);
  sprite(s, x + 4, y + 4, ['#..', '##.', '###', '##.', '#..'], { '#': C.GOLD });
  text(s, x + 12, y + 4, str, C.CREAM);
}

/** Phone message (hud.py hud_toast); `slide` (0–1) moves it off the right edge as it leaves. */
export function toast(s: Surface, xr: number, y: number, who: string, str: string, slide = 0): void {
  const w = Math.max(textWidthPx(who), textWidthPx(str)) + 22;
  const x = xr - w + Math.round(slide * (w + 8));
  plate(s, x, y, w, 20, C.LAVLT2);
  sprite(s, x + 5, y + 5, PHONE, { '#': C.INK, c: C.GLASS4 });
  text(s, x + 14, y + 4, who, C.GOLD);
  text(s, x + 14, y + 11, str, C.CREAM);
}

/** Gold keycaps with muted labels (hud.py hud_hint_keys). Returns the strip width. */
export function hintKeys(s: Surface, x: number, y: number, items: readonly [string, string][]): number {
  let cx = x;
  for (const [key, label] of items) {
    const kw = textWidthPx(key) + 4;
    blend(s, y, y + 9, cx, cx + kw, C.GOLD);
    blend(s, y + 8, y + 9, cx, cx + kw, C.GOLD_LO);
    text(s, cx + 2, y + 2, key, C.PLATE);
    text(s, cx + kw + 3, y + 2, label, C.MUTED, C.INK);
    cx += kw + 6 + textWidthPx(label) + 8;
  }
  return cx - x;
}

export function hintKeysWidth(items: readonly [string, string][]): number {
  return items.reduce((w, [k, l]) => w + textWidthPx(k) + 4 + 6 + textWidthPx(l) + 8, 0);
}

// ------------------------------------------------------------------ radar (hud.py draw_radar)
export interface RadarInput {
  px: number;
  py: number;
  /** Player facing as an on-screen angle (radians, y down); the arrow points this way. */
  heading?: number;
  tileAt: (i: number, j: number) => string | undefined;
  buildings: readonly { x: number; y: number; hx: number; hy: number }[];
  blips: readonly { kind: 'police' | 'objective' | 'home' | 'shop'; x: number; y: number }[];
  search?: { x: number; y: number; r: number } | null;
}

const RADAR_COL = {
  road: [54, 44, 57] as RGB, // asph 1
  walk: [146, 141, 154] as RGB, // lavlt 3
  grass: [98, 116, 98] as RGB, // sage 2
  water: [112, 131, 139] as RGB, // teal 3
  lot: [80, 63, 88] as RGB, // lav 2
  dirt: [125, 82, 73] as RGB, // clay 1
  plank: [111, 87, 72] as RGB, // wood 2
  bld: [168, 160, 170] as RGB, // lavlt 4
  bldEdge: [125, 118, 136] as RGB, // lavlt 2
};

export function radarTileColour(k: string | undefined): RGB {
  if (k === undefined) return C.INK;
  if (
    k.startsWith('road') ||
    k.startsWith('asphalt') ||
    k.startsWith('cross') ||
    k.startsWith('inter') ||
    k.startsWith('manhole')
  )
    return RADAR_COL.road;
  if (k.startsWith('sidewalk')) return RADAR_COL.walk;
  if (k.startsWith('grass')) return RADAR_COL.grass;
  if (k.startsWith('water')) return RADAR_COL.water;
  if (k.startsWith('planks')) return RADAR_COL.plank;
  if (k.startsWith('dirt')) return RADAR_COL.dirt;
  return RADAR_COL.lot;
}

/** Iso-oriented radar: the same projection as the world at a small scale, centred on the player. */
export function radar(s: Surface, cx: number, cy: number, r: number, scale: number, inp: RadarInput): void {
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if ((i + 0.5) ** 2 + (j + 0.5) ** 2 > r * r) continue;
      const X = i / scale;
      const Y = j / scale;
      const wx = inp.px + Y + X / 2;
      const wy = inp.py + Y - X / 2;
      let c = radarTileColour(inp.tileAt(Math.floor(wx / 32), Math.floor(wy / 32)));
      for (const b of inp.buildings) {
        if (Math.abs(wx - b.x) <= b.hx && Math.abs(wy - b.y) <= b.hy) {
          c =
            Math.abs(wx - b.x) > b.hx - 6 || Math.abs(wy - b.y) > b.hy - 6
              ? RADAR_COL.bldEdge
              : RADAR_COL.bld;
          break;
        }
      }
      px(s, cx + i, cy + j, c);
    }
  }
  const toRadar = (wx: number, wy: number) => ({
    X: (wx - inp.px - (wy - inp.py)) * scale,
    Y: ((wx - inp.px + (wy - inp.py)) / 2) * scale,
  });
  if (inp.search) {
    for (let k = 0; k < 160; k++) {
      const a = (k / 160) * Math.PI * 2;
      const p = toRadar(inp.search.x + inp.search.r * Math.cos(a), inp.search.y + inp.search.r * Math.sin(a));
      const ix = Math.round(cx + p.X);
      const iy = Math.round(cy + p.Y);
      if ((ix - cx) ** 2 + (iy - cy) ** 2 < (r - 1) ** 2)
        px(s, ix, iy, (a * 8) % 2 < 1 ? C.POLICE_R : C.POLICE_B);
    }
  }
  for (const b of inp.blips) {
    let { X, Y } = toRadar(b.x, b.y);
    const d = Math.hypot(X, Y);
    if (d > r - 4) {
      X = (X / d) * (r - 4);
      Y = (Y / d) * (r - 4);
    }
    const ix = Math.round(cx + X);
    const iy = Math.round(cy + Y);
    if (b.kind === 'police') {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          px(
            s,
            ix + dx,
            iy + dy,
            Math.abs(dx) === 2 || Math.abs(dy) === 2 ? C.INK : dx <= 0 ? C.POLICE_R : C.POLICE_B,
          );
    } else if (b.kind === 'objective') {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (Math.abs(dx) + Math.abs(dy) <= 2)
            px(s, ix + dx, iy + dy, Math.abs(dx) + Math.abs(dy) === 2 ? C.INK : C.GOLD);
    } else if (b.kind === 'home') sprite(s, ix - 3, iy - 3, HOME, { '#': C.INK, c: C.CREAM });
    else sprite(s, ix - 2, iy - 2, SHOP, { '#': C.INK, g: C.SAGE4 });
  }
  if (inp.heading === undefined) sprite(s, cx - 3, cy - 3, ARROW, { '#': C.INK, w: C.CREAM });
  else arrow(s, cx, cy, inp.heading);
  for (let k = 0; k < 400; k++) {
    const a = (k / 400) * Math.PI * 2;
    px(s, Math.round(cx + (r + 1) * Math.cos(a)), Math.round(cy + (r + 1) * Math.sin(a)), C.EDGE);
    px(s, Math.round(cx + (r + 2) * Math.cos(a)), Math.round(cy + (r + 2) * Math.sin(a)), C.INK);
  }
}

/** The player arrow rotated to a heading: a cream triangle with an ink outline, about 7 px across. */
export function arrow(s: Surface, cx: number, cy: number, heading: number): void {
  const tip = { x: Math.cos(heading) * 3.6, y: Math.sin(heading) * 3.6 };
  const back = (a: number) => ({ x: Math.cos(heading + a) * 3.2, y: Math.sin(heading + a) * 3.2 });
  const tri = [tip, back(2.5), { x: -tip.x * 0.25, y: -tip.y * 0.25 }, back(-2.5)];
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let k = 0; k < tri.length; k++) {
      const a = tri[k] as { x: number; y: number };
      const b = tri[(k + 1) % tri.length] as { x: number; y: number };
      const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (c === 0) continue;
      const sg = c > 0 ? 1 : -1;
      if (sign === 0) sign = sg;
      else if (sg !== sign) return false;
    }
    return true;
  };
  const cells: [number, number, boolean][] = [];
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) cells.push([x, y, inside(x, y)]);
  const filled = new Set(cells.filter((c) => c[2]).map(([x, y]) => `${x},${y}`));
  for (const [x, y, on] of cells) {
    if (on) continue;
    const touch = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => filled.has(`${x + (dx as number)},${y + (dy as number)}`));
    if (touch) px(s, cx + x, cy + y, C.INK);
  }
  for (const k of filled) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    px(s, cx + x, cy + y, C.CREAM);
  }
}
