// HUD drawing primitives, ported from art/source/hud.py (docs/11: "the shapes, colours and sizes in it are
// the spec"). They draw into an RGBA pixel buffer at 1 UI pixel per pixel; the HUD scene shows that
// buffer scaled by a whole number. Pure code (no Phaser), so it can be unit tested.

import { fontHeight, textBits, type FontId } from './pixelFont';
import { icon, type IconName } from './icons';

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

// ------------------------------------------------------------------ layout audit
/** A drawn text or icon rect, recorded while an audit runs (tests check that none overlap). */
export interface DrawnRect {
  x: number;
  y: number;
  w: number;
  h: number;
  what: string;
  /** Drawn on purpose over a picture (a count badge on an icon): may overlap icons, never text. */
  over?: boolean;
}

let audit: DrawnRect[] | null = null;

/** Record a drawn rect in the running audit (icons drawn by ui/icons.ts). */
export function recordRect(r: DrawnRect): void {
  audit?.push(r);
}

/** Mark the last recorded rect as a deliberate overlay on a picture (a badge). */
export function markLastOver(): void {
  const last = audit?.at(-1);
  if (last) last.over = true;
}

/** Start recording every text and icon drawn; `endAudit` returns them. */
export function beginAudit(): void {
  audit = [];
}

export function endAudit(): DrawnRect[] {
  const out = audit ?? [];
  audit = null;
  return out;
}

/** Pairs of recorded rects that overlap (touching edges don't count). */
export function overlaps(rects: readonly DrawnRect[]): [DrawnRect, DrawnRect][] {
  const out: [DrawnRect, DrawnRect][] = [];
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i] as DrawnRect;
      const b = rects[j] as DrawnRect;
      const badgeOnIcon = (a.over && b.what.startsWith('icon')) || (b.over && a.what.startsWith('icon'));
      if (badgeOnIcon) continue;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push([a, b]);
    }
  return out;
}

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
  audit?.push({ x, y, w: (rows[0] ?? '').length, h: rows.length, what: 'icon' });
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = pal[ch];
      if (ch !== '.' && c) px(s, x + i, y + j, c);
    });
  });
}

/** Pixel-font text (hud.py draw_text), with an optional 1 px drop shadow; returns the width. The body font is the
 *  5 × 7 one (UI redesign 2026-10-12); `small` is the old 3 × 5 font for tiny captions. */
export function text(
  s: Surface,
  x: number,
  y: number,
  str: string,
  col: RGB,
  shadow?: RGB,
  scale = 1,
  font: FontId = 'body',
): number {
  const bits = textBits(str, font);
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
  audit?.push({ x, y, w: w * scale, h: fontHeight(font) * scale + (shadow ? 1 : 0), what: `text "${str}"` });
  return w * scale;
}

/** Small-font text (3 × 5), for captions. */
export function small(s: Surface, x: number, y: number, str: string, col: RGB, shadow?: RGB): number {
  return text(s, x, y, str, col, shadow, 1, 'small');
}

export function textWidthPx(str: string, scale = 1, font: FontId = 'body'): number {
  return (textBits(str, font)[0] as boolean[]).length * scale;
}

/** Height of a line of text in a font, at a scale. */
export const LINE = fontHeight('body');

/** Split text into lines no wider than `maxW` pixels, at spaces. */
export function wrapPx(str: string, maxW: number, font: FontId = 'body'): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidthPx(next, 1, font) > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** A sprite drawn at a whole-number scale. */
export function spriteScaled(
  s: Surface,
  x: number,
  y: number,
  rows: readonly string[],
  pal: Record<string, RGB | null>,
  scale: number,
): void {
  audit?.push({ x, y, w: (rows[0] ?? '').length * scale, h: rows.length * scale, what: 'icon' });
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = pal[ch];
      if (ch === '.' || !c) return;
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) px(s, x + i * scale + sx, y + j * scale + sy, c);
    });
  });
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
// shop item icons, 14 x 13 (hud.py ITEM_*). No gold: gold is reserved for valuables and interactables.
export const HOME = ['...#...', '..#c#..', '.#ccc#.', '#ccccc#', '.#c#c#.', '.#c#c#.', '.#####.'];
export const SHOP = ['#####', '#ggg#', '#g#g#', '#ggg#', '#####'];
export const ARROW = ['...#...', '..#w#..', '.#www#.', '#wwwww#', '...w...', '...w...', '.......'];

// ------------------------------------------------------------------ HUD panels (hud.py)
export const VITALS = { w: 140, h: 50 };

/** Weapon and vitals (top-left): the weapon label and ammo, health and armor as icons with bars. */
export function topLeft(
  s: Surface,
  x: number,
  y: number,
  o: { ammo: string; label: string; hp: number; armor: number },
): void {
  plate(s, x, y, VITALS.w, VITALS.h);
  text(s, x + 6, y + 5, o.label, C.MUTED);
  const ammo = o.ammo === '-/-' ? '' : o.ammo;
  if (ammo) text(s, x + VITALS.w - 6 - textWidthPx(ammo), y + 5, ammo, C.CREAM, C.INK);
  icon(s, x + 4, y + 15, 'hud/health');
  bar(s, x + 23, y + 20, VITALS.w - 52, 7, o.hp, C.HP, C.HP_LO);
  const hp = String(Math.round(o.hp * 100));
  text(s, x + VITALS.w - 6 - textWidthPx(hp), y + 20, hp, C.CREAM, C.INK);
  icon(s, x + 4, y + 32, 'hud/armor');
  bar(s, x + 23, y + 37, VITALS.w - 52, 6, o.armor, C.ARM, C.ARM_LO, 2);
  const ar = String(Math.round(o.armor * 100));
  text(s, x + VITALS.w - 6 - textWidthPx(ar), y + 36, ar, C.MUTED, C.INK);
}

/** The five wanted stars at 2× (empty, wanted, or the flash frame while searching). */
export function stars(s: Surface, cx: number, y: number, n: number, flash = false): void {
  const pitch = 22;
  const w = 5 * pitch + 6;
  const x0 = cx - Math.floor(w / 2);
  plate(s, x0, y, w, 26);
  for (let k = 0; k < 5; k++) {
    let spr = k < n ? STAR_FILL : STAR_EMPTY;
    if (flash && k < n) spr = STAR_FLASH;
    spriteScaled(s, x0 + 5 + k * pitch, y + 4, spr, STAR_PAL, 2);
  }
}

export const CLOCK_PANEL = { w: 132, h: 58 };

/** Day, clock and cash (top-right): a sun or moon, then clean and dirty cash with their bill icons. */
export function topRight(
  s: Surface,
  xr: number,
  y: number,
  o: { day: string; clock: string; clean: string; dirty: string; night: boolean },
): void {
  const { w, h } = CLOCK_PANEL;
  const x = xr - w;
  plate(s, x, y, w, h);
  icon(s, x + 4, y + 3, o.night ? 'hud/moon' : 'hud/sun');
  text(s, x + 24, y + 7, o.day, C.MUTED);
  text(s, x + 24 + textWidthPx(o.day) + 5, y + 7, o.clock, C.CREAM);
  icon(s, x + 4, y + 21, 'hud/clean');
  text(s, x + 24, y + 25, `$${o.clean}`, C.CREAM, C.INK);
  small(s, x + w - 5 - textWidthPx('CLEAN', 1, 'small'), y + 26, 'CLEAN', C.CLEAN_LABEL);
  icon(s, x + 4, y + 38, 'hud/dirty');
  text(s, x + 24, y + 42, `$${o.dirty}`, C.DIRTY, C.INK);
  small(s, x + w - 5 - textWidthPx('DIRTY', 1, 'small'), y + 43, 'DIRTY', C.DIRTY_LABEL);
}

export function objective(s: Surface, cx: number, y: number, str: string): void {
  const w = textWidthPx(str) + 24;
  const x = cx - Math.floor(w / 2);
  plate(s, x, y, w, 17);
  spriteScaled(s, x + 6, y + 5, ['#..', '##.', '###', '##.', '#..'], { '#': C.GOLD }, 1);
  text(s, x + 15, y + 5, str, C.CREAM);
}

export const TOAST_MAX_W = 250;

/** The picture a message shows: a portrait for people, an object for services, a phone otherwise. */
export function senderIcon(who: string, icons: Readonly<Record<string, IconName>>): IconName {
  return icons[who] ?? 'app/messages';
}

/** Phone message (hud.py hud_toast, redesigned): the sender's picture, the sender in gold, up to two lines of text.
 *  `slide` (0–1) moves it off the right edge as it leaves. Returns its height. */
export function toast(
  s: Surface,
  xr: number,
  y: number,
  who: string,
  str: string,
  pic: IconName,
  slide = 0,
): number {
  const lines = wrapPx(str, TOAST_MAX_W - 52).slice(0, 2);
  const w = Math.max(textWidthPx(who), ...lines.map((l) => textWidthPx(l))) + 52;
  const h = 40;
  const x = xr - w + Math.round(slide * (w + 8));
  plate(s, x, y, w, h, C.LAVLT2);
  blend(s, y + 3, y + h - 3, x + 3, x + 37, C.INK, 0.7);
  icon(s, x + 4, y + 4, pic);
  text(s, x + 43, y + 5, who, C.GOLD);
  lines.forEach((l, k) => text(s, x + 43, y + 16 + k * 10, l, C.CREAM));
  return h;
}

/** Gold keycaps with muted labels (hud.py hud_hint_keys, body font). Returns the strip width. */
export function hintKeys(s: Surface, x: number, y: number, items: readonly [string, string][]): number {
  let cx = x;
  for (const [key, label] of items) {
    const kw = textWidthPx(key) + 6;
    blend(s, y, y + 11, cx, cx + kw, C.GOLD);
    blend(s, y + 10, y + 11, cx, cx + kw, C.GOLD_LO);
    text(s, cx + 3, y + 2, key, C.PLATE);
    text(s, cx + kw + 4, y + 2, label, C.MUTED, C.INK);
    cx += kw + 4 + textWidthPx(label) + 10;
  }
  return cx - x;
}

export function hintKeysWidth(items: readonly [string, string][]): number {
  return items.reduce((w, [k, l]) => w + textWidthPx(k) + 6 + 4 + textWidthPx(l) + 10, 0);
}

// ------------------------------------------------------------------ car readout (milestone 3)
export const CAR_PANEL = { w: 140, h: 50 };

/** Type, speed, fuel and condition under the vitals panel while driving. Low fuel and heavy damage turn red. */
export function vehiclePanel(
  s: Surface,
  x: number,
  y: number,
  o: { type?: string; fuel: number; health: number; speed: number },
): void {
  plate(s, x, y, CAR_PANEL.w, CAR_PANEL.h);
  text(s, x + 6, y + 5, o.type ?? 'SEDAN', C.CREAM);
  const pct = `${Math.round(o.speed * 100)}%`;
  text(s, x + CAR_PANEL.w - 6 - textWidthPx(pct), y + 5, pct, C.MUTED);
  const fuelLow = o.fuel < 0.15;
  icon(s, x + 4, y + 15, 'hud/fuel');
  bar(s, x + 23, y + 20, CAR_PANEL.w - 29, 7, o.fuel, fuelLow ? C.RED3 : C.GLASS4, C.ARM_LO, 4);
  const hurt = o.health < 0.25;
  icon(s, x + 4, y + 32, 'hud/condition');
  bar(s, x + 23, y + 37, CAR_PANEL.w - 29, 6, o.health, hurt ? C.RED3 : C.SAGE4, C.SAGE1);
}

// ------------------------------------------------------------------ radar (hud.py draw_radar)
export interface RadarInput {
  px: number;
  py: number;
  /** Player facing as an on-screen angle (radians, y down); the arrow points this way. */
  heading?: number;
  /** Ground kind at a world point: a tile kind or a vector-ground material name (maps/groundQuery.ts). */
  groundAt: (x: number, y: number) => string | undefined;
  buildings: readonly { x: number; y: number; hx: number; hy: number }[];
  /** 'stalled': a home whose operation needs restocking (docs/09), the home in red. */
  blips: readonly { kind: 'police' | 'objective' | 'home' | 'stalled' | 'shop'; x: number; y: number }[];
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
    k.startsWith('manhole') ||
    k.startsWith('paint') ||
    k === 'iron'
  )
    return RADAR_COL.road;
  if (
    k.startsWith('sidewalk') ||
    k.startsWith('plaza') ||
    ['kerb', 'brickpave', 'cobble', 'terrazzo', 'concrete', 'grate'].includes(k)
  )
    return RADAR_COL.walk;
  if (k.startsWith('grass') || k === 'soil') return RADAR_COL.grass;
  if (k === 'gravel') return RADAR_COL.dirt;
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
      let c = radarTileColour(inp.groundAt(wx, wy));
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
    else if (b.kind === 'stalled') sprite(s, ix - 3, iy - 3, HOME, { '#': C.INK, c: C.POLICE_R });
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
