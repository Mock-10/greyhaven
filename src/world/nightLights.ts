// Night lighting textures (STYLE_GUIDE "Atmosphere variants"):
//  - lit windows: the pixels that differ between a building's day frame and its `_night` frame and are warm
//    (the gold ramp). They are drawn untinted over the darkened building, so windows always glow.
//  - street lamps: a bulb halo and a pool of light on the ground, quantised into 4 bands with 4x4 Bayer
//    dithering like art/source/scene.py _night_fx.

import type Phaser from 'phaser';
import { framePixels } from '../assets/atlasLoader';
import type { AtlasKey } from '../assets/manifest';
import { addPixelsTexture } from '../assets/runtimeTextures';
import type { Pixels } from '../assets/highlight';

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

const WARM: readonly [number, number, number] = [239, 205, 140];

/** True for a warm, lit-window pixel (gold ramp: red over green over blue, clearly warm). */
export function isWarm(r: number, g: number, b: number): boolean {
  return r > g && g > b && r - b > 80 && r > 140;
}

/** Pixels of `night` that are lit windows (warm, and different from `day`); everything else transparent. */
export function windowGlow(day: Pixels, night: Pixels): Pixels {
  const out = new Uint8ClampedArray(night.data.length);
  for (let k = 0; k < night.data.length; k += 4) {
    const r = night.data[k] as number;
    const g = night.data[k + 1] as number;
    const b = night.data[k + 2] as number;
    const same = r === day.data[k] && g === day.data[k + 1] && b === day.data[k + 2];
    if (!same && (night.data[k + 3] as number) > 0 && isWarm(r, g, b)) {
      out[k] = r;
      out[k + 1] = g;
      out[k + 2] = b;
      out[k + 3] = 255;
    }
  }
  return { width: night.width, height: night.height, data: out };
}

/** Texture key of the lit-window overlay for a building frame pair, made once and cached. */
export function windowGlowTexture(
  textures: Phaser.Textures.TextureManager,
  atlas: AtlasKey,
  dayFrame: string,
  nightFrame: string,
  pivot: { ax: number; ay: number },
): string {
  const key = `glow:${atlas}:${nightFrame}`;
  if (!textures.exists(key)) {
    addPixelsTexture(
      textures,
      key,
      windowGlow(framePixels(textures, atlas, dayFrame), framePixels(textures, atlas, nightFrame)),
      pivot,
    );
  }
  return key;
}

/**
 * A street lamp's light as two textures: the halo around the bulb and the pool on the ground. Both are
 * warm colour with alpha in 4 dithered bands; they are drawn additively and faded in with the dark.
 */
export function lampTextures(textures: Phaser.Textures.TextureManager): { halo: string; pool: string } {
  const halo = 'lamp:halo';
  const pool = 'lamp:pool';
  const make = (key: string, w: number, h: number, f: (x: number, y: number) => number) => {
    if (textures.exists(key)) return;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const g = Math.min(1, f(x - w / 2 + 0.5, y - h / 2 + 0.5)) * 4;
        const thr = (BAYER[y % 4] as number[])[x % 4] as number;
        const band = Math.floor(g + (g - Math.floor(g) > thr ? 1 : 0)) / 4;
        if (band <= 0) continue;
        const k = (y * w + x) * 4;
        data[k] = WARM[0];
        data[k + 1] = WARM[1];
        data[k + 2] = WARM[2];
        data[k + 3] = Math.round(band * 0.8 * 255);
      }
    }
    addPixelsTexture(textures, key, { width: w, height: h, data }, { ax: w / 2, ay: h / 2 });
  };
  make(halo, 48, 48, (x, y) => 0.6 * Math.exp(-(x * x + y * y) / (2 * 11 * 11)));
  make(pool, 176, 88, (x, y) => 0.5 * Math.exp(-(x * x + (y / 0.5) ** 2) / (2 * 36 * 36)));
  return { halo, pool };
}
