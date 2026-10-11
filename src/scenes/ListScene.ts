// A list panel overlay (the phone, the ATM, the bag): pages of rows with actions, a back stack, keyboard and mouse.
// It pauses the world like a menu (docs/01: menus pause). Drawing lives in ui/listPanel.ts.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { hook } from '../debug/hooks';
import { blend, clear, createSurface, type Surface } from '../ui/hudDraw';
import { drawList, LIST_SIZE, listLayout, type ListPage, type ListStyle } from '../ui/listPanel';

export interface ListRequest {
  style: ListStyle;
  /** What hook().minigame reads while open ('phone', 'atm', 'bag'). */
  name: string;
  root: () => ListPage;
}

const TEX = 'list-canvas';
const handled = new WeakSet<KeyboardEvent>();

export class ListScene extends Phaser.Scene {
  private req!: ListRequest;
  private stack: (() => ListPage)[] = [];
  private page!: ListPage;
  private selected = 0;
  private scroll = 0;
  private message: { text: string; t: number } | null = null;
  private surface!: Surface;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image!: Phaser.GameObjects.Image;
  private z = 1;
  /** Ignore keys for a moment after opening: the key that opened the list must not also choose a row. */
  private openedAt = 0;

  constructor() {
    super('list');
  }

  init(req: ListRequest): void {
    this.req = req;
    this.stack = [req.root];
    this.selected = 0;
    this.scroll = 0;
    this.message = null;
    this.rebuild();
  }

  create(): void {
    hook().minigame = this.req.name;
    hook().listPage = this.page;
    this.openedAt = this.time.now;
    this.image = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const kb = this.input.keyboard;
    kb?.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('wheel', this.onWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      kb?.off('keydown', this.onKey, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('wheel', this.onWheel, this);
    });
  }

  private rebuild(): void {
    const top = this.stack.at(-1);
    if (!top) return;
    this.page = top();
    hook().listPage = this.page;
    this.selected = Math.min(this.selected, Math.max(0, this.page.rows.length - 1));
  }

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

  /** The phone sits right of centre (the player stays visible, docs/11); other lists in the middle. */
  private get pos(): { x: number; y: number } {
    const P = LIST_SIZE[this.req.style];
    const s = this.surface;
    const x =
      this.req.style === 'phone'
        ? Math.min(s.width - P.w - 8, Math.floor(s.width / 2) + 40)
        : Math.floor((s.width - P.w) / 2);
    return { x, y: Math.floor((s.height - P.h) / 2) };
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (handled.has(e)) return;
    handled.add(e);
    if (this.time.now - this.openedAt < BALANCE.ui.keyGuardMs) return;
    const n = this.page.rows.length;
    if (e.key === 'Escape' || (e.key.toUpperCase() === 'P' && this.req.name === 'phone')) this.back();
    else if (e.key.toUpperCase() === 'I' && this.req.name === 'bag') this.close();
    else if (e.key === 'ArrowDown' || e.key.toUpperCase() === 'S') this.select((this.selected + 1) % Math.max(1, n));
    else if (e.key === 'ArrowUp' || e.key.toUpperCase() === 'W')
      this.select((this.selected + Math.max(1, n) - 1) % Math.max(1, n));
    else if (e.key === 'Enter' || e.key === ' ' || e.key.toUpperCase() === 'E') this.choose(this.selected);
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) this.choose(Number(e.key) - 1);
  }

  private select(k: number): void {
    this.selected = k;
    const vis = listLayout(this.req.style, 0, 0, this.page, this.scroll).visible;
    if (k < this.scroll) this.scroll = k;
    if (k >= this.scroll + vis) this.scroll = k - vis + 1;
  }

  private choose(k: number): void {
    const r = this.page.rows[k];
    if (!r) return;
    this.select(k);
    if (r.enabled === false || !r.act) return;
    const a = r.act();
    if (a && 'open' in a) {
      this.stack.push(a.open);
      this.selected = 0;
      this.scroll = 0;
      this.message = null;
    } else if (a && 'close' in a) {
      this.close();
      return;
    } else if (a && 'back' in a) {
      this.back();
      return;
    } else if (a && 'say' in a) this.message = { text: a.say, t: 0 };
    this.rebuild();
  }

  private back(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.selected = 0;
      this.scroll = 0;
      this.message = null;
      this.rebuild();
    } else this.close();
  }

  private close(): void {
    hook().listPage = null;
    this.scene.stop();
    this.game.events.emit('list:closed', this.req.name);
  }

  private ui(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: p.x / this.z, y: p.y / this.z };
  }

  private rowAt(p: Phaser.Input.Pointer): number {
    const q = this.ui(p);
    const { x, y } = this.pos;
    const L = listLayout(this.req.style, x, y, this.page, this.scroll);
    const k = L.rows.findIndex((r) => q.x >= r.x && q.x < r.x + r.w && q.y >= r.y && q.y < r.y + r.h);
    return k < 0 ? -1 : this.scroll + k;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const k = this.rowAt(p);
    if (k >= 0) this.choose(k);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const k = this.rowAt(p);
    if (k >= 0) this.selected = k;
  }

  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    const vis = listLayout(this.req.style, 0, 0, this.page, this.scroll).visible;
    const max = Math.max(0, this.page.rows.length - vis);
    this.scroll = Math.max(0, Math.min(max, this.scroll + Math.sign(dy)));
  }

  // ---------------------------------------------------------------- loop

  update(): void {
    const dt = Math.min(0.1, this.game.loop.rawDelta / 1000);
    if (this.message) {
      this.message.t += dt;
      if (this.message.t > 4) this.message = null;
    }
    this.redraw();
  }

  private redraw(): void {
    const s = this.surface;
    if (!s || !this.tex) return;
    clear(s);
    blend(s, 0, s.height, 0, s.width, [20, 14, 24], 0.35);
    const { x, y } = this.pos;
    drawList(
      s,
      this.req.style,
      x,
      y,
      this.page,
      this.selected,
      this.scroll,
      this.message?.text ?? null,
      this.stack.length > 1,
    );
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
