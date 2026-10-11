// Ground renderer. Tiles never move, so they are baked into chunk textures (16 × 16 tiles each) with
// their static ground shadows, and only chunks near the camera are kept (docs/14: render only what is in
// view). Chunks draw back to front, so a tile's curb face is covered by the tiles in front of it,
// exactly as in the reference composer.

import type Phaser from 'phaser';
import { SHADOW_RGB } from '../config/constants';
import { BALANCE } from '../config/balance';
import { frameInfo } from '../assets/atlasLoader';
import { tileFrame } from '../assets/sprites';
import type { MapData } from '../maps/types';
import { tileTopVertex } from './projection';
import { rasterizeShadows, shadowAlpha, type Rect, type ShadowShape, shapeBounds } from './shadows';
import { chunkCount, chunkTiles, tileAtPixel, unionRect, type ChunkId } from './chunks';
import { rectsOverlap } from './occlusion';

interface Chunk {
  id: ChunkId;
  rect: Rect;
  rt: Phaser.GameObjects.RenderTexture | null;
  lastUsed: number;
}

export class GroundRenderer {
  private chunks: Chunk[] = [];
  private frameNo = 0;
  private tint = 0xffffff;
  private readonly size = BALANCE.render.chunkTiles;

  constructor(
    private scene: Phaser.Scene,
    private map: MapData,
    private seedFor: (i: number, j: number) => number,
    private shadows: readonly ShadowShape[],
    private layer: Phaser.GameObjects.Layer,
  ) {
    const { cw, ch } = chunkCount(this.size, map.width, map.height);
    for (let ci = 0; ci < cw; ci++) {
      for (let cj = 0; cj < ch; cj++) {
        const id = { ci, cj };
        let rect: Rect | null = null;
        for (const t of chunkTiles(id, this.size, map.width, map.height))
          rect = unionRect(rect, this.tileRect(t.i, t.j));
        // Even sizes: a render texture with an odd side samples half a pixel off and draws 1 px out.
        if (rect)
          this.chunks.push({
            id,
            rect: { ...rect, w: rect.w + (rect.w % 2), h: rect.h + (rect.h % 2) },
            rt: null,
            lastUsed: 0,
          });
      }
    }
  }

  /** Screen bounds of the whole map's ground. */
  get bounds(): Rect {
    return (
      this.chunks.reduce<Rect | null>((r, c) => unionRect(r, c.rect), null) ?? { x: 0, y: 0, w: 0, h: 0 }
    );
  }

  private tileFrameName(i: number, j: number): string {
    const kind = this.map.tiles?.[i]?.[j];
    if (!kind) throw new Error(`no tile at ${i},${j}`);
    return tileFrame(kind, this.seedFor(i, j)).frame;
  }

  private tileRect(i: number, j: number): Rect {
    const f = frameInfo('tiles', this.tileFrameName(i, j));
    const v = tileTopVertex(i, j);
    return { x: v.x - f.ax, y: v.y - f.ay, w: f.w, h: f.h };
  }

  /** Bake chunks that overlap `view` (screen pixels), and drop the least recently used beyond the cap. */
  update(view: Rect): void {
    this.frameNo++;
    for (const c of this.chunks) {
      if (!rectsOverlap(c.rect, view)) continue;
      if (!c.rt) this.bake(c);
      c.lastUsed = this.frameNo;
    }
    const baked = this.chunks.filter((c) => c.rt);
    if (baked.length > BALANCE.render.maxChunks) {
      baked
        .filter((c) => c.lastUsed !== this.frameNo)
        .sort((a, b) => a.lastUsed - b.lastUsed)
        .slice(0, baked.length - BALANCE.render.maxChunks)
        .forEach((c) => {
          c.rt?.destroy();
          c.rt = null;
        });
    }
  }

  /** Multiply tint for all ground (day/night); applied to chunks baked later too. */
  setTint(tint: number): void {
    this.tint = tint;
    for (const c of this.chunks) c.rt?.setTint(tint);
  }

  bakedCount(): number {
    return this.chunks.filter((c) => c.rt).length;
  }

  private bake(c: Chunk): void {
    const { rect } = c;
    const rt = this.scene.add.renderTexture(rect.x, rect.y, rect.w, rect.h).setOrigin(0, 0);
    rt.setDepth(c.id.ci + c.id.cj);
    rt.beginDraw();
    for (const t of chunkTiles(c.id, this.size, this.map.width, this.map.height)) {
      const r = this.tileRect(t.i, t.j);
      rt.batchDrawFrame('tiles', this.tileFrameName(t.i, t.j), r.x - rect.x, r.y - rect.y);
    }
    rt.endDraw();
    this.bakeShadows(c, rt);
    rt.setTint(this.tint);
    this.layer.add(rt);
    c.rt = rt;
  }

  private bakeShadows(c: Chunk, rt: Phaser.GameObjects.RenderTexture): void {
    const shapes = this.shadows.filter((s) => rectsOverlap(shapeBounds(s), c.rect));
    if (shapes.length === 0) return;
    const i0 = c.id.ci * this.size;
    const j0 = c.id.cj * this.size;
    const mapW = this.map.width;
    const mapH = this.map.height;
    const size = this.size;
    // A pixel takes a shadow only on this chunk's ground, never on the background or a neighbour's tiles.
    const ownsPixel = (px: number, py: number) => {
      const t = tileAtPixel(px, py);
      return t.i >= i0 && t.i < Math.min(i0 + size, mapW) && t.j >= j0 && t.j < Math.min(j0 + size, mapH);
    };
    const mask = rasterizeShadows(shapes, c.rect, ownsPixel);
    const canvas = document.createElement('canvas');
    canvas.width = c.rect.w;
    canvas.height = c.rect.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(c.rect.w, c.rect.h);
    const { shadowStrength } = BALANCE.render;
    for (let k = 0; k < mask.length; k++) {
      const v = mask[k] as number;
      if (!v) continue;
      img.data[k * 4] = SHADOW_RGB[0];
      img.data[k * 4 + 1] = SHADOW_RGB[1];
      img.data[k * 4 + 2] = SHADOW_RGB[2];
      img.data[k * 4 + 3] = shadowAlpha(v, shadowStrength);
    }
    ctx.putImageData(img, 0, 0);
    const key = `__shadow_${c.id.ci}_${c.id.cj}_${this.scene.time.now}`;
    this.scene.textures.addCanvas(key, canvas);
    rt.drawFrame(key, undefined, 0, 0);
    this.scene.textures.remove(key);
  }

  destroy(): void {
    for (const c of this.chunks) c.rt?.destroy();
    this.chunks = [];
  }
}
