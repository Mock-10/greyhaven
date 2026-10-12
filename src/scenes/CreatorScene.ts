// The character creator (docs/11): shown when a new game starts from the title, before the first day. It edits
// the world's look live (WorldScene.setLook repaints the palette-swapped player), and START THE DAY hands over
// to the world and the HUD. Drawing lives in ui/creator.ts.

import Phaser from 'phaser';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { HAIR_COLOURS, HAIR_STYLES, SKIN_TONES, cleanName, type Look } from '../data/looks';
import { hook } from '../debug/hooks';
import type { Params } from '../debug/params';
import { characterFrame } from '../assets/sprites';
import { BALANCE } from '../config/balance';
import {
  CREATOR,
  CREATOR_OUTFITS,
  CREATOR_ROWS,
  arrowBoxes,
  cycle,
  drawCreator,
  rowBox,
  swatchBoxes,
} from '../ui/creator';
import { clear, createSurface, type Surface } from '../ui/hudDraw';
import type { WorldScene } from './WorldScene';

const TEX = 'creator-canvas';
const handled = new WeakSet<KeyboardEvent>();
type Box = { x: number; y: number; w: number; h: number };
const inside = (q: { x: number; y: number }, b: Box) =>
  q.x >= b.x && q.x < b.x + b.w && q.y >= b.y && q.y < b.y + b.h;

export class CreatorScene extends Phaser.Scene {
  private look!: Look;
  private row = 0;
  private surface!: Surface;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image!: Phaser.GameObjects.Image;
  private preview!: Phaser.GameObjects.Sprite;
  private z = 1;
  private dir = 1;
  private t = 0;

  constructor() {
    super('creator');
  }

  private get world(): WorldScene {
    return this.scene.get('world') as WorldScene;
  }

  create(): void {
    hook().minigame = 'creator';
    this.look = { ...this.world.look };
    this.row = 0;
    this.add.rectangle(0, 0, 4096, 4096, 0x241b28, 0.55).setOrigin(0, 0);
    this.image = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    const f = characterFrame(`player/${this.look.style}`, 'idle', this.dir);
    this.preview = this.add.sprite(0, 0, f.atlas, f.frame);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const kb = this.input.keyboard;
    kb?.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      kb?.off('keydown', this.onKey, this);
      this.input.off('pointerdown', this.onDown, this);
    });
  }

  update(_time: number, delta: number): void {
    this.t += delta / 1000;
    // the preview turns through the 8 directions (docs/11: "a live 8-direction preview spins slowly")
    const step = Math.floor(this.t / BALANCE.creator.spinSeconds);
    const d = (1 + step) % 8;
    if (d !== this.dir) {
      this.dir = d;
      this.showPreview();
    }
    // blink the name cursor
    const blink = Math.floor(this.t * 2) % 2 === 0;
    if (blink !== this.blink) {
      this.blink = blink;
      this.redraw();
    }
  }

  private blink = true;

  private layout(): void {
    const { width, height } = this.scale;
    this.z = Math.max(1, Math.floor(Math.min(width / UI_BASE_W, height / UI_BASE_H)));
    const w = Math.ceil(width / this.z);
    const h = Math.ceil(height / this.z);
    this.surface = createSurface(w, h);
    if (this.tex) this.textures.remove(TEX);
    this.tex = this.textures.createCanvas(TEX, w, h);
    this.image.setTexture(TEX).setScale(this.z);
    this.redraw();
  }

  private get pos(): { x: number; y: number } {
    return {
      x: Math.floor((this.surface.width - CREATOR.w) / 2),
      y: Math.floor((this.surface.height - CREATOR.h) / 2),
    };
  }

  private showPreview(): void {
    const f = characterFrame(`player/${this.look.style}`, 'idle', this.dir);
    this.preview.setTexture(f.atlas, f.frame);
    const { x, y } = this.pos;
    const p = CREATOR.preview;
    const s = this.z * BALANCE.creator.previewScale;
    this.preview.setScale(s);
    this.preview.setPosition((x + p.x + p.w / 2) * this.z, (y + p.y + p.h - 22) * this.z);
  }

  private redraw(): void {
    if (!this.tex) return;
    clear(this.surface);
    const { x, y } = this.pos;
    drawCreator(this.surface, x, y, { look: this.look, row: this.row, cursor: this.blink });
    const img = this.tex.context.createImageData(this.surface.width, this.surface.height);
    img.data.set(this.surface.data);
    this.tex.context.putImageData(img, 0, 0);
    this.tex.refresh();
    this.showPreview();
    const h = hook();
    h.creator = { ...this.look, row: CREATOR_ROWS[this.row] as string };
  }

  /** Apply a change: the world repaints the player, the panel redraws. */
  private change(next: Partial<Look>): void {
    this.look = { ...this.look, ...next };
    this.world.setLook(this.look);
    this.redraw();
  }

  private step(by: number): void {
    const row = CREATOR_ROWS[this.row];
    if (row === 'style') this.change({ style: cycle(HAIR_STYLES, this.look.style, by) });
    else if (row === 'skin')
      this.change({
        skin: cycle(
          SKIN_TONES.map((s) => s.id),
          this.look.skin,
          by,
        ),
      });
    else if (row === 'hair')
      this.change({
        hair: cycle(
          HAIR_COLOURS.map((s) => s.id),
          this.look.hair,
          by,
        ),
      });
    else if (row === 'outfit') this.change({ outfit: cycle(CREATOR_OUTFITS, this.look.outfit, by) });
  }

  private onKey(e: KeyboardEvent): void {
    // Phaser can hand the same DOM event over more than once in a slow frame (ListScene does the same)
    if (handled.has(e)) return;
    handled.add(e);
    if (e.repeat && e.key !== 'Backspace') return;
    const row = CREATOR_ROWS[this.row];
    const n = CREATOR_ROWS.length;
    const typing = row === 'name';
    if (e.key === 'Enter') return this.finish();
    if (e.key === 'ArrowDown' || e.key === 'Tab' || (!typing && (e.key === 's' || e.key === 'S')))
      this.row = (this.row + 1) % n;
    else if (e.key === 'ArrowUp' || (!typing && (e.key === 'w' || e.key === 'W')))
      this.row = (this.row + n - 1) % n;
    else if (e.key === 'ArrowLeft' || (!typing && (e.key === 'a' || e.key === 'A'))) this.step(-1);
    else if (e.key === 'ArrowRight' || (!typing && (e.key === 'd' || e.key === 'D'))) this.step(1);
    else if (typing && e.key === 'Backspace') this.change({ name: this.look.name.slice(0, -1) });
    else if (typing && e.key.length === 1) this.change({ name: cleanName(this.look.name + e.key) });
    else if (row === 'start' && e.key === ' ') return this.finish();
    e.preventDefault?.();
    this.redraw();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const q = { x: p.x / this.z, y: p.y / this.z };
    const { x, y } = this.pos;
    for (const r of ['skin', 'hair'] as const) {
      const k = swatchBoxes(x, y, r).findIndex((b) => inside(q, b));
      if (k >= 0) {
        this.row = CREATOR_ROWS.indexOf(r);
        if (r === 'skin') this.change({ skin: (SKIN_TONES[k] as { id: string }).id });
        else this.change({ hair: (HAIR_COLOURS[k] as { id: string }).id });
        return;
      }
    }
    for (const r of ['style', 'outfit'] as const) {
      const a = arrowBoxes(x, y, r);
      if (inside(q, a.left) || inside(q, a.right)) {
        this.row = CREATOR_ROWS.indexOf(r);
        this.step(inside(q, a.left) ? -1 : 1);
        return;
      }
    }
    const k = CREATOR_ROWS.findIndex((_, i) => inside(q, rowBox(x, y, i)));
    if (k < 0) return;
    this.row = k;
    if (CREATOR_ROWS[k] === 'start') return this.finish();
    this.redraw();
  }

  private finish(): void {
    const name = cleanName(this.look.name).trim();
    this.world.setLook({ ...this.look, name: name || 'ALEX' });
    this.world.startPlay();
    const params = this.registry.get('params') as Params;
    this.scene.launch('hud', params);
    hook().minigame = null;
    this.scene.stop();
  }
}
