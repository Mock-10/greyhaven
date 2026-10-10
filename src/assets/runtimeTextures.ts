// Textures made at runtime from pixel buffers (interactable rims, prompt plates). Each gets a pivot so
// it lines up with the ground anchor of the sprite it belongs to.

import type Phaser from 'phaser';
import type { Pixels } from './highlight';
import { setPivot } from './atlasLoader';

export function addPixelsTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  px: Pixels,
  pivot?: { ax: number; ay: number },
): void {
  if (textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = px.width;
  canvas.height = px.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const img = ctx.createImageData(px.width, px.height);
  img.data.set(px.data);
  ctx.putImageData(img, 0, 0);
  const tex = textures.addCanvas(key, canvas);
  if (tex && pivot) setPivot(tex.get(), pivot.ax, pivot.ay);
}
