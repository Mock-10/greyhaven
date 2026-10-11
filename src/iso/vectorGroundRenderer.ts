// Ground renderer for maps drawn as vector ground (docs/14). The ground never moves, so it is baked into
// screen-aligned chunk images on demand: materials and kerb faces (vectorGround.ts), then grass tufts and other
// ground decals, then the static ground shadows. Only chunks near the camera are kept.

import type Phaser from 'phaser';
import groundJson from '../../art/ground.json';
import { BALANCE } from '../config/balance';
import { SHADOW_RGB, TILE } from '../config/constants';
import { frameInfo } from '../assets/atlasLoader';
import type { MapData } from '../maps/types';
import { rasterizeShadows, shadowAlpha, type Rect, type ShadowShape, shapeBounds } from './shadows';
import { rectsOverlap } from './occlusion';
import { worldToScreen } from './projection';
import {
  composeGround,
  projectShape,
  type ComposeInput,
  type GroundMaterial,
  type ScreenShape,
} from './vectorGround';

export const GROUND_SHEET = groundJson;

interface Chunk {
  rect: Rect;
  img: Phaser.GameObjects.Image | null;
  key: string;
  lastUsed: number;
}

/** Material table from art/ground.json, indexed by id. */
export function groundMaterials(): (GroundMaterial | undefined)[] {
  const out: (GroundMaterial | undefined)[] = [];
  const ramps = groundJson.ramps as Record<string, number[][]>;
  for (const m of groundJson.materials) {
    out[m.id] = {
      name: m.name,
      id: m.id,
      height: m.height,
      side: ramps[m.side] as number[][],
      left: m.left,
      right: m.right,
    };
  }
  return out;
}

export function materialId(name: string): number {
  const m = groundJson.materials.find((x) => x.name === name);
  if (!m) throw new Error(`unknown ground material ${name}`);
  return m.id;
}

let swatchPixels: ImageData | null = null;

export class VectorGroundRenderer {
  private chunks: Chunk[] = [];
  private frameNo = 0;
  private tint = 0xffffff;
  private readonly input: ComposeInput;
  private readonly decals: { frame: string; x: number; y: number; bounds: Rect }[] = [];
  private static serial = 0;

  constructor(
    private scene: Phaser.Scene,
    private map: MapData,
    private shadows: readonly ShadowShape[],
    private layer: Phaser.GameObjects.Layer,
  ) {
    const g = map.ground;
    if (!g) throw new Error(`map ${map.id} has no vector ground`);
    const mats = groundMaterials();
    const shapes: ScreenShape[] = g.shapes.map((s) => projectShape(materialId(s.m), s.p));
    const sheet = this.swatches();
    const W = groundJson.w;
    const H = groundJson.h;
    const origin = new Map<number, { x: number; y: number }>();
    for (const m of groundJson.materials) origin.set(m.id, { x: m.x, y: m.y });
    const sw = sheet.width;
    const data = sheet.data;
    this.input = {
      shapes,
      mapW: map.width * TILE,
      mapH: map.height * TILE,
      baseMat: materialId(g.base),
      materials: mats,
      voidHeight: groundJson.voidHeight,
      seed: groundJson.seed,
      sample: (mat, gx, gy, out, k) => {
        const o = origin.get(mat) as { x: number; y: number };
        const sx = o.x + (((gx % W) + W) % W);
        const sy = o.y + (((gy % H) + H) % H);
        const s = (sy * sw + sx) * 4;
        out[k] = data[s] as number;
        out[k + 1] = data[s + 1] as number;
        out[k + 2] = data[s + 2] as number;
      },
    };
    for (const d of g.decals ?? []) {
      const frame = `dec/${d.k}/0`;
      const f = frameInfo('city', frame);
      const s = worldToScreen(d.x, d.y);
      const x = Math.round(s.x) - f.ax;
      const y = Math.round(s.y) - f.ay;
      this.decals.push({ frame, x, y, bounds: { x, y, w: f.w, h: f.h } });
    }
    // Screen-aligned chunks over the map's diamond (plus its edge skirt).
    const CW = BALANCE.render.vectorChunkW;
    const CH = BALANCE.render.vectorChunkH;
    const mw = map.width * TILE;
    const mh = map.height * TILE;
    const minX = -mh;
    const maxX = mw;
    const maxY = (mw + mh) / 2 + 8;
    for (let cy = 0; cy * CH < maxY; cy++) {
      for (let cx = Math.floor(minX / CW); cx * CW < maxX; cx++) {
        const rect = { x: cx * CW, y: cy * CH, w: CW, h: CH };
        if (this.touchesMap(rect, mw, mh)) this.chunks.push({ rect, img: null, key: '', lastUsed: 0 });
      }
    }
  }

  /** Any pixel of the rect within reach of the map diamond (bounds test on the inverse projection). */
  private touchesMap(r: Rect, mw: number, mh: number): boolean {
    const corners = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ].map(([sx, sy]) => ({ x: (sy as number) + (sx as number) / 2, y: (sy as number) - (sx as number) / 2 }));
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    return (
      Math.max(...xs) >= -16 &&
      Math.min(...xs) <= mw + 16 &&
      Math.max(...ys) >= -16 &&
      Math.min(...ys) <= mh + 16
    );
  }

  private swatches(): ImageData {
    if (swatchPixels) return swatchPixels;
    const img = this.scene.textures.get('ground').getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(img, 0, 0);
    swatchPixels = ctx.getImageData(0, 0, img.width, img.height);
    return swatchPixels;
  }

  get bounds(): Rect {
    const mw = this.map.width * TILE;
    const mh = this.map.height * TILE;
    return { x: -mh, y: 0, w: mw + mh, h: (mw + mh) / 2 + 8 };
  }

  update(view: Rect): void {
    this.frameNo++;
    for (const c of this.chunks) {
      if (!rectsOverlap(c.rect, view)) continue;
      if (!c.img) this.bake(c);
      c.lastUsed = this.frameNo;
    }
    const baked = this.chunks.filter((c) => c.img);
    const cap = BALANCE.render.maxChunks;
    if (baked.length > cap) {
      baked
        .filter((c) => c.lastUsed !== this.frameNo)
        .sort((a, b) => a.lastUsed - b.lastUsed)
        .slice(0, baked.length - cap)
        .forEach((c) => {
          c.img?.destroy();
          c.img = null;
          this.scene.textures.remove(c.key);
        });
    }
  }

  setTint(tint: number): void {
    this.tint = tint;
    for (const c of this.chunks) c.img?.setTint(tint);
  }

  bakedCount(): number {
    return this.chunks.filter((c) => c.img).length;
  }

  private bake(c: Chunk): void {
    const { rect } = c;
    const { rgba, mat } = composeGround(this.input, rect.x, rect.y, rect.w, rect.h);
    const canvas = document.createElement('canvas');
    canvas.width = rect.w;
    canvas.height = rect.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, rect.w, rect.h), 0, 0);
    // ground decals (grass tufts, weeds), from the city atlas
    const atlas = this.scene.textures.get('city').getSourceImage() as HTMLImageElement;
    for (const d of this.decals) {
      if (!rectsOverlap(d.bounds, rect)) continue;
      const f = frameInfo('city', d.frame);
      ctx.drawImage(atlas, f.x, f.y, f.w, f.h, d.x - rect.x, d.y - rect.y, f.w, f.h);
    }
    // static shadows, only on the ground
    const shapes = this.shadows.filter((s) => rectsOverlap(shapeBounds(s), rect));
    if (shapes.length) {
      const mask = rasterizeShadows(
        shapes,
        rect,
        (px, py) => mat[(py - rect.y) * rect.w + (px - rect.x)] !== 0,
      );
      const img = ctx.getImageData(0, 0, rect.w, rect.h);
      const strength = BALANCE.render.shadowStrength;
      for (let k = 0; k < mask.length; k++) {
        const v = mask[k] as number;
        if (!v) continue;
        const a = shadowAlpha(v, strength) / 255;
        img.data[k * 4] = Math.round((img.data[k * 4] as number) * (1 - a) + (SHADOW_RGB[0] as number) * a);
        img.data[k * 4 + 1] = Math.round(
          (img.data[k * 4 + 1] as number) * (1 - a) + (SHADOW_RGB[1] as number) * a,
        );
        img.data[k * 4 + 2] = Math.round(
          (img.data[k * 4 + 2] as number) * (1 - a) + (SHADOW_RGB[2] as number) * a,
        );
      }
      ctx.putImageData(img, 0, 0);
    }
    c.key = `__vground_${VectorGroundRenderer.serial++}`;
    this.scene.textures.addCanvas(c.key, canvas);
    const img = this.scene.add.image(rect.x, rect.y, c.key).setOrigin(0, 0).setTint(this.tint);
    this.layer.add(img);
    c.img = img;
  }

  destroy(): void {
    for (const c of this.chunks) {
      c.img?.destroy();
      if (c.key) this.scene.textures.remove(c.key);
    }
    this.chunks = [];
  }
}
