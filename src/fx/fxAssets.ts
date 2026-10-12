// The effects layer's two sprite sheets: our particles (art/fx.png, art/source/fx_particles.py) and the big
// effects (art/effects.png, art/source/effects.py). Loaded and registered here, beside the art pack's own
// atlases, with every frame pivoted on its anchor like the rest of the art (assets/atlasLoader.ts).

import type Phaser from 'phaser';
import fxPng from '../../art/fx.png';
import fxJson from '../../art/fx.json';
import effectsPng from '../../art/effects.png';
import effectsJson from '../../art/effects.json';
import { parseAtlas, type AtlasJson } from '../assets/atlasFormat';
import { setPivot } from '../assets/atlasLoader';
import type { FxSheet } from './particles';

/** Texture keys (prefixed, so they never clash with the art pack's). */
export const FX_TEXTURE: Record<FxSheet, string> = { fx: 'fx_particles', effects: 'fx_effects' };

export const FX_SHEETS: Record<FxSheet, { url: string; json: AtlasJson }> = {
  fx: { url: fxPng, json: fxJson as unknown as AtlasJson },
  effects: { url: effectsPng, json: effectsJson as unknown as AtlasJson },
};

export function queueFx(load: Phaser.Loader.LoaderPlugin): void {
  for (const sheet of Object.keys(FX_SHEETS) as FxSheet[])
    load.image(FX_TEXTURE[sheet], FX_SHEETS[sheet].url);
}

/** Call once after loading: adds every frame with its anchor as the pivot. */
export function registerFx(textures: Phaser.Textures.TextureManager): void {
  for (const sheet of Object.keys(FX_SHEETS) as FxSheet[]) {
    const tex = textures.get(FX_TEXTURE[sheet]);
    for (const def of parseAtlas(FX_SHEETS[sheet].json).values()) {
      if (tex.has(def.name)) continue;
      const f = tex.add(def.name, 0, def.x, def.y, def.w, def.h);
      if (f) setPivot(f, def.ax, def.ay);
    }
  }
}

/** Every frame name in a sheet (tests check the presets only name frames that exist). */
export function fxFrames(sheet: FxSheet): Set<string> {
  return new Set(Object.keys(FX_SHEETS[sheet].json.frames));
}
