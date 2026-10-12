// Paints the 'player' texture (docs/11 character creator): the marker sprites of art/player.png, recoloured to the
// player's look (systems/lookSwap.ts). Every player sprite uses this one texture, so a change of clothes repaints
// them all at once.

import type Phaser from 'phaser';
import { ATLASES } from './manifest';
import { atlasPixels, setPivot } from './atlasLoader';
import { parseAtlas } from './atlasFormat';
import type { Look } from '../data/looks';
import { swapPixels, swapTable, type Part, type Rgb } from '../systems/lookSwap';

/** The marker colours of art/player.json: six tones dark to light, then the outline. */
export const MARKERS = (ATLASES.player.json as unknown as { markers: Record<Part, Rgb[]> }).markers;

/**
 * Paint the 'player' texture in this look. The first call swaps the loaded marker image for a canvas with the
 * same frames and pivots; later calls repaint that canvas, and every sprite showing it updates.
 */
export function paintPlayer(textures: Phaser.Textures.TextureManager, look: Look): void {
  const src = atlasPixels('player');
  if (!src) return;
  const height = src.data.length / 4 / src.width;
  const tex = textures.get('player') as Phaser.Textures.Texture & Partial<Phaser.Textures.CanvasTexture>;
  let canvasTex = tex.context ? (tex as Phaser.Textures.CanvasTexture) : null;
  if (!canvasTex) {
    textures.remove('player');
    canvasTex = textures.createCanvas('player', src.width, height);
    if (!canvasTex) return;
    for (const def of parseAtlas(ATLASES.player.json).values()) {
      const f = canvasTex.add(def.name, 0, def.x, def.y, def.w, def.h);
      if (f) setPivot(f, def.ax, def.ay);
    }
  }
  const img = new ImageData(new Uint8ClampedArray(src.data), src.width, height);
  swapPixels(img.data, swapTable(look, MARKERS));
  canvasTex.context.putImageData(img, 0, 0);
  canvasTex.refresh();
}
