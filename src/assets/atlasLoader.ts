// Turns the art pack's atlas format into Phaser frames (docs/13). Each frame gets a custom pivot at its
// ground anchor, so a sprite placed at a ground point lines up exactly, also when an animation swaps
// frames whose anchors differ (characters do, per direction).

import type Phaser from 'phaser';
import { ATLASES, ATLAS_KEYS, GROUND_SWATCHES_URL, type AtlasKey } from './manifest';
import { opaqueBounds, parseAtlas, type Bounds, type FrameDef } from './atlasFormat';

export interface FrameInfo extends FrameDef {
  atlas: AtlasKey;
  /** Opaque pixels, relative to the cell. */
  bounds: Bounds;
}

const registry = new Map<string, FrameInfo>();
/** Atlas pixels, kept for per-pixel tests (occlusion coverage). */
const pixels = new Map<string, { data: Uint8ClampedArray; width: number }>();

const id = (atlas: AtlasKey, frame: string) => `${atlas}:${frame}`;

export function queueAtlases(load: Phaser.Loader.LoaderPlugin): void {
  for (const key of ATLAS_KEYS) load.image(key, ATLASES[key].url);
  load.image('ground', GROUND_SWATCHES_URL);
}

/** Call once after the images have loaded. Adds every frame and measures its opaque bounds. */
export function registerAtlases(textures: Phaser.Textures.TextureManager): void {
  for (const key of ATLAS_KEYS) {
    const tex = textures.get(key);
    const img = tex.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    pixels.set(key, { data, width: img.width });
    for (const def of parseAtlas(ATLASES[key].json).values()) {
      const frame = tex.add(def.name, 0, def.x, def.y, def.w, def.h);
      if (!frame) throw new Error(`duplicate frame ${key}:${def.name}`);
      setPivot(frame, def.ax, def.ay);
      registry.set(id(key, def.name), { ...def, atlas: key, bounds: opaqueBounds(data, img.width, def) });
    }
  }
}

export function setPivot(frame: Phaser.Textures.Frame, ax: number, ay: number): void {
  frame.customPivot = true;
  frame.pivotX = ax / frame.width;
  frame.pivotY = ay / frame.height;
}

export function frameInfo(atlas: AtlasKey, frame: string): FrameInfo {
  const f = registry.get(id(atlas, frame));
  if (!f) throw new Error(`missing frame ${atlas}:${frame}`);
  return f;
}

export function hasFrame(atlas: AtlasKey, frame: string): boolean {
  return registry.has(id(atlas, frame));
}

/** RGBA pixels of one frame's cell, for runtime effects such as interactable rims. */
export function framePixels(
  textures: Phaser.Textures.TextureManager,
  atlas: AtlasKey,
  frame: string,
): ImageData {
  const f = frameInfo(atlas, frame);
  const img = textures.get(atlas).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  return ctx.getImageData(0, 0, f.w, f.h);
}

/**
 * Is the pixel at (u, v) of a frame's cell opaque? Coordinates are relative to the cell's top-left. Frames from
 * textures made at runtime (rims) aren't known here: callers use the plain frame instead.
 */
export function opaqueAt(atlas: string, frame: string, u: number, v: number): boolean {
  const f = registry.get(`${atlas}:${frame}`);
  const p = pixels.get(atlas);
  if (!f || !p || u < 0 || v < 0 || u >= f.w || v >= f.h) return false;
  return (p.data[((f.y + v) * p.width + f.x + u) * 4 + 3] as number) > 0;
}
