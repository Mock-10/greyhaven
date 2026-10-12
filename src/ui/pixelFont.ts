// The pixel fonts. `body` is the 5 × 7 font (art/source/pixfont7.py → font7.json; UI redesign 2026-10-12: larger
// text), used for everything people read. `small` is the original 3 × 5 font (art/source/pixfont.py), kept for tiny
// captions such as radar labels. Glyphs are bit strings, row by row; one blank column separates glyphs.

import F7 from './font7.json';

export type FontId = 'body' | 'small';

/** The 3 × 5 font: 15-character bit strings. */
export const GLYPHS: Readonly<Record<string, string>> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101011', V: '101101101010010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110',
  ' ': '000000000000000', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000',
  '/': '001001010100100', '-': '000000111000000', '+': '000010111010000', '!': '010010010000010',
  '?': '110001010000010', "'": '010010000000000', $: '011110010011110', '%': '101001010100101',
  '(': '010100100100010', ')': '010001001001010', '*': '000101010101000', '#': '101111101111101',
  '=': '000111000111000', '<': '001010100010001', '>': '100010001010100', '~': '000011110000000',
  '[': '110100100100110', ']': '011001001001011', '&': '010101010101011', _: '000000000000111',
  '^': '010101000000000',
}; // prettier-ignore

const TRIMMED = new Set(['.', ',', ':', "'", '!']);
export const GLYPH_H = 5;

const BODY = F7 as { height: number; space: number; digits: string; glyphs: Record<string, string> };
const BODY_W = 5;

/** Every character the body font draws (besides the space). */
export const BODY_CHARS: readonly string[] = Object.keys(BODY.glyphs);

export function fontHeight(font: FontId = 'body'): number {
  return font === 'body' ? BODY.height : GLYPH_H;
}

/** A body (5 × 7) glyph: proportional for letters and punctuation, full width for digits (pixfont7.glyph). */
function glyph7(ch: string): boolean[][] {
  const H = BODY.height;
  if (ch === ' ') return Array.from({ length: H }, () => Array<boolean>(BODY.space).fill(false));
  const bits = BODY.glyphs[ch.toUpperCase()] ?? (BODY.glyphs['?'] as string);
  const rows = Array.from({ length: H }, (_, r) =>
    Array.from({ length: BODY_W }, (_, c) => bits[r * BODY_W + c] === '#'),
  );
  if (BODY.digits.includes(ch)) return rows;
  const used = [...Array(BODY_W).keys()].filter((c) => rows.some((row) => row[c]));
  if (!used.length) return rows;
  const lo = Math.min(...used);
  const hi = Math.max(...used);
  return rows.map((row) => row.slice(lo, hi + 1));
}

/** Glyph columns as a bit matrix (the small font trims narrow punctuation, like pixfont.text_px). */
export function glyph(ch: string, font: FontId = 'body'): boolean[][] {
  if (font === 'body') return glyph7(ch);
  const bits = GLYPHS[ch.toUpperCase()] ?? (GLYPHS['?'] as string);
  let rows = [0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => bits[r * 3 + c] === '1'));
  if (TRIMMED.has(ch)) {
    const used = [0, 1, 2].filter((c) => rows.some((row) => row[c]));
    const lo = Math.min(...used);
    const hi = Math.max(...used);
    rows = rows.map((row) => row.slice(lo, hi + 1));
  }
  return rows;
}

/** Text as a bit matrix, glyphs separated by one blank column. */
export function textBits(s: string, font: FontId = 'body'): boolean[][] {
  const rows: boolean[][] = Array.from({ length: fontHeight(font) }, () => []);
  [...s].forEach((ch, i) => {
    if (i > 0) rows.forEach((r) => r.push(false));
    glyph(ch, font).forEach((r, y) => (rows[y] as boolean[]).push(...r));
  });
  return rows;
}

export function textWidth(s: string, scale = 1, font: FontId = 'body'): number {
  return (textBits(s, font)[0] as boolean[]).length * scale;
}
