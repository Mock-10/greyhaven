// Registers the 3 × 5 pixel font as a Phaser bitmap font. Glyphs are white so `setTint` gives the
// exact palette colour. One blank column separates glyphs, like pixfont.text_px.

import type Phaser from 'phaser';
import { GLYPHS, GLYPH_H, glyph } from './pixelFont';

export const PIXEL_FONT = 'pixel';
const LINE_H = GLYPH_H + 2;

export function registerPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;
  const chars = Object.keys(GLYPHS);
  const cellW = 4;
  const canvas = document.createElement('canvas');
  canvas.width = chars.length * cellW;
  canvas.height = GLYPH_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#ffffff';
  const tex = scene.textures.addCanvas(PIXEL_FONT, canvas);
  if (!tex) throw new Error('could not create the pixel font texture');
  const data: {
    retroFont: boolean;
    font: string;
    size: number;
    lineHeight: number;
    chars: Record<number, unknown>;
  } = { retroFont: true, font: PIXEL_FONT, size: GLYPH_H, lineHeight: LINE_H, chars: {} };
  chars.forEach((ch, n) => {
    const g = glyph(ch);
    const w = (g[0] as boolean[]).length;
    const x0 = n * cellW;
    g.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect(x0 + x, y, 1, 1)));
    const entry = {
      x: x0,
      y: 0,
      width: Math.max(w, 1),
      height: GLYPH_H,
      centerX: Math.floor(w / 2),
      centerY: Math.floor(GLYPH_H / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: w + 1,
      data: {},
      kerning: {},
      u0: x0 / canvas.width,
      v0: 0,
      u1: (x0 + Math.max(w, 1)) / canvas.width,
      v1: 1,
    };
    data.chars[ch.charCodeAt(0)] = entry;
    const lower = ch.toLowerCase();
    if (lower !== ch) data.chars[lower.charCodeAt(0)] = entry;
  });
  tex.refresh();
  scene.cache.bitmapFont.add(PIXEL_FONT, { data, texture: PIXEL_FONT, frame: null });
}

/** Pixel-font text at an integer scale. */
export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  scale = 1,
): Phaser.GameObjects.BitmapText {
  return scene.add
    .bitmapText(Math.round(x), Math.round(y), PIXEL_FONT, text.toUpperCase(), GLYPH_H * scale)
    .setTint(color);
}
